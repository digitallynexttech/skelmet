import "server-only"

import { cookies } from "next/headers"

/**
 * The cookie that recognises a device that accepted cookies, set only after
 * they tapped Accept and cleared when they take it back.
 *
 * It holds the visitor's id and nothing else. The id is a random UUID, so it
 * cannot be guessed, and nothing on the site ever reads a visitor's details
 * back out to a browser - so a copied or forged value can at most write page
 * views into a record nobody else can see.
 *
 * httpOnly, because no script on the page has any use for it. Set by the
 * server rather than document.cookie, which Safari cuts to seven days.
 */
const COOKIE = "skm.vid"

/** A year. Refreshed on every visit, so it lapses a year after the last one. */
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
    // Keyed on the deployment's real scheme, as the order cookie is: a Secure
    // cookie is silently dropped on a plain-http origin.
    secure: (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  })
}

export async function dropVisitorCookie(): Promise<void> {
  const jar = await cookies()
  jar.delete(COOKIE)
}
