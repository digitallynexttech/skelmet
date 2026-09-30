import "server-only"

import type { Prisma } from "@prisma/client"
import type { Session } from "next-auth"
import { z } from "zod"

import { siteConfig } from "@/config/site"
import {
  refreshPaymentTerms,
  refreshShippingTerms,
} from "@/features/catalog/server/refresh-storefront"
import { checkGatewayKeys } from "@/features/checkout/server/payment-gateway"
import {
  PAYMENT_MODES,
  paymentOptionsSchema,
  paymentSettingsSchema,
  shippingChargeSchema,
  shiprocketSettingsSchema,
  testPaymentSchema,
  type KeySetView,
  type PaymentMode,
  type RuntimeSettingsView,
  type SecretState,
  type SettingSource,
  type SettingVersions,
} from "@/features/settings/schemas/runtime-settings.schema"
import {
  forgetSettings,
  modeOfKey,
  SETTING_KEYS,
  resolvePayment,
  resolvePaymentOptions,
  resolveShipping,
  resolveShiprocket,
  savedPaymentOptions,
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
 * Settings > Payments, Shiprocket, Shipping charge and Pay on delivery: what
 * the console shows of them, and saving them.
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

function view(
  stored: StoredSettings,
  env: Env,
  canWrite: boolean,
  versions: SettingVersions,
): RuntimeSettingsView {
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
        // Set or not set, nothing more. The last four characters of a key
        // secret tell two keys apart; of a password a person chose, they
        // are a quarter of what someone would need to guess it.
        hint: null,
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
    checkout: {
      ...resolvePaymentOptions(stored.checkout),
      source: savedPaymentOptions(stored.checkout) ? "saved" : "default",
    },
    versions,
    canWrite,
  }
}

/** When each section was last saved - the version a save has to still find. */
async function settingVersions(): Promise<SettingVersions> {
  const rows = await db.setting.findMany({
    where: { key: { in: [...SETTING_KEYS] } },
    select: { key: true, updatedAt: true },
  })
  const at = (key: SettingKey) => rows.find((r) => r.key === key)?.updatedAt.toISOString() ?? null
  return {
    payment: at("payment"),
    shiprocket: at("shiprocket"),
    shipping: at("shipping"),
    checkout: at("checkout"),
  }
}

/** The whole view, from the rows as they are in the database now, not as last cached. */
async function currentView(canWrite: boolean): Promise<RuntimeSettingsView> {
  forgetSettings()
  const [stored, versions] = await Promise.all([storedSettings(), settingVersions()])
  return view(stored, getEnv(), canWrite, versions)
}

export async function getRuntimeSettings(): Promise<ActionResult<RuntimeSettingsView>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.SETTING_READ)
    if (!hasDatabase()) return fail(NO_DATABASE, undefined, 503)
    return ok(await currentView(can(session, PERMISSIONS.SETTING_WRITE)))
  })
}

// ── saving ──────────────────────────────────────────────────

/**
 * Two admins saving the same section at once used to both succeed, the second
 * quietly undoing the first: each merged its change into the section as it
 * read it and wrote the whole of it back. Now every save is conditional on the
 * section still being the version it was merged into - the one the console
 * showed when the form was opened, which it sends back as `version`, or failing
 * that the one read here - and the loser is told to reload.
 */
export const STALE_SETTINGS =
  "Someone else saved these settings a moment ago. Reload to see what they changed, then save again."

const versionSchema = z.iso.datetime().nullable().optional()

/** Takes `version` off a save's body, so the section's own schema never sees it. */
function takeVersion(raw: unknown): { version: string | null | undefined; body: unknown } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || !("version" in raw)) {
    return { version: undefined, body: raw }
  }
  const { version, ...body } = raw as Record<string, unknown>
  return { version: versionSchema.parse(version), body }
}

/** One section as it is in the database now, with its version. */
async function currentRow<K extends SettingKey>(
  key: K,
): Promise<{ value: StoredSettings[K] | undefined; version: string | null }> {
  const row = await db.setting.findUnique({
    where: { key },
    select: { value: true, updatedAt: true },
  })
  return {
    value: (row?.value ?? undefined) as StoredSettings[K] | undefined,
    version: row ? row.updatedAt.toISOString() : null,
  }
}

