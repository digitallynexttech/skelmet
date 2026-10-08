import { z } from "zod"

import { siteConfig } from "@/config/site"
import { C, escapeHtml, FONT } from "@/features/orders/emails/email-theme"

/**
 * The editor's (TipTap) JSON document is what is stored and sent, never HTML. The schema admits
 * only the editor's nodes, http(s)/mailto links and images uploaded here, so the email is built
 * from a whitelist. Inline styles throughout: mail clients drop stylesheets. Client-safe, so the
 * console preview renders the same HTML.
 */

export type Mark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "underline" }
  | { type: "strike" }
  | { type: "link"; attrs: { href: string } }

export type InlineNode = { type: "text"; text: string; marks?: Mark[] } | { type: "hardBreak" }

export type ListItem = { type: "listItem"; content: BlockNode[] }

export type BlockNode =
  | { type: "paragraph"; content?: InlineNode[] }
  | { type: "heading"; attrs: { level: number }; content?: InlineNode[] }
  | { type: "bulletList"; content: ListItem[] }
  | { type: "orderedList"; attrs?: { start?: number | null }; content: ListItem[] }
  | { type: "blockquote"; content: BlockNode[] }
  | { type: "horizontalRule" }
  | {
      type: "image"
      attrs: { src: string; alt?: string | null; width?: number | null; height?: number | null }
    }

export type NewsletterDoc = { type: "doc"; content: BlockNode[] }

export const NEWSLETTER_IMAGE_PATH = "/api/public/newsletter/images/"

const IMAGE_SRC =
  /\/api\/public\/newsletter\/images\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

/** Always on siteConfig.url, whatever host the editor saw. */
export function newsletterImageUrl(id: string): string {
  return `${siteConfig.url}${NEWSLETTER_IMAGE_PATH}${id}`
}

export function imageIdFromSrc(src: string): string | null {
  return IMAGE_SRC.exec(src)?.[1] ?? null
}

/** Widest an image is drawn in the email: the 600px card less its padding. */
export const EMAIL_IMAGE_WIDTH = 544

// -- The schema -------------------------------------------------------------

const href = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => /^(https?:\/\/|mailto:)/i.test(v), "Links must start with https:// or mailto:")

const markSchema: z.ZodType<Mark> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }),
  z.object({ type: z.literal("italic") }),
  z.object({ type: z.literal("underline") }),
  z.object({ type: z.literal("strike") }),
  z.object({ type: z.literal("link"), attrs: z.object({ href }) }),
])

const inlineSchema: z.ZodType<InlineNode> = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("text"),
    text: z.string().max(5000),
    marks: z.array(markSchema).max(8).optional(),
  }),
  z.object({ type: z.literal("hardBreak") }),
])

const listItemSchema: z.ZodType<ListItem> = z.lazy(() =>
  z.object({ type: z.literal("listItem"), content: z.array(blockSchema).max(20) }),
)

const blockSchema: z.ZodType<BlockNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("paragraph"), content: z.array(inlineSchema).max(500).optional() }),
    z.object({
      type: z.literal("heading"),
      attrs: z.object({ level: z.number().int().min(1).max(3) }),
      content: z.array(inlineSchema).max(500).optional(),
    }),
    z.object({ type: z.literal("bulletList"), content: z.array(listItemSchema).max(100) }),
    z.object({
      type: z.literal("orderedList"),
      attrs: z.object({ start: z.number().int().min(0).max(10_000).nullish() }).optional(),
      content: z.array(listItemSchema).max(100),
    }),
    z.object({ type: z.literal("blockquote"), content: z.array(blockSchema).max(50) }),
    z.object({ type: z.literal("horizontalRule") }),
    z.object({
      type: z.literal("image"),
      attrs: z.object({
        src: z
          .string()
          .max(500)
          .refine((v) => IMAGE_SRC.test(v), "Upload images through the editor"),
        alt: z.string().max(300).nullish(),
        width: z.number().int().positive().max(4000).nullish(),
        height: z.number().int().positive().max(4000).nullish(),
      }),
    }),
  ]),
)

/** Also capped at 200 KB of JSON as a whole. */
export const newsletterDocSchema = z
  .object({ type: z.literal("doc"), content: z.array(blockSchema).max(300) })
  .refine((doc) => JSON.stringify(doc).length <= 200_000, "That message is too long")
  .refine((doc) => !isDocEmpty(doc), "Write a little more")

// -- Reading it -------------------------------------------------------------

function inlineText(nodes: InlineNode[] | undefined): string {
  return (nodes ?? []).map((n) => (n.type === "text" ? n.text : "\n")).join("")
}

/** Nothing typed and no picture: the editor's empty state is one bare paragraph. */
export function isDocEmpty(doc: NewsletterDoc): boolean {
  const walk = (nodes: BlockNode[]): boolean =>
    nodes.some((n) => {
      if (n.type === "image") return true
      if (n.type === "paragraph" || n.type === "heading") return inlineText(n.content).trim() !== ""
      if (n.type === "bulletList" || n.type === "orderedList")
        return n.content.some((li) => walk(li.content))
      if (n.type === "blockquote") return walk(n.content)
      return false
    })
  return !walk(doc.content)
}

