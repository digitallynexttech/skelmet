import "server-only"

import { FEE_BASES, shippingConfig } from "@/config/shipping"
import {
  KEY_PREFIX,
  PAYMENT_MODES,
  type PaymentMode,
  type ShippingCharge,
} from "@/features/settings/schemas/runtime-settings.schema"
import { open } from "@/features/settings/server/secret-box"
import { getEnv, hasDatabase, type Env } from "@/lib/env"
import { AppError } from "@/lib/errors"
import { db } from "@/server/db"

/**
 * What the site runs on, read at request time: the settings saved in the
 * console, falling back to .env for anything not saved there. So nothing
 * changes until something is saved, and a key can be replaced without a
 * deploy.
 *
 * The saved rows are cached for SETTINGS_TTL_MS and forgotten at once by the
 * save that changes them, so this process sees its own changes straight away
 * and any other process within seconds.
 */

export const SETTING_KEYS = ["payment", "shiprocket", "shipping"] as const
export type SettingKey = (typeof SETTING_KEYS)[number]

/** A key set as saved. The secrets are sealed (secret-box.ts). */
export type StoredKeySet = { keyId?: string; keySecret?: string; webhookSecret?: string }
export type StoredPayment = { mode?: PaymentMode } & Partial<Record<PaymentMode, StoredKeySet>>
/** As saved. `password` and `webhookToken` are sealed. */
export type StoredShiprocket = {
  email?: string
  password?: string
  pickupLocation?: string
  webhookToken?: string
}
export type StoredSettings = {
  payment?: StoredPayment
  shiprocket?: StoredShiprocket
  shipping?: Partial<ShippingCharge>
}

const SETTINGS_TTL_MS = 15_000

/**
 * Held on globalThis, as the Prisma client is: Next can load this module more
 * than once in a process - a copy per route bundle, another on every reload
 * in development - and a save has to be seen by all of them, not only by the
 * copy that made it.
 */
/**
 * The saved rows, and whether they really are what is saved. `known` is
 * false only when the database could not be read and nothing had been read
 * before - the rows are then `{}`, which means ".env for everything".
 */
type Read = { value: StoredSettings; known: boolean }

const shared = globalThis as unknown as {
  skelmetSettingsRead?: {
    cached: { value: StoredSettings; at: number } | null
    reading: Promise<Read> | null
    /** Bumped by every save, so a read that began before it cannot be cached after it. */
    generation: number
  }
}
const state = (shared.skelmetSettingsRead ??= { cached: null, reading: null, generation: 0 })

async function readSettings(): Promise<Read> {
  if (!hasDatabase()) return { value: {}, known: true }
  if (state.cached && Date.now() - state.cached.at < SETTINGS_TTL_MS) {
    return { value: state.cached.value, known: true }
  }
  if (state.reading) return state.reading

  const generation = state.generation
  const reading: Promise<Read> = db.setting
    .findMany({ where: { key: { in: [...SETTING_KEYS] } }, select: { key: true, value: true } })
    .then((rows) => {
      const value = Object.fromEntries(rows.map((r) => [r.key, r.value])) as StoredSettings
      if (state.generation === generation) state.cached = { value, at: Date.now() }
      return { value, known: true }
    })
    .catch((err: unknown) => {
      // Keep running on what was last read rather than dropping to .env, which
      // could quietly swap the live payment keys for the test ones.
      console.error("[SETTINGS] could not read saved settings", err)
      return state.cached ? { value: state.cached.value, known: true } : { value: {}, known: false }
    })
    .finally(() => {
      if (state.reading === reading) state.reading = null
    })
  state.reading = reading
  return reading
}

export async function storedSettings(): Promise<StoredSettings> {
  return (await readSettings()).value
}

/** Called by every save, so the next read - in any route - sees it. */
export function forgetSettings(): void {
  state.generation += 1
  state.cached = null
  state.reading = null
}

// ── Razorpay ────────────────────────────────────────────────

export type PaymentKeys = {
  keyId: string | null
  keySecret: string | null
  webhookSecret: string | null
}

export type PaymentConfig = Record<PaymentMode, PaymentKeys> & {
  /** Which account new payments go to. */
  mode: PaymentMode
  /** The account .env's keys belong to - and so every payment from before the switch existed. */
  envMode: PaymentMode | null
}

/** Which account a Razorpay key id belongs to, by its prefix. */
export function modeOfKey(keyId: string | null | undefined): PaymentMode | null {
  const id = keyId?.trim()
  if (!id) return null
  return id.startsWith(KEY_PREFIX.live) ? "live" : "test"
}

type PaymentEnv = Pick<Env, "PAYMENT_KEY_ID" | "PAYMENT_KEY_SECRET" | "PAYMENT_WEBHOOK_SECRET">

