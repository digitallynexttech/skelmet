import "server-only"

import { FEE_BASES, shippingConfig } from "@/lib/config/shipping"
import { DEFAULT_PAYMENT_OPTIONS } from "@/features/checkout/payment-options"
import {
  KEY_PREFIX,
  PAYMENT_MODES,
  paymentOptionsSchema,
  type PaymentMode,
  type PaymentOptions,
  type ShippingCharge,
} from "@/features/settings/schemas/runtime-settings.schema"
import { open } from "@/features/settings/server/secret-box"
import { getEnv, hasDatabase, type Env } from "@/lib/env"
import { AppError } from "@/lib/errors"
import { db } from "@/server/db"

/**
 * Settings saved in the console, falling back to .env for anything not saved. Cached for
 * SETTINGS_TTL_MS and dropped by the save that changes them, so another process sees a change
 * within seconds.
 */

export const SETTING_KEYS = ["payment", "shiprocket", "shipping", "checkout"] as const
export type SettingKey = (typeof SETTING_KEYS)[number]

/** The secrets are sealed (secret-box.ts). */
export type StoredKeySet = { keyId?: string; keySecret?: string; webhookSecret?: string }
export type StoredPayment = { mode?: PaymentMode } & Partial<Record<PaymentMode, StoredKeySet>>
/** `password` and `webhookToken` are sealed. */
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
  checkout?: unknown
}

const SETTINGS_TTL_MS = 15_000

// `known` is false only when the database could not be read and nothing was read before; the
// value is then `{}`, meaning ".env for everything".
type Read = { value: StoredSettings; known: boolean }

// On globalThis: Next can load this module once per route bundle, and every copy must see a save.
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
      // Keep the last read rather than drop to .env, which could swap live keys for test ones.
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

/** Called by every save, so the next read in any route sees it. */
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
  /** The account .env's keys belong to, and so every payment from before the switch existed. */
  envMode: PaymentMode | null
}

/** By the key id's prefix. */
export function modeOfKey(keyId: string | null | undefined): PaymentMode | null {
  const id = keyId?.trim()
  if (!id) return null
  return id.startsWith(KEY_PREFIX.live) ? "live" : "test"
}

type PaymentEnv = Pick<Env, "PAYMENT_KEY_ID" | "PAYMENT_KEY_SECRET" | "PAYMENT_WEBHOOK_SECRET">

/**
 * Key id and secret come as a pair, saved or .env, never one of each. A saved pair whose secret
 * no longer opens counts as unsaved. .env fills only the account its id belongs to.
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
 * Fails closed: with no readable saved settings it refuses rather than fall back to .env, which
 * may be a different account (a real payment on test keys, or verified with the wrong secret).
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

/** Null when none is saved or it is incomplete. */
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

/** Saved in the console, else lib/config/shipping.ts. */
export async function shippingCharge(): Promise<ShippingCharge> {
  return resolveShipping((await storedSettings()).shipping)
}

// ── paying on delivery ──────────────────────────────────────

/** Null when none are saved or they do not parse as a whole. */
export function savedPaymentOptions(stored: unknown): PaymentOptions | null {
  if (!stored) return null
  const read = paymentOptionsSchema.safeParse(stored)
  return read.success ? read.data : null
}

/** Anything unreadable is the default (online only): a half-read row must not switch COD on. */
export function resolvePaymentOptions(stored: unknown): PaymentOptions {
  return savedPaymentOptions(stored) ?? structuredClone(DEFAULT_PAYMENT_OPTIONS)
}

export async function paymentOptions(): Promise<PaymentOptions> {
  return resolvePaymentOptions((await storedSettings()).checkout)
}
