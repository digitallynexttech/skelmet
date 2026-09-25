import "server-only"

import { getEnv } from "@/lib/env"
import { AppError } from "@/lib/errors"
import { parseShiprocketDate } from "@/features/shipping/server/shiprocket-mapping"

/**
 * Shiprocket's REST API, called directly with `fetch` - no SDK, the same way
 * payment-gateway.ts talks to Razorpay.
 *
 * Server-only, always: the login is an API user's email and password, and the
 * token it returns can book couriers against the shop's wallet.
 *
 * The token lasts 240 hours. It is cached in memory and reused until a day
 * before that, and one 401 - a token revoked early, or a password changed in
 * the panel - logs in again and retries once. Concurrent callers share one
 * login rather than racing to make several, and a refused login pauses the
 * next for REFUSED_PAUSE_MS.
 *
 * Every failure is a ShippingError carrying Shiprocket's own message, because
 * "Wallet balance is low" or "pickup location not found" is exactly what the
 * person in the console needs to read.
 */

export class ShippingError extends AppError {
  constructor(message: string, status = 502) {
    super(message, status, "SHIPPING_PROVIDER")
  }
}

const TIMEOUT_MS = 20_000
/** Nine days: the token is good for ten. */
const TOKEN_TTL_MS = 9 * 24 * 60 * 60_000

/**
 * How long to wait after Shiprocket refuses a login before asking again.
 *
 * Shiprocket locks the API user after a run of failed logins, and an attempt
 * made while it is locked - even with the right password - can restart the
 * lock. Nothing here used to remember a refusal, so every paid order and every
 * pincode check tried again: a wrong password locked the account, and ordinary
 * shopping kept it locked. One refusal now pauses logins for this long. A
 * restart, which is what picks up a corrected .env, clears it.
 *
 * Only a refusal counts. Shiprocket failing to answer, or answering with its
 * own 5xx, says nothing about the password and is retried as before.
 */
const REFUSED_PAUSE_MS = 15 * 60_000

export function isShiprocketConfigured(): boolean {
  const env = getEnv()
  return Boolean(env.SHIPROCKET_EMAIL?.trim() && env.SHIPROCKET_PASSWORD)
}

/**
 * The pickup address's name as configured. Orders cannot be created without
 * one; pickupAddress() resolves it against Shiprocket.
 */
export function pickupLocation(): string | null {
  return getEnv().SHIPROCKET_PICKUP_LOCATION?.trim() || null
}

function baseUrl(): string {
  return `${getEnv().SHIPROCKET_API_URL.replace(/\/+$/, "")}/v1/external`
}

/** A token is only good for the account and environment that issued it. */
function tokenKey(): string {
  const env = getEnv()
  return `${env.SHIPROCKET_API_URL}|${env.SHIPROCKET_EMAIL}`
}

let token: { value: string; expiresAt: number; key: string } | null = null
let loggingIn: Promise<string> | null = null
let refused: { message: string; until: number; key: string } | null = null

