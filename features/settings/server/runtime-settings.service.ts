import "server-only"

import type { Prisma } from "@prisma/client"
import type { Session } from "next-auth"

import { siteConfig } from "@/config/site"
import { refreshShippingTerms } from "@/features/catalog/server/refresh-storefront"
import { checkGatewayKeys } from "@/features/checkout/server/payment-gateway"
import {
  PAYMENT_MODES,
  paymentSettingsSchema,
  shippingChargeSchema,
  shiprocketSettingsSchema,
  testPaymentSchema,
  type KeySetView,
  type PaymentMode,
  type RuntimeSettingsView,
  type SecretState,
  type SettingSource,
} from "@/features/settings/schemas/runtime-settings.schema"
import {
  forgetSettings,
  modeOfKey,
  resolvePayment,
  resolveShipping,
  resolveShiprocket,
  savedShipping,
  storedSettings,
  type PaymentKeys,
  type SettingKey,
  type StoredKeySet,
  type StoredPayment,
  type StoredSettings,
  type StoredShiprocket,
} from "@/features/settings/server/runtime-settings"
import { open, seal } from "@/features/settings/server/secret-box"
import {
  checkLogin,
  pickupAddress,
  resetShiprocketSession,
} from "@/features/shipping/server/shiprocket"
import { forgetPincodeChecks } from "@/features/shipping/server/shipping.service"
import { PERMISSIONS } from "@/lib/constants"
import { getEnv, hasDatabase, type Env } from "@/lib/env"
import { createAuditLog, getAuditMeta } from "@/server/audit"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { can, requirePermission } from "@/server/action-guard"
import { db } from "@/server/db"

/**
 * Settings > Payments, Shiprocket and Shipping charge: what the console shows
 * of them, and saving them.
 *
 * A secret never leaves the server once saved. The console gets whether it is
 * set, where it comes from, and its last four characters - enough to tell
 * which key is in place without being able to copy it. Every save is
 * audit-logged by field name, never by value.
 */

const NO_DATABASE = "Settings need the database, which is not configured."

// ── what the console is shown ────────────────────────────────

/** The last four characters, and only of a secret long enough that four gives little away. */
function hint(secret: string | null): string | null {
  return secret && secret.length >= 12 ? `…${secret.slice(-4)}` : null
}

/**
 * A secret as the console sees it. `saved` is the sealed value, `env` the
 * .env value when .env applies to this slot.
 */
function secretState(saved: string | undefined, env: string | null | undefined): SecretState {
  const opened = open(saved)
  if (opened) return { set: true, source: "saved", hint: hint(opened), unreadable: false }
  const unreadable = Boolean(saved)
  if (env) return { set: true, source: "env", hint: hint(env), unreadable }
  return { set: false, source: null, hint: null, unreadable }
}

function keySetView(
  mode: PaymentMode,
  stored: StoredKeySet | undefined,
  resolved: PaymentKeys,
  env: Pick<Env, "PAYMENT_KEY_ID" | "PAYMENT_WEBHOOK_SECRET">,
): KeySetView {
  const fromEnv = modeOfKey(env.PAYMENT_KEY_ID) === mode
  const savedPair = Boolean(stored?.keyId?.trim() && open(stored?.keySecret))
  const pairSource: SettingSource = savedPair ? "saved" : resolved.keyId ? "env" : null
  const secret = secretState(savedPair ? stored?.keySecret : undefined, resolved.keySecret)

  return {
    keyId: { value: resolved.keyId, source: pairSource },
    keySecret: {
      ...secret,
      // A saved secret that will not open still has to be entered again.
      unreadable: Boolean(stored?.keySecret) && !open(stored?.keySecret),
    },
    webhookSecret: secretState(stored?.webhookSecret, fromEnv ? env.PAYMENT_WEBHOOK_SECRET : null),
    ready: Boolean(resolved.keyId && resolved.keySecret),
  }
}