/**
 * The keys for each account. A key id and its secret come as a pair, from the
 * console or from .env and never one of each, since a secret only works with
 * its own id. A saved pair whose secret no longer opens is treated as unsaved.
 * .env's keys fill only the account their id belongs to.
 */
export function resolvePayment(stored: StoredPayment | undefined, env: PaymentEnv): PaymentConfig {
  const envMode = modeOfKey(env.PAYMENT_KEY_ID)
  const keys = {} as Record<PaymentMode, PaymentKeys>

  for (const mode of PAYMENT_MODES) {
    const saved = stored?.[mode]
    const fromEnv = envMode === mode
    const savedId = saved?.keyId?.trim() || null
    const savedSecret = open(saved?.keySecret)

    const pair =
      savedId && savedSecret
        ? { keyId: savedId, keySecret: savedSecret }
        : fromEnv
          ? { keyId: env.PAYMENT_KEY_ID!.trim(), keySecret: env.PAYMENT_KEY_SECRET || null }
          : { keyId: null, keySecret: null }

    keys[mode] = {
      ...pair,
      webhookSecret:
        open(saved?.webhookSecret) ?? (fromEnv ? env.PAYMENT_WEBHOOK_SECRET || null : null),
    }
  }

  const savedMode = PAYMENT_MODES.find((m) => m === stored?.mode)
  return { ...keys, mode: savedMode ?? envMode ?? "test", envMode }
}

export const PAYMENTS_UNAVAILABLE =
  "Payments are temporarily unavailable. Please try again shortly."

/**
 * The Razorpay accounts in force. Fails closed: when the saved settings
 * cannot be read and none were read before, it refuses rather than falling
 * back to .env - whose keys and mode may be a different account from the
 * one the console switched on, so guessing could take a real customer's
 * payment on the test account, or verify it with the wrong secret.
 */
export async function paymentConfig(): Promise<PaymentConfig> {
  const read = await readSettings()
  if (!read.known) throw new AppError(PAYMENTS_UNAVAILABLE, 503, "SETTINGS_UNAVAILABLE")
  return resolvePayment(read.value.payment, getEnv())
}

// ── Shiprocket ──────────────────────────────────────────────

export type ShiprocketConfig = {
  apiUrl: string
  email: string | null
  password: string | null
  pickupLocation: string | null
  webhookToken: string | null
}

type ShiprocketEnv = Pick<
  Env,
  | "SHIPROCKET_API_URL"
  | "SHIPROCKET_EMAIL"
  | "SHIPROCKET_PASSWORD"
  | "SHIPROCKET_PICKUP_LOCATION"
  | "SHIPROCKET_WEBHOOK_TOKEN"
>

/** The login is a pair too: a saved email is only used with its saved password. */
export function resolveShiprocket(
  stored: StoredShiprocket | undefined,
  env: ShiprocketEnv,
): ShiprocketConfig {
  const savedEmail = stored?.email?.trim() || null
  const savedPassword = open(stored?.password)
  const login =
    savedEmail && savedPassword
      ? { email: savedEmail, password: savedPassword }
      : { email: env.SHIPROCKET_EMAIL?.trim() || null, password: env.SHIPROCKET_PASSWORD || null }

  return {
    apiUrl: env.SHIPROCKET_API_URL,
    ...login,
    pickupLocation:
      stored?.pickupLocation?.trim() || env.SHIPROCKET_PICKUP_LOCATION?.trim() || null,
    webhookToken: open(stored?.webhookToken) ?? (env.SHIPROCKET_WEBHOOK_TOKEN || null),
  }
}

export async function shiprocketConfig(): Promise<ShiprocketConfig> {
  return resolveShiprocket((await storedSettings()).shiprocket, getEnv())
}

// ── shipping charge ─────────────────────────────────────────

const wholeRupees = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 0

/** The saved shipping charge, or null when none is saved or it is not a whole one. */
export function savedShipping(stored: Partial<ShippingCharge> | undefined): ShippingCharge | null {
  if (
    stored &&
    wholeRupees(stored.aboveRupees) &&
    wholeRupees(stored.sharePercent) &&
    stored.sharePercent <= 100 &&
    FEE_BASES.some((b) => b === stored.basis)
  ) {
    return {
      aboveRupees: stored.aboveRupees,
      sharePercent: stored.sharePercent,
      basis: stored.basis!,
    }
  }
  return null
}

export function resolveShipping(stored: Partial<ShippingCharge> | undefined): ShippingCharge {
  return savedShipping(stored) ?? { ...shippingConfig.fee }
}

/** What the buyer pays for shipping, and when: saved in the console, or config/shipping.ts. */
export async function shippingCharge(): Promise<ShippingCharge> {
  return resolveShipping((await storedSettings()).shipping)
}
