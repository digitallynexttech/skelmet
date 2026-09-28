import { describe, expect, it } from "vitest"

import { arrivalOf, cleanPath } from "@/features/visitors/server/attribution"

describe("arrivalOf", () => {
  const own = "skelmet.in"

  it("takes campaign tags over everything else", () => {
    expect(
      arrivalOf({
        path: "/product/flame-skull-mount?utm_source=Instagram&utm_medium=paid&utm_campaign=diwali",
        referrer: "https://www.google.com/",
        ownHost: own,
      }),
    ).toEqual({
      referrer: "https://www.google.com/",
      source: "instagram",
      medium: "paid",
      campaign: "diwali",
    })
  })

  it("knows a Google ad by its click id, untagged", () => {
    expect(arrivalOf({ path: "/?gclid=abc", ownHost: own })).toMatchObject({
      source: "google",
      medium: "cpc",
    })
  })

  it("tells Instagram from Facebook on an fbclid link", () => {
    expect(
      arrivalOf({ path: "/?fbclid=x", referrer: "https://l.instagram.com/", ownHost: own }).source,
    ).toBe("instagram")
    expect(
      arrivalOf({ path: "/?fbclid=x", referrer: "https://lm.facebook.com/", ownHost: own }).source,
    ).toBe("facebook")
  })

  it("reads search engines and social sites from the referrer", () => {
    expect(
      arrivalOf({ path: "/", referrer: "https://www.google.co.in/", ownHost: own }),
    ).toMatchObject({ source: "google", medium: "organic" })
    expect(
      arrivalOf({ path: "/", referrer: "https://m.youtube.com/watch", ownHost: own }),
    ).toMatchObject({ source: "youtube", medium: "social" })
  })

  it("reads the app an Android link was opened from", () => {
    expect(
      arrivalOf({ path: "/", referrer: "android-app://com.whatsapp/", ownHost: own }),
    ).toMatchObject({
      source: "whatsapp",
      medium: "social",
      referrer: "android-app://com.whatsapp",
    })
  })

  it("keeps any other site as a referral, without its query string", () => {
    expect(
      arrivalOf({
        path: "/",
        referrer: "https://bikeforum.in/thread/42?session=secret",
        ownHost: own,
      }),
    ).toEqual({
      referrer: "https://bikeforum.in/thread/42",
      source: "bikeforum.in",
      medium: "referral",
      campaign: null,
    })
  })

  it("does not count moving between the shop's own pages as an arrival", () => {
    expect(
      arrivalOf({ path: "/cart", referrer: "https://www.skelmet.in/product/x", ownHost: own })
        .source,
    ).toBe("direct")
  })

  it("falls back to the in-app browser when there is no referrer", () => {
    const insta = "Mozilla/5.0 (Linux; Android 13) Instagram 343.0.0.34.99 Android"
    expect(arrivalOf({ path: "/", ownHost: own, userAgent: insta }).source).toBe("instagram")
    expect(arrivalOf({ path: "/", ownHost: own }).source).toBe("direct")
  })
})

describe("cleanPath", () => {
  it("keeps what was looked at and the campaign tags, and nothing else", () => {
    expect(cleanPath("/checkout/thank-you?order=SKM-2026-ABCD&email=a@b.in&utm_source=ig")).toBe(
      "/checkout/thank-you?utm_source=ig",
    )
    expect(cleanPath("/product/flame-skull-mount?colourway=olive")).toBe(
      "/product/flame-skull-mount?colourway=olive",
    )
  })

  it("keeps only the path of a full address", () => {
    expect(cleanPath("https://evil.example/somewhere?x=1")).toBe("/somewhere")
  })
})
