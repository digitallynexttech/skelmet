import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

/**
 * Proof that the browser asking about an order is the one that placed it.
 *
 * `SKM-YYYY-XXXX` is roughly a million numbers a year drawn from a 32-letter
 * alphabet, which makes an order number a short, guessable key rather than a
 * secret. The confirmation page shows an email address and a total, and its
 * visitors are usually guests with no session to check - so without this
 * cookie, every customer's contact details would sit one lucky typo away.
 *
 * The value is the number plus an HMAC of it under AUTH_SECRET. A cookie is
 * whatever the visitor says it is - it used to hold the bare number, so anyone
 * could set it to a guessed number and read that customer's email, phone and
 * home address back out of the checkout prefill. Only this server can mint the
 * signature, so only a browser that really placed the order holds a valid one.
 *
 * httpOnly so a script on the page cannot read it back out, and `lax` so it
 * still arrives on the redirect out of the payment gateway.
 */
const COOKIE = "skm.recent-order"

/** A week: long enough to refresh the tab tomorrow, short enough to expire. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7

function sign(number: string): string | null {
  const secret = process.env.AUTH_SECRET
  if (!secret) return null
  return createHmac("sha256", secret).update(`recent-order:${number}`).digest("base64url")
}

export async function rememberOrder(number: string): Promise<void> {
  const signature = sign(number)
  // No secret, no proof: better to remember nothing than something forgeable.
  if (!signature) return
  const jar = await cookies()
  jar.set(COOKIE, `${number}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    // Keyed on the deployment's real scheme, NOT NODE_ENV. A Secure cookie is
    // silently DROPPED by the browser on a plain-http origin - localhost is
    // exempt, so tying this to NODE_ENV works in dev and then breaks the
    // confirmation page the moment it ships to an http host. Flips itself back
    // on the day NEXT_PUBLIC_SITE_URL becomes https.
    secure: (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  })
}

export async function rememberedOrder(): Promise<string | null> {
  const jar = await cookies()
  const value = jar.get(COOKIE)?.value
  if (!value) return null

  const dot = value.lastIndexOf(".")
  if (dot <= 0) return null
  const number = value.slice(0, dot)
  const given = Buffer.from(value.slice(dot + 1))
  const expected = sign(number)
  if (!expected) return null
  const want = Buffer.from(expected)
  // Unsigned cookies from before this change fail here too, which costs their
  // owners one prefill and a confirmation page reload - nothing else.
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null
  return number
}