/** Writes a section only if it is still at `expected`; null when someone else got there first. */
async function save(
  session: Session,
  key: SettingKey,
  value: StoredSettings[SettingKey],
  audit: Record<string, unknown>,
  expected: string | null,
): Promise<RuntimeSettingsView | null> {
  const json = (value ?? {}) as Prisma.InputJsonValue
  if (expected === null) {
    try {
      await db.setting.create({ data: { key, value: json, updatedBy: session.user.id } })
    } catch (err) {
      if ((err as { code?: unknown }).code === "P2002") return null
      throw err
    }
  } else {
    const written = await db.setting.updateMany({
      where: { key, updatedAt: new Date(expected) },
      data: { value: json, updatedBy: session.user.id },
    })
    if (written.count === 0) return null
  }
  forgetSettings()
  await createAuditLog(session, {
    action: `setting:${key}`,
    module: "setting",
    entityId: key,
    meta: audit,
    ...(await getAuditMeta()),
  })
  return currentView(true)
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
    const { version, body } = takeVersion(raw)
    const input = paymentSettingsSchema.parse(body)
    const env = getEnv()

    const row = await currentRow("payment")
    if (version !== undefined && version !== row.version)
      return fail(STALE_SETTINGS, undefined, 409)
    const before: StoredPayment = row.value ?? {}
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

    if (changed.length === 0) return ok(await currentView(true))

    const now = resolvePayment(next, env)
    const ready = (c: typeof now) => Boolean(c[c.mode].keyId && c[c.mode].keySecret)
    if (!ready(now) && (ready(was) || changed.includes("mode"))) {
      return fail(
        `The ${now.mode} account would have no key id and secret, so checkout could not take payments. Add them first.`,
        undefined,
        422,
      )
    }

    const saved = await save(
      session,
      "payment",
      next,
      { changed, mode: was.mode === now.mode ? now.mode : { from: was.mode, to: now.mode } },
      row.version,
    )
    return saved ? ok(saved) : fail(STALE_SETTINGS, undefined, 409)
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
    const { version, body } = takeVersion(raw)
    const input = shiprocketSettingsSchema.parse(body)

    const row = await currentRow("shiprocket")
    if (version !== undefined && version !== row.version)
      return fail(STALE_SETTINGS, undefined, 409)
    const before: StoredShiprocket = row.value ?? {}
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

    if (changed.length === 0) return ok(await currentView(true))

    const saved = await save(session, "shiprocket", next, { changed }, row.version)
    if (!saved) return fail(STALE_SETTINGS, undefined, 409)
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
    const { version, body } = takeVersion(raw)
    const input = shippingChargeSchema.parse(body)

    const row = await currentRow("shipping")
    if (version !== undefined && version !== row.version)
      return fail(STALE_SETTINGS, undefined, 409)
    const before = resolveShipping(row.value)
    const saved = await save(session, "shipping", input, { from: before, to: input }, row.version)
    if (!saved) return fail(STALE_SETTINGS, undefined, 409)
    refreshShippingTerms()
    return ok(saved)
  })
}

/**
 * Cash on delivery and the advance: who is offered each, and what each adds
 * to an order. Checkout reads it on the next order; the FAQ and the terms,
 * which say how to pay, are refreshed.
 */
export async function savePaymentOptions(raw: unknown): Promise<ActionResult<RuntimeSettingsView>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.SETTING_WRITE)
    if (!hasDatabase()) return fail(NO_DATABASE, undefined, 503)
    const { version, body } = takeVersion(raw)
    const input = paymentOptionsSchema.parse(body)

    const row = await currentRow("checkout")
    if (version !== undefined && version !== row.version)
      return fail(STALE_SETTINGS, undefined, 409)
    const before = resolvePaymentOptions(row.value)
    const saved = await save(session, "checkout", input, { from: before, to: input }, row.version)
    if (!saved) return fail(STALE_SETTINGS, undefined, 409)
    refreshPaymentTerms()
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
