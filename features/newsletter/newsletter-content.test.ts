import { describe, expect, it } from "vitest"

import {
  docFromText,
  docToHtml,
  docToText,
  isDocEmpty,
  newsletterDocSchema,
  type NewsletterDoc,
} from "@/features/newsletter/newsletter-content"

/**
 * The editor's document is the only thing the email is built from, so the
 * schema is the line between what staff type and what lands in every inbox:
 * it must admit what the editor makes and nothing else.
 */

const IMG =
  "https://www.skelmet.in/api/public/newsletter/images/0b6f7f3e-4c1a-4d8e-9a55-1f2e3d4c5b6a"

const doc = (...content: unknown[]) => ({ type: "doc", content })
const p = (...content: unknown[]) => ({ type: "paragraph", content })
const text = (t: string, marks?: unknown[]) => ({
  type: "text",
  text: t,
  ...(marks ? { marks } : {}),
})

describe("newsletterDocSchema", () => {
  it("takes what the editor makes", () => {
    const made = doc(
      { type: "heading", attrs: { level: 2 }, content: [text("It's here")] },
      p(
        text("Bold", [{ type: "bold" }]),
        { type: "hardBreak" },
        text("shop", [
          {
            type: "link",
            attrs: {
              href: "https://www.skelmet.in",
              target: "_blank",
              rel: "noopener",
              class: null,
            },
          },
        ]),
      ),
      { type: "bulletList", content: [{ type: "listItem", content: [p(text("one"))] }] },
      {
        type: "orderedList",
        attrs: { start: 1, type: null },
        content: [{ type: "listItem", content: [p(text("two"))] }],
      },
      { type: "blockquote", content: [p(text("quoted"))] },
      { type: "horizontalRule" },
      {
        type: "image",
        attrs: { src: IMG, alt: "Ghost Grey", title: null, width: 1200, height: 900 },
      },
    )
    expect(newsletterDocSchema.safeParse(made).success).toBe(true)
  })

  it("drops attributes it does not know, such as a link's target", () => {
    const parsed = newsletterDocSchema.parse(
      doc(p(text("x", [{ type: "link", attrs: { href: "https://a.in", target: "_blank" } }]))),
    )
    expect(JSON.stringify(parsed)).not.toContain("_blank")
  })

  it("refuses a node the editor does not offer", () => {
    expect(
      newsletterDocSchema.safeParse(doc({ type: "codeBlock", content: [text("x")] })).success,
    ).toBe(false)
    expect(newsletterDocSchema.safeParse(doc({ type: "script", text: "alert(1)" })).success).toBe(
      false,
    )
  })

  it("refuses a javascript: link", () => {
    const bad = doc(p(text("x", [{ type: "link", attrs: { href: "javascript:alert(1)" } }])))
    expect(newsletterDocSchema.safeParse(bad).success).toBe(false)
  })

  it("refuses a picture that was not uploaded here", () => {
    const hotlinked = doc({ type: "image", attrs: { src: "https://tracker.example/pixel.gif" } })
    const inlined = doc({ type: "image", attrs: { src: "data:image/png;base64,AAAA" } })
    expect(newsletterDocSchema.safeParse(hotlinked).success).toBe(false)
    expect(newsletterDocSchema.safeParse(inlined).success).toBe(false)
  })

  it("refuses an empty message, but a picture alone is a message", () => {
    expect(newsletterDocSchema.safeParse(doc({ type: "paragraph" })).success).toBe(false)
    expect(newsletterDocSchema.safeParse(doc(p(text("   ")))).success).toBe(false)
    expect(newsletterDocSchema.safeParse(doc({ type: "image", attrs: { src: IMG } })).success).toBe(
      true,
    )
  })
})

describe("docToHtml", () => {
  it("escapes text, whatever was pasted", () => {
    const html = docToHtml(doc(p(text("<img src=x onerror=alert(1)>"))) as NewsletterDoc)
    expect(html).not.toContain("<img src=x")
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;")
  })

  it("writes marks and links with inline styles", () => {
    const html = docToHtml(
      doc(
        p(
          text("go", [
            { type: "bold" },
            { type: "link", attrs: { href: "https://www.skelmet.in/a?b=1&c=2" } },
          ]),
        ),
      ) as NewsletterDoc,
    )
    expect(html).toMatch(
      /<a href="https:\/\/www\.skelmet\.in\/a\?b=1&amp;c=2" style="[^"]+"><strong/,
    )
  })

  it("serves pictures from this site and never draws them wider than the card", () => {
    const wide = docToHtml(
      doc({ type: "image", attrs: { src: IMG, width: 1200 } }) as NewsletterDoc,
    )
    expect(wide).toContain('width="544"')
    const small = docToHtml(
      doc({ type: "image", attrs: { src: IMG, width: 300 } }) as NewsletterDoc,
    )
    expect(small).toContain('width="300"')
    // The id is kept, the host is this site's own, not whatever the editor saw.
    expect(wide).toContain("/api/public/newsletter/images/0b6f7f3e-4c1a-4d8e-9a55-1f2e3d4c5b6a")
  })

  it("numbers an ordered list from where it starts", () => {
    const html = docToHtml(
      doc({
        type: "orderedList",
        attrs: { start: 3 },
        content: [{ type: "listItem", content: [p(text("c"))] }],
      }) as NewsletterDoc,
    )
    expect(html).toContain('<ol start="3"')
  })
})

describe("docToText", () => {
  it("reads as plain text, links spelled out", () => {
    const t = docToText(
      doc(
        { type: "heading", attrs: { level: 2 }, content: [text("New drop")] },
        p(
          text("See "),
          text("the shop", [{ type: "link", attrs: { href: "https://www.skelmet.in" } }]),
        ),
        {
          type: "bulletList",
          content: [
            { type: "listItem", content: [p(text("one"))] },
            { type: "listItem", content: [p(text("two"))] },
          ],
        },
        { type: "image", attrs: { src: IMG, alt: "Ghost Grey" } },
      ) as NewsletterDoc,
    )
    expect(t).toBe(
      "New drop\n\nSee the shop (https://www.skelmet.in)\n\n- one\n- two\n\n[Image: Ghost Grey]",
    )
  })
})

describe("docFromText", () => {
  it("turns blank lines into paragraphs and single ones into breaks", () => {
    const d = docFromText("one\ntwo\n\nthree")
    expect(d.content).toHaveLength(2)
    expect(docToText(d)).toBe("one\ntwo\n\nthree")
    expect(isDocEmpty(docFromText("  "))).toBe(true)
  })
})
