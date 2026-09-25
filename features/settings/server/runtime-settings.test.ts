import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { shippingConfig } from "@/config/shipping"
import {
  modeOfKey,
  resolvePayment,
  resolveShipping,
  resolveShiprocket,
} from "@/features/settings/server/runtime-settings"
import { open, seal } from "@/features/settings/server/secret-box"

/**
 * Which keys the site runs on. A mistake here charges customers on the wrong
 * Razorpay account or logs in to Shiprocket as the wrong user, so the rules
 * for mixing saved settings with .env are pinned down one by one.
 */

const original = { ...process.env }

beforeEach(() => {
  process.env.AUTH_SECRET = "an-auth-secret-long-enough-for-the-test"
})

afterEach(() => {
  process.env = { ...original }
})

describe("secret box", () => {
  it("opens what it sealed", () => {
    expect(open(seal("rzp-secret-value"))).toBe("rzp-secret-value")
  })

  it("never stores the secret readable, and seals it differently every time", () => {
    const a = seal("rzp-secret-value")
    const b = seal("rzp-secret-value")
    expect(a).not.toContain("rzp-secret-value")
    expect(a).not.toBe(b)
  })

  it("will not open a value edited in the database", () => {
    // Flip one byte of the ciphertext itself. (Changing the last base64
    // character is not enough: it can land on padding bits and decode the same.)
    const sealed = seal("rzp-secret-value")
    const [head, data] = [sealed.slice(0, sealed.lastIndexOf(".") + 1), sealed.split(".").at(-1)!]
    const bytes = Buffer.from(data, "base64url")
    bytes[0] = bytes[0]! ^ 0x01
    expect(open(head + bytes.toString("base64url"))).toBeNull()
  })

  it("will not open once AUTH_SECRET has changed", () => {
    const sealed = seal("rzp-secret-value")
    process.env.AUTH_SECRET = "a-different-auth-secret-entirely"
    expect(open(sealed)).toBeNull()
  })

  it("does not treat a plain string, or nothing, as sealed", () => {
    expect(open("rzp-secret-value")).toBeNull()
    expect(open(undefined)).toBeNull()
    expect(open(42)).toBeNull()
  })
})

describe("modeOfKey", () => {
  it("reads the account from the key id", () => {
    expect(modeOfKey("rzp_live_abc")).toBe("live")
    expect(modeOfKey("rzp_test_abc")).toBe("test")
    expect(modeOfKey("  ")).toBeNull()
    expect(modeOfKey(undefined)).toBeNull()
  })
})

describe("resolvePayment", () => {
  const env = {
    PAYMENT_KEY_ID: "rzp_test_env",
    PAYMENT_KEY_SECRET: "env-secret",
    PAYMENT_WEBHOOK_SECRET: "env-hook",
  }

  it("runs on .env until anything is saved, and only for the account its key belongs to", () => {
    const config = resolvePayment(undefined, env)
    expect(config.mode).toBe("test")
    expect(config.envMode).toBe("test")
    expect(config.test).toEqual({
      keyId: "rzp_test_env",
      keySecret: "env-secret",
      webhookSecret: "env-hook",
    })
    expect(config.live).toEqual({ keyId: null, keySecret: null, webhookSecret: null })
  })

  it("puts live keys in .env on the live account", () => {
    const config = resolvePayment(undefined, { ...env, PAYMENT_KEY_ID: "rzp_live_env" })
    expect(config.mode).toBe("live")
    expect(config.live.keyId).toBe("rzp_live_env")
    expect(config.test.keyId).toBeNull()
  })

  it("prefers a saved key pair to .env, and keeps .env's webhook secret until one is saved", () => {
    const config = resolvePayment(
      { test: { keyId: "rzp_test_saved", keySecret: seal("saved-secret") } },
      env,
    )
    expect(config.test).toEqual({
      keyId: "rzp_test_saved",
      keySecret: "saved-secret",
      webhookSecret: "env-hook",
    })
  })

  it("never pairs a saved key id with .env's secret, which belongs to another key", () => {
    const config = resolvePayment({ test: { keyId: "rzp_test_saved" } }, env)
    expect(config.test.keyId).toBe("rzp_test_env")
    expect(config.test.keySecret).toBe("env-secret")
  })

  it("falls back to .env when a saved secret will not open", () => {
    const sealed = seal("saved-secret")
    process.env.AUTH_SECRET = "rotated-auth-secret-of-some-length"
    const config = resolvePayment({ test: { keyId: "rzp_test_saved", keySecret: sealed } }, env)
    expect(config.test.keyId).toBe("rzp_test_env")
  })

  it("switches account by the saved mode, and keeps .env's account for old payments", () => {
    const config = resolvePayment(
      { mode: "live", live: { keyId: "rzp_live_saved", keySecret: seal("live-secret") } },
      env,
    )
    expect(config.mode).toBe("live")
    expect(config.envMode).toBe("test")
    expect(config.live.keySecret).toBe("live-secret")
    expect(config.test.keySecret).toBe("env-secret")
  })

  it("ignores a saved mode that is not an account", () => {
    const config = resolvePayment({ mode: "prod" as never }, env)
    expect(config.mode).toBe("test")
  })
})

