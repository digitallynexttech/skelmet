import "server-only"

import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

/**
 * Proof that this browser placed the order: order numbers are guessable, and
 * the confirmation page and prefill show personal details. The value is the
 * number plus an HMAC under AUTH_SECRET, so it cannot be forged. `lax` so it
 * survives the redirect back from the payment gateway.
 */
const COOKIE = "skm.recent-order"

const MAX_AGE_SECONDS = 60 * 60 * 24 * 7

function sign(number: string): string | null {
  const secret = process.env.AUTH_SECRET
  if (!secret) return null
  return createHmac("sha256", secret).update(`recent-order:${number}`).digest("base64url")
}

export async function rememberOrder(number: string): Promise<void> {
  const signature = sign(number)
  // No secret: remember nothing rather than something forgeable.
  if (!signature) return
  const jar = await cookies()
  jar.set(COOKIE, `${number}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    // By the site's scheme, not NODE_ENV: browsers drop a Secure cookie on plain http.
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
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null
  return number
}
