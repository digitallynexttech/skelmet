import "server-only"

import { cookies } from "next/headers"

// Only for a visitor who accepted; cleared when they take it back. Holds a random
// UUID only, and nothing reads visitor details back to a browser, so a forged value
// can only add page views. Set server-side: Safari caps document.cookie at 7 days.
const COOKIE = "skm.vid"

/** A year from the last visit. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function visitorCookie(): Promise<string | null> {
  const value = (await cookies()).get(COOKIE)?.value
  return value && UUID.test(value) ? value : null
}

export async function keepVisitorCookie(id: string): Promise<void> {
  const jar = await cookies()
  jar.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    // A Secure cookie is silently dropped on plain http.
    secure: (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  })
}

export async function dropVisitorCookie(): Promise<void> {
  const jar = await cookies()
  jar.delete(COOKIE)
}