/** A plain-text message (from before the editor) as a document. */
export function docFromText(text: string): NewsletterDoc {
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
  return {
    type: "doc",
    content: paragraphs.map((p) => ({
      type: "paragraph",
      content: p
        .split("\n")
        .flatMap((line, i): InlineNode[] => [
          ...(i > 0 ? [{ type: "hardBreak" } as const] : []),
          ...(line ? [{ type: "text" as const, text: line }] : []),
        ]),
    })),
  }
}

// -- As plain text, for the email's text part and the console's history -----

function textInline(nodes: InlineNode[] | undefined): string {
  return (nodes ?? [])
    .map((n) => {
      if (n.type === "hardBreak") return "\n"
      const link = n.marks?.find((m) => m.type === "link")
      return link && link.attrs.href !== n.text ? `${n.text} (${link.attrs.href})` : n.text
    })
    .join("")
}

function textBlocks(nodes: BlockNode[]): string[] {
  return nodes.flatMap((n): string[] => {
    switch (n.type) {
      case "paragraph":
      case "heading": {
        const t = textInline(n.content).trim()
        return t ? [t] : []
      }
      case "bulletList":
      case "orderedList": {
        const start = n.type === "orderedList" ? (n.attrs?.start ?? 1) : 1
        return [
          n.content
            .map((li, i) => {
              const bullet = n.type === "orderedList" ? `${start + i}. ` : "- "
              return bullet + textBlocks(li.content).join("\n").replace(/\n/g, "\n  ")
            })
            .join("\n"),
        ]
      }
      case "blockquote":
        return [
          textBlocks(n.content)
            .join("\n\n")
            .split("\n")
            .map((line) => `> ${line}`)
            .join("\n"),
        ]
      case "horizontalRule":
        return ["----"]
      case "image":
        return [n.attrs.alt ? `[Image: ${n.attrs.alt}]` : "[Image]"]
    }
  })
}

export function docToText(doc: NewsletterDoc): string {
  return textBlocks(doc.content).join("\n\n")
}

// -- As email HTML ------------------------------------------------------------

const TEXT = `font-family:${FONT};font-size:15.5px;line-height:1.65;color:${C.ash};`

function htmlInline(nodes: InlineNode[] | undefined): string {
  return (nodes ?? [])
    .map((n) => {
      if (n.type === "hardBreak") return "<br>"
      let out = escapeHtml(n.text)
      const marks = n.marks ?? []
      if (marks.some((m) => m.type === "bold"))
        out = `<strong style="color:${C.bone};">${out}</strong>`
      if (marks.some((m) => m.type === "italic")) out = `<em>${out}</em>`
      if (marks.some((m) => m.type === "underline")) out = `<u>${out}</u>`
      if (marks.some((m) => m.type === "strike")) out = `<s>${out}</s>`
      const link = marks.find((m) => m.type === "link")
      if (link) {
        out = `<a href="${escapeHtml(link.attrs.href)}" style="color:${C.blaze};text-decoration:underline;">${out}</a>`
      }
      return out
    })
    .join("")
}

/** `tight` is inside a list item, where a paragraph's bottom margin would double the gap. */
function htmlBlocks(nodes: BlockNode[], tight = false): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case "paragraph": {
          const inner = htmlInline(n.content)
          return `<p style="margin:0 0 ${tight ? 4 : 16}px;${TEXT}">${inner || "&nbsp;"}</p>`
        }
        case "heading": {
          const big = n.attrs.level <= 2
          return `<h${big ? 2 : 3} style="margin:${big ? 26 : 20}px 0 10px;font-family:${FONT};font-size:${big ? 19 : 16.5}px;line-height:1.3;font-weight:800;color:${C.bone};">${htmlInline(n.content)}</h${big ? 2 : 3}>`
        }
        case "bulletList":
        case "orderedList": {
          const tag = n.type === "bulletList" ? "ul" : "ol"
          const start =
            n.type === "orderedList" && n.attrs?.start && n.attrs.start !== 1
              ? ` start="${n.attrs.start}"`
              : ""
          const items = n.content
            .map((li) => `<li style="margin:0 0 6px;${TEXT}">${htmlBlocks(li.content, true)}</li>`)
            .join("")
          return `<${tag}${start} style="margin:0 0 16px;padding:0 0 0 22px;${TEXT}">${items}</${tag}>`
        }
        case "blockquote":
          return `<blockquote style="margin:0 0 16px;padding:2px 0 2px 16px;border-left:3px solid ${C.blaze};">${htmlBlocks(n.content)}</blockquote>`
        case "horizontalRule":
          return `<hr style="border:0;border-top:1px solid ${C.line};margin:24px 0;">`
        case "image": {
          const id = imageIdFromSrc(n.attrs.src)
          if (!id) return ""
          const width = Math.min(n.attrs.width ?? EMAIL_IMAGE_WIDTH, EMAIL_IMAGE_WIDTH)
          return `<p style="margin:0 0 16px;"><img src="${escapeHtml(newsletterImageUrl(id))}" alt="${escapeHtml(n.attrs.alt ?? "")}" width="${width}" style="display:block;width:100%;max-width:${width}px;height:auto;border:0;border-radius:10px;"></p>`
        }
      }
    })
    .join("\n")
}

export function docToHtml(doc: NewsletterDoc): string {
  return htmlBlocks(doc.content)
}