async function readJson(res: Response): Promise<Record<string, unknown> | null> {
  try {
    const body = (await res.json()) as unknown
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** Shiprocket's message, plus the first field error when it gives them. */
function describe(body: Record<string, unknown> | null, status: number): string {
  const message = typeof body?.message === "string" ? body.message : `HTTP ${status}`
  const errors = body?.errors
  if (errors && typeof errors === "object") {
    const first = Object.values(errors as Record<string, unknown>).flat()[0]
    if (typeof first === "string" && !message.includes(first)) return `${message} (${first})`
  }
  return message
}

async function login(): Promise<string> {
  const env = getEnv()
  let res: Response
  try {
    res = await fetch(`${baseUrl()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        email: env.SHIPROCKET_EMAIL?.trim(),
        password: env.SHIPROCKET_PASSWORD,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    })
  } catch {
    throw new ShippingError("Shiprocket did not answer. Try again in a moment.", 504)
  }
  const body = await readJson(res)
  if (res.status >= 500) {
    throw new ShippingError(`Shiprocket could not log in just now: ${describe(body, res.status)}`)
  }
  if (!res.ok || typeof body?.token !== "string") {
    const message = `Shiprocket refused the login: ${describe(body, res.status)}`
    refused = { message, until: Date.now() + REFUSED_PAUSE_MS, key: tokenKey() }
    throw new ShippingError(message)
  }
  refused = null
  token = { value: body.token, expiresAt: Date.now() + TOKEN_TTL_MS, key: tokenKey() }
  return body.token
}

async function currentToken(): Promise<string> {
  if (token && token.key === tokenKey() && token.expiresAt > Date.now()) return token.value
  if (refused && refused.key === tokenKey() && refused.until > Date.now()) {
    const minutes = Math.ceil((refused.until - Date.now()) / 60_000)
    throw new ShippingError(
      `${refused.message} Not trying again for ${minutes} min, so repeated attempts do not keep the account locked.`,
      503,
    )
  }
  loggingIn ??= login().finally(() => {
    loggingIn = null
  })
  return loggingIn
}

async function call<T extends Record<string, unknown>>(
  method: "GET" | "POST",
  path: string,
  options: { body?: unknown; query?: Record<string, string | number | undefined> } = {},
): Promise<T> {
  if (!isShiprocketConfigured()) {
    throw new ShippingError("Shiprocket is not set up on this server.", 503)
  }

  const url = new URL(`${baseUrl()}${path}`)
  for (const [k, v] of Object.entries(options.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, String(v))
  }

  const send = (bearer: string) =>
    fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${bearer}`,
        ...(options.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    })

  let res: Response
  try {
    res = await send(await currentToken())
    if (res.status === 401) {
      token = null
      res = await send(await currentToken())
    }
  } catch (err) {
    if (err instanceof ShippingError) throw err
    throw new ShippingError("Shiprocket did not answer. Try again in a moment.", 504)
  }

  const body = await readJson(res)
  if (!res.ok) throw new ShippingError(`Shiprocket: ${describe(body, res.status)}`)
  return (body ?? {}) as T
}

// ── endpoints ──────────────────────────────────────────────────────────────

/** POST /orders/create/adhoc. Returns Shiprocket's order and shipment ids. */
export async function createOrder(
  payload: Record<string, unknown>,
): Promise<{ orderId: string; shipmentId: string }> {
  const r = await call<{ order_id?: number; shipment_id?: number; message?: string }>(
    "POST",
    "/orders/create/adhoc",
    { body: payload },
  )
  if (!r.order_id || !r.shipment_id) {
    throw new ShippingError(
      `Shiprocket did not create the order: ${typeof r.message === "string" ? r.message : "no order id came back"}`,
    )
  }
  return { orderId: String(r.order_id), shipmentId: String(r.shipment_id) }
}

/** GET /courier/serviceability/. The raw answer; courierOptions() reads it. */
export function serviceability(query: {
  pickup_postcode: string
  delivery_postcode: string
  cod: 0 | 1
  weight: number
  length?: number
  breadth?: number
  height?: number
  declared_value?: number
}): Promise<Record<string, unknown>> {
  return call("GET", "/courier/serviceability/", { query })
}

/**
 * POST /courier/assign/awb. With no courier id, Shiprocket picks by the
 * account's courier priority settings. This is the call that charges the
 * wallet, and the one that fails when it is empty.
 */
export async function assignAwb(
  shipmentId: string,
  courierId?: number,
): Promise<{ awb: string; courierName: string }> {
  const r = await call<{
    awb_assign_status?: number
    message?: string
    response?: {
      data?: { awb_code?: string | number; courier_name?: string; awb_assign_error?: string }
    }
  }>("POST", "/courier/assign/awb", {
    body: { shipment_id: Number(shipmentId), ...(courierId ? { courier_id: courierId } : {}) },
  })
  const data = r.response?.data
  if (r.awb_assign_status !== 1 || !data?.awb_code) {
    const why = data?.awb_assign_error ?? r.message ?? "no AWB came back"
    throw new ShippingError(`Shiprocket could not assign a courier: ${why}`)
  }
  return { awb: String(data.awb_code), courierName: data.courier_name ?? "Courier" }
}

/** POST /courier/generate/pickup. Needs the AWB first. */
export async function requestPickup(shipmentId: string): Promise<{ scheduledAt: Date | null }> {
  const r = await call<{
    pickup_status?: number
    message?: string
    response?: { pickup_scheduled_date?: string; data?: string }
  }>("POST", "/courier/generate/pickup", { body: { shipment_id: [Number(shipmentId)] } })
  if (r.pickup_status !== 1) {
    const why = r.message ?? r.response?.data ?? "no confirmation came back"
    throw new ShippingError(`Shiprocket could not schedule the pickup: ${why}`)
  }
  return { scheduledAt: parseShiprocketDate(r.response?.pickup_scheduled_date) }
}

/** POST /manifests/generate. Shiprocket asks for it after the pickup request. */
export async function generateManifest(shipmentId: string): Promise<string | null> {
  const r = await call<{ manifest_url?: string }>("POST", "/manifests/generate", {
    body: { shipment_id: [Number(shipmentId)] },
  })
  return typeof r.manifest_url === "string" && r.manifest_url ? r.manifest_url : null
}

/** POST /courier/generate/label. The PDF staff print and stick on the box. */
export async function generateLabel(shipmentId: string): Promise<string> {
  const r = await call<{ label_created?: number; label_url?: string; response?: string }>(
    "POST",
    "/courier/generate/label",
    { body: { shipment_id: [Number(shipmentId)] } },
  )
  if (r.label_created !== 1 || !r.label_url) {
    throw new ShippingError(
      `Shiprocket could not make the label: ${r.response ?? "no label came back"}`,
    )
  }
  return r.label_url
}

/** POST /orders/cancel/shipment/awbs. Only works before the courier is out for pickup. */
export async function cancelShipments(awbs: string[]): Promise<void> {
  await call("POST", "/orders/cancel/shipment/awbs", { body: { awbs } })
}

/** POST /orders/cancel. */
export async function cancelOrders(shiprocketOrderIds: string[]): Promise<void> {
  await call("POST", "/orders/cancel", { body: { ids: shiprocketOrderIds.map(Number) } })
}

/** GET /courier/track/awb/{awb}. The raw answer; trackingSnapshot() reads it. */
export function trackAwb(awb: string): Promise<Record<string, unknown>> {
  return call("GET", `/courier/track/awb/${encodeURIComponent(awb)}`)
}

const PICKUP_TTL_MS = 6 * 60 * 60_000
let pickupCache: { configured: string; name: string; pincode: string; expiresAt: number } | null =
  null

/**
 * The configured pickup address, as Shiprocket holds it: its exact name, for
 * creating orders, and its pincode, for quoting rates from where the courier
 * actually collects - which need not be the office address on the site.
 *
 * GET /settings/company/pickup, cached for six hours. Null when no pickup
 * location is configured; an error when the configured name matches nothing
 * in Shiprocket, since every order would then be refused.
 */
export async function pickupAddress(): Promise<{ name: string; pincode: string } | null> {
  const configured = pickupLocation()
  if (!configured) return null
  if (pickupCache?.configured === configured && pickupCache.expiresAt > Date.now()) {
    return { name: pickupCache.name, pincode: pickupCache.pincode }
  }

  const r = await call<{
    data?: { shipping_address?: Array<{ pickup_location?: string; pin_code?: string | number }> }
  }>("GET", "/settings/company/pickup")
  const match = (r.data?.shipping_address ?? []).find(
    (a) => a.pickup_location?.trim().toLowerCase() === configured.toLowerCase(),
  )
  if (!match?.pickup_location || !match.pin_code) {
    throw new ShippingError(
      `Shiprocket has no pickup address named "${configured}". Check SHIPROCKET_PICKUP_LOCATION against Settings > Pickup Addresses.`,
      503,
    )
  }

  pickupCache = {
    configured,
    name: match.pickup_location.trim(),
    pincode: String(match.pin_code),
    expiresAt: Date.now() + PICKUP_TTL_MS,
  }
  return { name: pickupCache.name, pincode: pickupCache.pincode }
}
