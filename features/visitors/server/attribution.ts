import "server-only"

/**
 * Where a visit came from, and how a page's address is kept.
 *
 * The source is decided once, on the page a visit lands on: campaign tags
 * win, then an ad network's click id, then the referring site, then the
 * in-app browser a link was opened in. Only then is it "direct".
 */

export type Arrival = {
  /** The referring page, without its query string. */
  referrer: string | null
  /** "instagram", "google", "direct", or whatever utm_source says. */
  source: string
  /** "social", "organic", "cpc", "referral", "email", or utm_medium. */
  medium: string | null
  campaign: string | null
}

/**
 * Query parameters kept on a stored path: what was being looked at, and the
 * campaign tags. Anything else - an order number, an email typed into a form
 * that submits by GET - is dropped rather than kept by accident.
 */
const KEPT_PARAMS = new Set([
  "colourway",
  "buy",
  "qty",
  "topic",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
])

const BASE = "https://skelmet.invalid"

export function cleanPath(raw: string): string {
  let url: URL
  try {
    url = new URL(raw, BASE)
  } catch {
    return "/"
  }
  const kept = new URLSearchParams()
  for (const [key, value] of url.searchParams) {
    if (KEPT_PARAMS.has(key)) kept.append(key, value.slice(0, 100))
  }
  const query = kept.toString()
  return (url.pathname.slice(0, 200) || "/") + (query ? `?${query}` : "")
}

const SEARCH: Array<[RegExp, string]> = [
  [/(^|\.)google\./, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
  [/(^|\.)yahoo\./, "yahoo"],
  [/(^|\.)yandex\./, "yandex"],
  [/(^|\.)ecosia\.org$/, "ecosia"],
]

const SOCIAL: Array<[RegExp, string]> = [
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "facebook"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, "x"],
  [/(^|\.)(whatsapp\.com|wa\.me)$/, "whatsapp"],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, "linkedin"],
  [/(^|\.)reddit\.com$/, "reddit"],
  [/(^|\.)pinterest\./, "pinterest"],
  [/(^|\.)snapchat\.com$/, "snapchat"],
  [/(^|\.)threads\.net$/, "threads"],
  [/(^|\.)(telegram\.org|telegram\.me|t\.me)$/, "telegram"],
]

/** Android apps open links with their package name as the referrer. */
const APPS: Record<string, [source: string, medium: string]> = {
  "com.instagram.android": ["instagram", "social"],
  "com.facebook.katana": ["facebook", "social"],
  "com.facebook.orca": ["messenger", "social"],
  "com.whatsapp": ["whatsapp", "social"],
  "com.whatsapp.w4b": ["whatsapp", "social"],
  "com.google.android.gm": ["gmail", "email"],
  "com.google.android.googlequicksearchbox": ["google", "organic"],
  "com.google.android.youtube": ["youtube", "social"],
  "org.telegram.messenger": ["telegram", "social"],
  "com.linkedin.android": ["linkedin", "social"],
  "com.twitter.android": ["x", "social"],
}

type Referrer = { url: string; host: string; app: string | null }

function parseReferrer(raw: string | null | undefined, ownHost: string | null | undefined) {
  if (!raw) return null
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol === "android-app:") {
    const app = url.hostname.toLowerCase()
    return app ? ({ url: `android-app://${app}`, host: app, app } satisfies Referrer) : null
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null
  const bare = (h: string) => h.toLowerCase().replace(/^www\./, "")
  const host = bare(url.hostname)
  // Moving between the shop's own pages is not an arrival.
  if (ownHost && host === bare(ownHost.split(":")[0] ?? "")) return null
  return { url: `${url.origin}${url.pathname}`.slice(0, 300), host, app: null } satisfies Referrer
}

export function arrivalOf(input: {
  path: string
  referrer?: string | null
  ownHost?: string | null
  userAgent?: string | null
}): Arrival {
  let params: URLSearchParams
  try {
    params = new URL(input.path, BASE).searchParams
  } catch {
    params = new URLSearchParams()
  }
  const tag = (key: string) => params.get(key)?.trim().toLowerCase().slice(0, 100) || null
  const ua = input.userAgent ?? ""
  const ref = parseReferrer(input.referrer, input.ownHost)
  const referrer = ref?.url ?? null

  const utmSource = tag("utm_source")
  if (utmSource) {
    return { referrer, source: utmSource, medium: tag("utm_medium"), campaign: tag("utm_campaign") }
  }

  // Ad clicks carry the network's click id even when nobody tagged the link.
  if (params.has("gclid") || params.has("gbraid") || params.has("wbraid")) {
    return { referrer, source: "google", medium: "cpc", campaign: null }
  }
  if (params.has("msclkid")) return { referrer, source: "bing", medium: "cpc", campaign: null }
  if (params.has("fbclid")) {
    const insta = ref?.host.includes("instagram") || /Instagram/.test(ua)
    return { referrer, source: insta ? "instagram" : "facebook", medium: "social", campaign: null }
  }

  if (ref) {
    if (ref.app) {
      const [source, medium] = APPS[ref.app] ?? [ref.app, "app"]
      return { referrer, source, medium, campaign: null }
    }
    for (const [pattern, source] of SEARCH) {
      if (pattern.test(ref.host)) return { referrer, source, medium: "organic", campaign: null }
    }
    for (const [pattern, source] of SOCIAL) {
      if (pattern.test(ref.host)) return { referrer, source, medium: "social", campaign: null }
    }
    return { referrer, source: ref.host, medium: "referral", campaign: null }
  }

  // No referrer, but the app whose browser the page opened in gives it away.
  if (/Instagram/.test(ua))
    return { referrer, source: "instagram", medium: "social", campaign: null }
  if (/FBAN|FBAV|FB_IAB/.test(ua)) {
    return { referrer, source: "facebook", medium: "social", campaign: null }
  }

  return { referrer: null, source: "direct", medium: null, campaign: null }
}
