import { describe, expect, it } from "vitest"

import { describeAgent } from "@/features/visitors/server/user-agent"

// Real user agents from the shop's traffic.

const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36"
const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
const INSTAGRAM_ANDROID =
  "Mozilla/5.0 (Linux; Android 13; SM-S911B Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/127.0.6533.103 Mobile Safari/537.36 Instagram 343.0.0.34.99 Android (33/13; 420dpi; 1080x2340; samsung; SM-S911B; dm1q; qcom; en_IN; 628449711)"
const FACEBOOK_ANDROID =
  "Mozilla/5.0 (Linux; Android 12; RMX3371 Build/SKQ1.210216.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.122 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/474.0.0.52.74;FBMF/realme;FBDV/RMX3371;]"
const SAMSUNG_INTERNET =
  "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36"
const WINDOWS_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"
const ANDROID_TABLET =
  "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"

describe("describeAgent", () => {
  it("reads Android Chrome's real phone and version from the client hints", () => {
    expect(describeAgent(ANDROID_CHROME, { model: "SM-S918B", platformVersion: "14.0.0" })).toEqual(
      {
        bot: false,
        deviceType: "mobile",
        deviceModel: "SM-S918B",
        os: "Android 14",
        browser: "Chrome 128",
      },
    )
  })

  it("does not believe the frozen 'Android 10; K' when there are no hints", () => {
    const agent = describeAgent(ANDROID_CHROME)
    expect(agent.os).toBe("Android")
    expect(agent.deviceModel).toBeNull()
  })

  it("reads an iPhone", () => {
    expect(describeAgent(IPHONE_SAFARI)).toMatchObject({
      deviceType: "mobile",
      deviceModel: "iPhone",
      os: "iOS 17.5",
      browser: "Safari 17",
    })
  })

  it("names the Instagram app, and the phone it writes into its user agent", () => {
    expect(describeAgent(INSTAGRAM_ANDROID)).toMatchObject({
      deviceType: "mobile",
      deviceModel: "samsung SM-S911B",
      os: "Android 13",
      browser: "Instagram app",
    })
  })

  it("names the Facebook app, and its maker and model", () => {
    expect(describeAgent(FACEBOOK_ANDROID)).toMatchObject({
      deviceModel: "realme RMX3371",
      browser: "Facebook app",
    })
  })

  it("reads Samsung Internet, which still sends the model", () => {
    expect(describeAgent(SAMSUNG_INTERNET)).toMatchObject({
      deviceModel: "SAMSUNG SM-A546E",
      os: "Android 14",
      browser: "Samsung Internet 25",
    })
  })

  it("tells Windows 11 from 10 only when the hints say which", () => {
    expect(describeAgent(WINDOWS_CHROME).os).toBe("Windows 10/11")
    expect(describeAgent(WINDOWS_CHROME, { platformVersion: "15.0.0" }).os).toBe("Windows 11")
    expect(describeAgent(WINDOWS_CHROME, { platformVersion: "10.0.0" }).os).toBe("Windows 10")
    expect(describeAgent(WINDOWS_CHROME).deviceType).toBe("desktop")
  })

  it("sees an iPad asking for the desktop site by its touch screen", () => {
    expect(describeAgent(MAC_SAFARI).deviceType).toBe("desktop")
    expect(describeAgent(MAC_SAFARI, { touch: 5 })).toMatchObject({
      deviceType: "tablet",
      deviceModel: "iPad",
      os: "iPadOS",
    })
  })

  it("calls an Android without 'Mobile' a tablet", () => {
    expect(describeAgent(ANDROID_TABLET).deviceType).toBe("tablet")
  })

  it("marks crawlers, headless browsers and scripts as bots", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/128.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36 Chrome-Lighthouse",
      "curl/8.4.0",
      "",
    ]) {
      expect(describeAgent(ua).bot, ua).toBe(true)
    }
  })

  it("does not mistake a Cubot phone for a bot", () => {
    const cubot =
      "Mozilla/5.0 (Linux; Android 12; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36"
    expect(describeAgent(cubot).bot).toBe(false)
  })
})