function view(stored: StoredSettings, env: Env, canWrite: boolean): RuntimeSettingsView {
  const payment = resolvePayment(stored.payment, env)
  const shiprocket = resolveShiprocket(stored.shiprocket, env)
  const savedLogin = Boolean(stored.shiprocket?.email?.trim() && open(stored.shiprocket?.password))
  const loginSource: SettingSource = savedLogin ? "saved" : shiprocket.email ? "env" : null
  const saved = savedShipping(stored.shipping)
  const site = siteConfig.url.replace(/\/+$/, "")

  return {
    payment: {
      mode: payment.mode,
      modeSource: stored.payment?.mode ? "saved" : payment.envMode ? "env" : "default",
      test: keySetView("test", stored.payment?.test, payment.test, env),
      live: keySetView("live", stored.payment?.live, payment.live, env),
      webhookUrl: `${site}/api/public/webhooks/razorpay`,
    },
    shiprocket: {
      email: { value: shiprocket.email, source: loginSource },
      password: {
        ...secretState(savedLogin ? stored.shiprocket?.password : undefined, shiprocket.password),
        unreadable: Boolean(stored.shiprocket?.password) && !open(stored.shiprocket?.password),
      },
      pickupLocation: {
        value: shiprocket.pickupLocation,
        source: stored.shiprocket?.pickupLocation?.trim()
          ? "saved"
          : shiprocket.pickupLocation
            ? "env"
            : null,
      },
      webhookToken: secretState(stored.shiprocket?.webhookToken, env.SHIPROCKET_WEBHOOK_TOKEN),
      webhookUrl: `${site}/api/public/webhooks/shipping`,
      ready: Boolean(shiprocket.email && shiprocket.password),
    },
    shipping: { ...resolveShipping(stored.shipping), source: saved ? "saved" : "default" },
    canWrite,
  }
}

/** The saved rows as they are in the database now, not as last cached. */
async function freshSettings(): Promise<StoredSettings> {
  forgetSettings()
  return storedSettings()
}

export async function getRuntimeSettings(): Promise<ActionResult<RuntimeSettingsView>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.SETTING_READ)
    if (!hasDatabase()) return fail(NO_DATABASE, undefined, 503)
    return ok(view(await freshSettings(), getEnv(), can(session, PERMISSIONS.SETTING_WRITE)))
  })
}

// ── saving ──────────────────────────────────────────────────

async function save(
  session: Session,
  key: SettingKey,
  value: StoredSettings[SettingKey],
  audit: Record<string, unknown>,
): Promise<RuntimeSettingsView> {
  const json = (value ?? {}) as Prisma.InputJsonValue
  await db.setting.upsert({
    where: { key },
    create: { key, value: json, updatedBy: session.user.id },
    update: { value: json, updatedBy: session.user.id },
  })
  forgetSettings()
  await createAuditLog(session, {
    action: `setting:${key}`,
    module: "setting",
    entityId: key,
    meta: audit,
    ...(await getAuditMeta()),
  })
  return view(await storedSettings(), getEnv(), true)
}

/**
 * The Razorpay keys, and which account takes payments.
 *
 * A key id and its secret are one pair: a new id is only saved with its
 * secret, and clearing the id clears the secret, so a saved id can never sit
 * beside a secret that belongs to another key. And the account switched on
 * cannot be left unable to take payments - a save that would do that is
 * refused, rather than finding out at the next checkout.
 */
export async function savePaymentSettings(
  raw: unknown,
): Promise<ActionResult<RuntimeSettingsView>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.SETTING_WRITE)
    if (!hasDatabase()) return fail(NO_DATABASE, undefined, 503)
    const input = paymentSettingsSchema.parse(raw)
    const env = getEnv()

    const before: StoredPayment = (await freshSettings()).payment ?? {}
    const next: StoredPayment = { ...before }
    const changed: string[] = []

    for (const mode of PAYMENT_MODES) {
      const patch = input[mode]
      if (!patch) continue
      const keys: StoredKeySet = { ...before[mode] }

      if (patch.keyId !== undefined && patch.keyId !== (keys.keyId ?? "")) {
        if (patch.keyId === "") {
          delete keys.keyId
          delete keys.keySecret
        } else if (!patch.keySecret) {
          return fail(
            `Enter the ${mode} key secret that goes with the new key id.`,
            { fieldErrors: { [`${mode}.keySecret`]: ["Enter the secret for this key id"] } },
            422,
          )
        } else {
          keys.keyId = patch.keyId
        }
        changed.push(`${mode}.keyId`)
      }

      if (patch.keySecret !== undefined && patch.keySecret !== "") {
        if (!keys.keyId) {
          return fail(
            `Enter the ${mode} key id that goes with this secret.`,
            { fieldErrors: { [`${mode}.keyId`]: ["Enter the key id for this secret"] } },
            422,
          )
        }
        keys.keySecret = seal(patch.keySecret)
        changed.push(`${mode}.keySecret`)
      }

      if (patch.webhookSecret !== undefined) {
        if (patch.webhookSecret === "") {
          if (keys.webhookSecret) changed.push(`${mode}.webhookSecret`)
          delete keys.webhookSecret
        } else {
          keys.webhookSecret = seal(patch.webhookSecret)
          changed.push(`${mode}.webhookSecret`)
        }
      }

      next[mode] = keys
    }

    const was = resolvePayment(before, env)
    if (input.mode && input.mode !== was.mode) {
      next.mode = input.mode
      changed.push("mode")
    }

    if (changed.length === 0) return ok(view(await storedSettings(), env, true))

    const now = resolvePayment(next, env)
    const ready = (c: typeof now) => Boolean(c[c.mode].keyId && c[c.mode].keySecret)
    if (!ready(now) && (ready(was) || changed.includes("mode"))) {
      return fail(
        `The ${now.mode} account would have no key id and secret, so checkout could not take payments. Add them first.`,
        undefined,
        422,
      )
    }

    return ok(
      await save(session, "payment", next, {
        changed,
        mode: was.mode === now.mode ? now.mode : { from: was.mode, to: now.mode },
      }),
    )
  })
}

