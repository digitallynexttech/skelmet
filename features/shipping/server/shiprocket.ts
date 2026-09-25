import "server-only"

import { createHash } from "node:crypto"

import { AppError } from "@/lib/errors"
import {
  shiprocketConfig,
  type ShiprocketConfig,
} from "@/features/settings/server/runtime-settings"
import { parseShiprocketDate } from "@/features/shipping/server/shiprocket-mapping"

/**
 * Shiprocket's REST API, called directly with `fetch` - no SDK, the same way
 * payment-gateway.ts talks to Razorpay.
 *
 * Server-only, always: the login is an API user's email and password, and the
 * token it returns can book couriers against the shop's wallet. Both come from
 * the console's Settings, falling back to .env (runtime-settings.ts).
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
 * different login - a new user or password saved in Settings, or a restart
 * picking up a corrected .env - is not held by it.
 *
 * Only a refusal counts. Shiprocket failing to answer, or answering with its
 * own 5xx, says nothing about the password and is retried as before.
 */
const REFUSED_PAUSE_MS = 15 * 60_000

export async function isShiprocketConfigured(): Promise<boolean> {
  const config = await shiprocketConfig()
  return Boolean(config.email && config.password)
}

/**
 * The pickup address's name as configured. Orders cannot be created without
 * one; pickupAddress() resolves it against Shiprocket.
 */
export async function pickupLocation(): Promise<string | null> {
  return (await shiprocketConfig()).pickupLocation
}

function baseUrl(config: ShiprocketConfig): string {
  return `${config.apiUrl.replace(/\/+$/, "")}/v1/external`
}

/**
 * A token is only good for the account and environment that issued it, and a
 * refusal only for the password that earned it - so the password is part of
 * the key, as a hash. A corrected password is then tried at once instead of
 * waiting out the pause the wrong one caused.
 */
function tokenKey(config: ShiprocketConfig): string {
  const password = createHash("sha256")
    .update(config.password ?? "")
    .digest("hex")
    .slice(0, 16)
  return `${config.apiUrl}|${config.email}|${password}`
}

/**
 * The token, a refusal's pause and the pickup address, held on globalThis as
 * the Prisma client is. Next can load this module more than once in a process
 * - a copy per route bundle - and the pause only protects the account if every
 * copy sees it: one refused login has to stop the pincode checks, the paid
 * orders and the console alike, not just the route that got refused.
 */
type Session = {
  token: { value: string; expiresAt: number; key: string } | null
  loggingIn: { promise: Promise<string>; key: string } | null
  refused: { message: string; until: number; key: string } | null
  pickup: { configured: string; name: string; pincode: string; expiresAt: number } | null
}
const shared = globalThis as unknown as { skelmetShiprocket?: Session }
const session = (shared.skelmetShiprocket ??= {
  token: null,
  loggingIn: null,
  refused: null,
  pickup: null,
})

/**
 * Forgets the token, any pause and the pickup address - for when Settings
 * changes the login, so the next call starts from the new one.
 */
export function resetShiprocketSession(): void {
  session.token = null
  session.refused = null
  session.loggingIn = null
  session.pickup = null
}

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

async function login(config: ShiprocketConfig): Promise<string> {
  const key = tokenKey(config)
  let res: Response
  try {
    res = await fetch(`${baseUrl(config)}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email: config.email, password: config.password }),
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
    session.refused = { message, until: Date.now() + REFUSED_PAUSE_MS, key }
    throw new ShippingError(message)
  }
  session.refused = null
  session.token = { value: body.token, expiresAt: Date.now() + TOKEN_TTL_MS, key }
  return body.token
}

async function currentToken(config: ShiprocketConfig): Promise<string> {
  const key = tokenKey(config)
  const { token, refused } = session
  if (token && token.key === key && token.expiresAt > Date.now()) return token.value
  if (refused && refused.key === key && refused.until > Date.now()) {
    const minutes = Math.ceil((refused.until - Date.now()) / 60_000)
    throw new ShippingError(
      `${refused.message} Not trying again for ${minutes} min, so repeated attempts do not keep the account locked.`,
      503,
    )
  }
  // Concurrent callers share one login - but only for the same login.
  if (session.loggingIn?.key === key) return session.loggingIn.promise
  const attempt = {
    key,
    promise: login(config).finally(() => {
      if (session.loggingIn === attempt) session.loggingIn = null
    }),
  }
  session.loggingIn = attempt
  return attempt.promise
}

/**
 * Logs in with the details in use, for Settings' "Test connection". Holds to
 * the same pause as everything else, so testing a login that was just
 * refused does not ask Shiprocket again.
 */
export async function checkLogin(): Promise<void> {
  const config = await shiprocketConfig()
  if (!config.email || !config.password) {
    throw new ShippingError("Add the API user's email and password first.", 422)
  }
  await currentToken(config)
}

async function call<T extends Record<string, unknown>>(
  method: "GET" | "POST",
  path: string,
  options: { body?: unknown; query?: Record<string, string | number | undefined> } = {},
): Promise<T> {
  const config = await shiprocketConfig()
  if (!config.email || !config.password) {
    throw new ShippingError("Shiprocket is not set up on this server.", 503)
  }

  const url = new URL(`${baseUrl(config)}${path}`)
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
    res = await send(await currentToken(config))
    if (res.status === 401) {
      session.token = null
      res = await send(await currentToken(config))
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
 * GET /open/postcode/details. The city and state Shiprocket files a pincode
 * under, for filling in an address. Null when Shiprocket has no such pincode,
 * which it reports as an error ("City/State not found for this pincode")
 * rather than an empty answer.
 */
export async function postcodeDetails(
  pincode: string,
): Promise<{ city: string; state: string } | null> {
  try {
    const r = await call<{ postcode_details?: { city?: unknown; state?: unknown } }>(
      "GET",
      "/open/postcode/details",
      { query: { postcode: pincode } },
    )
    const city = typeof r.postcode_details?.city === "string" ? r.postcode_details.city.trim() : ""
    const state =
      typeof r.postcode_details?.state === "string" ? r.postcode_details.state.trim() : ""
    return city && state ? { city, state } : null
  } catch (err) {
    if (err instanceof ShippingError && /not found/i.test(err.message)) return null
    throw err
  }
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
  const configured = await pickupLocation()
  if (!configured) return null
  const cached = session.pickup
  if (cached?.configured === configured && cached.expiresAt > Date.now()) {
    return { name: cached.name, pincode: cached.pincode }
  }

  const r = await call<{
    data?: { shipping_address?: Array<{ pickup_location?: string; pin_code?: string | number }> }
  }>("GET", "/settings/company/pickup")
  const match = (r.data?.shipping_address ?? []).find(
    (a) => a.pickup_location?.trim().toLowerCase() === configured.toLowerCase(),
  )
  if (!match?.pickup_location || !match.pin_code) {
    throw new ShippingError(
      `Shiprocket has no pickup address named "${configured}". Check the pickup location in the console's Settings against Shiprocket's Settings > Pickup Addresses.`,
      503,
    )
  }

  session.pickup = {
    configured,
    name: match.pickup_location.trim(),
    pincode: String(match.pin_code),
    expiresAt: Date.now() + PICKUP_TTL_MS,
  }
  return { name: session.pickup.name, pincode: session.pickup.pincode }
}
