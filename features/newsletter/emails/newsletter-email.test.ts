import { describe, expect, it } from "vitest"

import { renderNewsletter, unsubscribeHeaders } from "@/features/newsletter/emails/newsletter-email"

const base = {
  subject: "The Ghost Grey drop",
  body: "Hey rider,\n\nThe grey one is here.\nSee https://www.skelmet.in/product/flame-skull-mount.",
  unsubscribeUrl: "https://www.skelmet.in/unsubscribe?token=abc",
}

describe("renderNewsletter", () => {
  it("keeps the subject as written", () => {
    expect(renderNewsletter(base).subject).toBe("The Ghost Grey drop")
  })

  it("carries the unsubscribe link in both parts", () => {
    const m = renderNewsletter(base)
    expect(m.text).toContain("Unsubscribe: https://www.skelmet.in/unsubscribe?token=abc")
    expect(m.html).toContain('href="https://www.skelmet.in/unsubscribe?token=abc"')
  })

  it("makes paragraphs of blank lines and links of web addresses, leaving the full stop out", () => {
    const { html } = renderNewsletter(base)
    expect(html.match(/<p style/g)).toHaveLength(2)
    expect(html).toContain('href="https://www.skelmet.in/product/flame-skull-mount"')
    expect(html).not.toContain('flame-skull-mount."')
  })

  it("adds the button only when there is a link, with a label if none was given", () => {
    expect(renderNewsletter(base).html).not.toContain("Take a look")
    const m = renderNewsletter({
      ...base,
      ctaUrl: "https://www.skelmet.in/product/flame-skull-mount",
    })
    expect(m.html).toContain("Take a look")
    expect(m.text).toContain("Take a look: https://www.skelmet.in/product/flame-skull-mount")
  })

  it("escapes what staff typed", () => {
    const m = renderNewsletter({
      ...base,
      subject: "<script>x</script>",
      body: "<b>bold</b> claim",
    })
    expect(m.html).not.toContain("<script>x</script>")
    expect(m.html).not.toContain("<b>bold</b>")
    expect(m.html).toContain("&lt;b&gt;bold&lt;/b&gt;")
  })
})

describe("unsubscribeHeaders", () => {
  it("offers one-click unsubscribe to mail clients (RFC 8058)", () => {
    expect(
      unsubscribeHeaders("https://www.skelmet.in/api/public/newsletter/unsubscribe?token=abc"),
    ).toEqual({
      "List-Unsubscribe": "<https://www.skelmet.in/api/public/newsletter/unsubscribe?token=abc>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    })
  })
})
