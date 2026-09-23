import "server-only"

import { cookies } from "next/headers"

/**
 * Proof that the browser asking about an order is the one that placed it.
 *
 * `SKM-YYYY-XXXX` is roughly a million numbers a year drawn from a 32-letter
 * alphabet, which makes an order number a short, guessable key rather than a
 * secret. The confirmation page shows an email address and a total, and its
 * visitors are usually guests with no session to check — so without this
 * cookie, every customer's contact details would sit one lucky typo away.
 *
 * httpOnly so a script on the page cannot read it back out, and `lax` so it
 * still arrives on the redirect out of the payment gateway.
 */
const COOKIE = "skm.recent-order"

/** A week: long enough to refresh the tab tomorrow, short enough to expire. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export async function rememberOrder(number: string): Promise<void> {
  const jar = await cookies()
  jar.set(COOKIE, number, {
    httpOnly: true,
    sameSite: "lax",
    // Keyed on the deployment's real scheme, NOT NODE_ENV. A Secure cookie is
    // silently DROPPED by the browser on a plain-http origin — localhost is
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
  return jar.get(COOKIE)?.value ?? null
}