describe("resolveShiprocket", () => {
  const env = {
    SHIPROCKET_API_URL: "https://apiv2.shiprocket.in",
    SHIPROCKET_EMAIL: "env-user@example.com",
    SHIPROCKET_PASSWORD: "env-pass",
    SHIPROCKET_PICKUP_LOCATION: "Home",
    SHIPROCKET_WEBHOOK_TOKEN: "env-token",
  }

  it("runs on .env until anything is saved", () => {
    expect(resolveShiprocket(undefined, env)).toEqual({
      apiUrl: "https://apiv2.shiprocket.in",
      email: "env-user@example.com",
      password: "env-pass",
      pickupLocation: "Home",
      webhookToken: "env-token",
    })
  })

  it("uses a saved login as a pair, never a saved email with .env's password", () => {
    const saved = resolveShiprocket(
      { email: "new-user@example.com", password: seal("new-pass") },
      env,
    )
    expect(saved).toMatchObject({ email: "new-user@example.com", password: "new-pass" })

    const half = resolveShiprocket({ email: "new-user@example.com" }, env)
    expect(half).toMatchObject({ email: "env-user@example.com", password: "env-pass" })
  })

  it("prefers a saved pickup location and webhook token", () => {
    const config = resolveShiprocket(
      { pickupLocation: "Warehouse", webhookToken: seal("saved-token") },
      env,
    )
    expect(config.pickupLocation).toBe("Warehouse")
    expect(config.webhookToken).toBe("saved-token")
  })
})

describe("resolveShipping", () => {
  it("is config/shipping.ts's charge until one is saved", () => {
    expect(resolveShipping(undefined)).toEqual(shippingConfig.fee)
  })

  it("is the saved charge once saved", () => {
    const saved = { aboveRupees: 250, sharePercent: 40, basis: "cheapest" as const }
    expect(resolveShipping(saved)).toEqual(saved)
  })

  it("ignores a saved charge that is not whole rupees or names no basis", () => {
    for (const bad of [
      { aboveRupees: -1, sharePercent: 50, basis: "average" as const },
      { aboveRupees: 300, sharePercent: 49.5, basis: "average" as const },
      { aboveRupees: 300, sharePercent: 150, basis: "average" as const },
      { aboveRupees: 300, sharePercent: 50, basis: "median" as never },
      // A charge saved under the old flat-fee rule is not this rule.
      { aboveRupees: 300, feeRupees: 350, basis: "twoCheapest" as const } as never,
      { aboveRupees: 300 },
    ]) {
      expect(resolveShipping(bad)).toEqual(shippingConfig.fee)
    }
  })
})