/**
 * The Shiprocket login, pickup location and tracking webhook token. A new API
 * user is only saved with its password, as with the Razorpay keys. Saving
 * drops the cached login, any refused-login pause and the cached rates, so the
 * next request runs on the new account.
 */
export async function saveShiprocketSettings(
  raw: unknown,
): Promise<ActionResult<RuntimeSettingsView>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.SETTING_WRITE)
    if (!hasDatabase()) return fail(NO_DATABASE, undefined, 503)
    const input = shiprocketSettingsSchema.parse(raw)

    const before: StoredShiprocket = (await freshSettings()).shiprocket ?? {}
    const next: StoredShiprocket = { ...before }
    const changed: string[] = []

    if (input.email !== undefined && input.email !== (before.email ?? "")) {
      if (input.email === "") {
        delete next.email
        delete next.password
      } else if (!input.password) {
        return fail(
          "Enter the password for this API user.",
          { fieldErrors: { password: ["Enter the password for this API user"] } },
          422,
        )
      } else {
        next.email = input.email
      }
      changed.push("email")
    }

    if (input.password !== undefined && input.password !== "") {
      if (!next.email) {
        return fail(
          "Enter the API user's email too.",
          { fieldErrors: { email: ["Enter the API user's email"] } },
          422,
        )
      }
      next.password = seal(input.password)
      changed.push("password")
    }

    if (
      input.pickupLocation !== undefined &&
      input.pickupLocation !== (before.pickupLocation ?? "")
    ) {
      if (input.pickupLocation === "") delete next.pickupLocation
      else next.pickupLocation = input.pickupLocation
      changed.push("pickupLocation")
    }

    if (input.webhookToken !== undefined) {
      if (input.webhookToken === "") {
        if (next.webhookToken) changed.push("webhookToken")
        delete next.webhookToken
      } else {
        next.webhookToken = seal(input.webhookToken)
        changed.push("webhookToken")
      }
    }

    if (changed.length === 0) return ok(view(await storedSettings(), getEnv(), true))

    const saved = await save(session, "shiprocket", next, { changed })
    resetShiprocketSession()
    forgetPincodeChecks()
    return ok(saved)
  })
}

/** The shipping charge. Every page that states it is refreshed. */
export async function saveShippingCharge(raw: unknown): Promise<ActionResult<RuntimeSettingsView>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.SETTING_WRITE)
    if (!hasDatabase()) return fail(NO_DATABASE, undefined, 503)
    const input = shippingChargeSchema.parse(raw)

    const before = resolveShipping((await freshSettings()).shipping)
    const saved = await save(session, "shipping", input, { from: before, to: input })
    refreshShippingTerms()
    return ok(saved)
  })
}

// ── trying them ─────────────────────────────────────────────

/** Asks Razorpay whether an account's saved keys work. Creates nothing. */
export async function testPaymentKeys(raw: unknown): Promise<ActionResult<{ mode: PaymentMode }>> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.SETTING_WRITE)
    const { mode } = testPaymentSchema.parse(raw)
    await checkGatewayKeys(mode)
    return ok({ mode })
  })
}

/**
 * Logs in to Shiprocket with the saved login and looks the pickup location
 * up. Creates nothing, and keeps to the refused-login pause.
 */
export async function testShiprocket(): Promise<
  ActionResult<{ pickup: { name: string; pincode: string } | null }>
> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.SETTING_WRITE)
    await checkLogin()
    return ok({ pickup: await pickupAddress() })
  })
}
