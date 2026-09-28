import "server-only"

/**
 * What a visitor browses on, read from their user agent.
 *
 * Hand-written rather than a parser dependency: the shop needs a dozen
 * answers, not ten thousand, and the ones that matter here are the ones a
 * general parser gets least right - the Instagram and Facebook in-app
 * browsers most of the shop's traffic arrives in, and Android phones, whose
 * Chrome now reports "Android 10; K" whatever the phone. For those the
 * browser's client hints (model, platform version) are the real answer, and
 * the tracker sends them when it has them.
 */

export type DeviceType = "mobile" | "tablet" | "desktop"

export type Agent = {
  bot: boolean
  deviceType: DeviceType
  deviceModel: string | null
  os: string | null
  browser: string | null
}

export type Hints = {
  /** navigator.userAgentData's model, e.g. "SM-S918B". Chromium on Android only. */
  model?: string
  /** navigator.userAgentData's platformVersion, e.g. "14.0.0" or, on Windows 11, "15.0.0". */
  platformVersion?: string
  /** navigator.maxTouchPoints: an iPad asks for the desktop site as a Mac, but a Mac has no touch. */
  touch?: number
}

/**
 * Crawlers, link previews, uptime checks and scripts. Most never run the
 * tracker's JavaScript at all; the ones that do (Googlebot, Lighthouse,
 * headless browsers) are not people and must not be counted as visitors.
 *
 * Named bots rather than any "bot" anywhere: Cubot is a phone maker, and
 * "CUBOT X30" is a person on a phone.
 */
const BOT =
  /(?:google|bing|yandex|duckduck|baidu|apple|ads|petal|ahrefs|semrush|mj12|dot|byte|gpt|claude|cc|facebook|twitter|linkedin|slack|telegram|discord|amazon|yeti|seznam|sogou|mojeek|qwant)bot|bot\/\d|\bbot\b|crawl|spider|slurp|facebookexternalhit|facebookcatalog|embedly|headless|lighthouse|pagespeed|pingdom|uptime|curl\/|wget|python|axios|node-fetch|undici|go-http|java\/|okhttp|scrapy|phantom|selenium|puppeteer|playwright/i

/** In-app browsers first: they also carry "Chrome" or "Safari", and are the more useful answer. */
const BROWSERS: Array<[RegExp, string]> = [
  [/Instagram/, "Instagram app"],
  [/FBAN|FBAV|FB_IAB|FBIOS/, "Facebook app"],
  [/Snapchat/, "Snapchat app"],
  [/LinkedInApp/, "LinkedIn app"],
  [/Pinterest/, "Pinterest app"],
  [/\bTwitter/, "X app"],
  [/SamsungBrowser\/(\d+)/, "Samsung Internet"],
  [/MiuiBrowser\/(\d+)/, "Mi Browser"],
  [/UCBrowser\/(\d+)/, "UC Browser"],
  [/OPR\/(\d+)|OPiOS\/(\d+)|Opera/, "Opera"],
  [/Edg(?:e|A|iOS)?\/(\d+)/, "Edge"],
  [/YaBrowser\/(\d+)/, "Yandex"],
  [/(?:Firefox|FxiOS)\/(\d+)/, "Firefox"],
  [/; wv\)/, "Android WebView"],
  [/GSA\/(\d+)/, "Google app"],
  [/(?:Chrome|CriOS)\/(\d+)/, "Chrome"],
  [/Version\/(\d+)[\d.]*.*Safari/, "Safari"],
]

function isIpadAsMac(ua: string, hints: Hints): boolean {
  return /Macintosh/.test(ua) && (hints.touch ?? 0) > 1
}

function deviceTypeOf(ua: string, hints: Hints): DeviceType {
  if (/iPad/.test(ua) || isIpadAsMac(ua, hints)) return "tablet"
  // Android phones say "Mobile"; Android tablets do not.
  if (/Android/.test(ua) && !/Mobile/.test(ua)) return "tablet"
  if (/Tablet|PlayBook|Silk|Kindle/.test(ua)) return "tablet"
  if (/Mobi|iPhone|iPod|Android|Windows Phone|Opera Mini|IEMobile/.test(ua)) return "mobile"
  return "desktop"
}

