import { describe, expect, it } from "vitest"

import {
  BLOG_CATEGORIES,
  categoryLabel,
  extractHeadings,
  formatPostDate,
  isLive,
  isPostSlug,
  type PortableBlock,
} from "@/features/blog/blog"

const heading = (style: string, text: string, key?: string): PortableBlock => ({
  _type: "block",
  _key: key,
  style,
  children: [{ text }],
})

describe("categoryLabel", () => {
  it("names the categories the Studio offers", () => {
    expect(categoryLabel("helmet-care")).toBe("Helmet care")
    for (const c of BLOG_CATEGORIES) expect(categoryLabel(c.value)).toBe(c.label)
  })

  it("still labels a post filed under a category that is gone, or none", () => {
    expect(categoryLabel("retired-category")).toBe("Blog")
    expect(categoryLabel(undefined)).toBe("Blog")
    expect(categoryLabel(null)).toBe("Blog")
  })
})

describe("extractHeadings", () => {
  it("lists the headings in order, with an anchor each", () => {
    const body = [
      heading("h2", "Why it fades", "a"),
      heading("normal", "Sunlight.", "b"),
      heading("h3", "UV & heat", "c"),
      { _type: "image", _key: "d" },
      heading("h2", "What to do", "e"),
    ]
    expect(extractHeadings(body)).toEqual([
      { key: "a", id: "why-it-fades", text: "Why it fades", level: 2 },
      { key: "c", id: "uv-heat", text: "UV & heat", level: 3 },
      { key: "e", id: "what-to-do", text: "What to do", level: 2 },
    ])
  })

  it("keeps anchors unique when two headings read the same", () => {
    const ids = extractHeadings([
      heading("h2", "Step", "a"),
      heading("h2", "Step", "b"),
      heading("h2", "Step", "c"),
    ]).map((h) => h.id)
    expect(ids).toEqual(["step", "step-2", "step-3"])
  })

  it("joins a heading typed in several runs, and skips an empty one", () => {
    const split: PortableBlock = {
      _type: "block",
      _key: "a",
      style: "h2",
      children: [{ text: "Full" }, { text: "-face " }, { text: "helmets" }],
    }
    expect(extractHeadings([split, heading("h2", "   ", "b")])).toEqual([
      { key: "a", id: "full-face-helmets", text: "Full-face helmets", level: 2 },
    ])
  })

  it("gives a heading of only symbols an anchor all the same", () => {
    expect(extractHeadings([heading("h2", "???", "a")])[0]!.id).toBe("section")
  })

  it("is empty for no body", () => {
    expect(extractHeadings(undefined)).toEqual([])
    expect(extractHeadings([])).toEqual([])
  })
})

describe("formatPostDate", () => {
  it("writes the date out on India's calendar", () => {
    expect(formatPostDate("2026-09-30T06:00:00.000Z")).toBe("30 September 2026")
    // 20:00 UTC on the 30th is already the 1st in India.
    expect(formatPostDate("2026-09-30T20:00:00.000Z")).toBe("1 October 2026")
  })

  it("is empty for a missing or unreadable date", () => {
    expect(formatPostDate(undefined)).toBe("")
    expect(formatPostDate(null)).toBe("")
    expect(formatPostDate("not a date")).toBe("")
  })
})

describe("isLive", () => {
  const now = Date.parse("2026-09-30T06:00:00Z")

  it("is live from its date on, and scheduled before it", () => {
    expect(isLive("2026-09-30T05:59:59Z", now)).toBe(true)
    expect(isLive("2026-09-30T06:00:00Z", now)).toBe(true)
    expect(isLive("2026-09-30T06:00:01Z", now)).toBe(false)
    expect(isLive("2027-01-01T00:00:00Z", now)).toBe(false)
  })

  it("is not live without a date it can read", () => {
    expect(isLive(undefined, now)).toBe(false)
    expect(isLive(null, now)).toBe(false)
    expect(isLive("", now)).toBe(false)
    expect(isLive("next week", now)).toBe(false)
  })
})

describe("isPostSlug", () => {
  it("takes what the Studio's slug field makes", () => {
    for (const slug of ["how-to-clean-a-visor", "5-mistakes", "a", "helmet2"]) {
      expect(isPostSlug(slug), slug).toBe(true)
    }
  })

  it("refuses anything else, so it is never asked of Sanity", () => {
    for (const slug of [
      "",
      "Has-Capitals",
      "two  spaces",
      "-leading",
      "trailing-",
      "double--hyphen",
      "dots.in.it",
      "../etc/passwd",
      "a".repeat(97),
      "%3Cscript%3E",
    ]) {
      expect(isPostSlug(slug), slug).toBe(false)
    }
  })
})