const major = (version: string | undefined) => {
  const n = Number.parseInt(version ?? "", 10)
  return Number.isFinite(n) ? n : null
}

function osOf(ua: string, hints: Hints): string | null {
  const ios = ua.match(/(?:iPhone OS|CPU OS) (\d+)[_.](\d+)/)
  if (ios) return `${/iPad/.test(ua) ? "iPadOS" : "iOS"} ${ios[1]}.${ios[2]}`
  if (isIpadAsMac(ua, hints)) return "iPadOS"

  const android = ua.match(/Android (\d+(?:\.\d+)?)/)
  if (android) {
    const real = major(hints.platformVersion)
    if (real) return `Android ${real}`
    // Chrome's reduced user agent: every Android phone is "Android 10; K".
    if (/Android 10; K\)/.test(ua)) return "Android"
    return `Android ${android[1]}`
  }

  if (/Windows NT 10\.0/.test(ua)) {
    const v = major(hints.platformVersion)
    if (v === null) return "Windows 10/11"
    return v >= 13 ? "Windows 11" : "Windows 10"
  }
  if (/Windows NT 6\.3/.test(ua)) return "Windows 8.1"
  if (/Windows NT 6\.[12]/.test(ua)) return "Windows 7/8"
  if (/Windows/.test(ua)) return "Windows"
  if (/CrOS/.test(ua)) return "ChromeOS"
  // Frozen at 10.15.7 by every browser, so the version says nothing.
  if (/Mac OS X/.test(ua)) return "macOS"
  if (/Linux/.test(ua)) return "Linux"
  return null
}

function browserOf(ua: string): string | null {
  for (const [pattern, name] of BROWSERS) {
    const m = ua.match(pattern)
    if (!m) continue
    const version = m.slice(1).find(Boolean)
    return version ? `${name} ${version}` : name
  }
  return null
}

function modelOf(ua: string, hints: Hints): string | null {
  if (hints.model?.trim()) return hints.model.trim()
  if (/iPhone/.test(ua)) return "iPhone"
  if (/iPad/.test(ua) || isIpadAsMac(ua, hints)) return "iPad"

  // The Instagram app writes the whole phone into its user agent:
  // "Instagram 300.0 Android (33/13; 420dpi; 1080x2340; samsung; SM-S911B; ...".
  const insta = ua.match(/Instagram [\d.]+ Android \([^;]+;[^;]+;[^;]+; ([^;]+); ([^;]+);/)
  if (insta) return `${insta[1]!.trim()} ${insta[2]!.trim()}`

  // So does the Facebook app, as FBMF (maker) and FBDV (model).
  const fbModel = ua.match(/FBDV\/([^;\]]+)/)?.[1]
  if (fbModel) {
    const maker = ua.match(/FBMF\/([^;\]]+)/)?.[1]
    return maker && !fbModel.toLowerCase().startsWith(maker.toLowerCase())
      ? `${maker} ${fbModel}`
      : fbModel
  }

  // Browsers that still send the full Android string: "Android 13; SM-S911B)".
  const android = ua.match(/Android [\d.]+; ([^;)]+?)(?: Build\/[^;)]*)?\)/)
  if (android && android[1] !== "K") return android[1]!.trim()

  if (/Macintosh/.test(ua)) return "Mac"
  return null
}

export function describeAgent(ua: string | null | undefined, hints: Hints = {}): Agent {
  const agent = (ua ?? "").trim()
  if (!agent || BOT.test(agent)) {
    return { bot: true, deviceType: "desktop", deviceModel: null, os: null, browser: null }
  }
  return {
    bot: false,
    deviceType: deviceTypeOf(agent, hints),
    deviceModel: modelOf(agent, hints),
    os: osOf(agent, hints),
    browser: browserOf(agent),
  }
}
