import { siteConfig } from "@/config/site"
import { docToHtml, docToText, type NewsletterDoc } from "@/features/newsletter/newsletter-content"
import { C, escapeHtml, FONT, MONO } from "@/features/orders/emails/email-theme"

/**
 * A newsletter email: what staff wrote in the console, in the shop's colours,
 * with a way off the list in every copy.
 *
 * The message is the console editor's document (newsletter-content.ts), which
 * renders to inline-styled HTML from a whitelist of nodes, so nothing a staff
 * member types or pastes can break out into markup. No server-only: the
 * console's preview renders this same email in a frame.
 *
 * Same rules as the order emails (order-confirmed.ts): tables for layout,
 * inline styles, a plain-text part always.
 */
export type NewsletterEmailData = {
  subject: string
  content: NewsletterDoc
  ctaLabel?: string | null
  ctaUrl?: string | null
  /** The page that confirms the unsubscribe, for the link a person clicks. */
  unsubscribeUrl: string
}

/**
 * The one-click unsubscribe a mail client offers beside the sender's name
 * (RFC 8058). Gmail and Yahoo expect it on anything sent to a list, and a
 * visible way out in the client beats a spam report.
 */
export function unsubscribeHeaders(oneClickUrl: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${oneClickUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  }
}

export function renderNewsletter(data: NewsletterEmailData): {
  subject: string
  text: string
  html: string
} {
  const cta = data.ctaUrl
    ? { url: data.ctaUrl, label: data.ctaLabel?.trim() || "Take a look" }
    : null
  const message = docToText(data.content)
  const preheader = message.replace(/\s+/g, " ").slice(0, 140)

  const text = [
    message,
    "",
    ...(cta ? [`${cta.label}: ${cta.url}`, ""] : []),
    `${siteConfig.name}`,
    ``,
    `You're getting this because you joined the ${siteConfig.name} drop list at ${siteConfig.url.replace(/^https?:\/\//, "")}.`,
    `Unsubscribe: ${data.unsubscribeUrl}`,
  ].join("\n")

  const body = docToHtml(data.content)

  const button = cta
    ? `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0 0;">
                <tr>
                  <td align="center" bgcolor="${C.blaze}" style="border-radius:9px;">
                    <a href="${escapeHtml(cta.url)}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:14px;font-weight:700;color:${C.void};text-decoration:none;border-radius:9px;">
                      ${escapeHtml(cta.label)}
                    </a>
                  </td>
                </tr>
              </table>`
    : ""

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>${escapeHtml(data.subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.void};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${escapeHtml(preheader)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.void};">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

          <tr>
            <td style="padding:0 0 22px;">
              <span style="font-family:${FONT};font-size:19px;font-weight:800;letter-spacing:.18em;color:${C.bone};">SKEL</span><span style="font-family:${FONT};font-size:19px;font-weight:800;letter-spacing:.18em;color:${C.blaze};">MET</span>
            </td>
          </tr>

          <tr>
            <td style="background:${C.carbon};border:1px solid ${C.line};border-radius:14px;padding:30px 28px;">
              <h1 style="margin:0 0 18px;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:800;color:${C.bone};">
                ${escapeHtml(data.subject)}
              </h1>
${body}
${button}
            </td>
          </tr>

          <tr>
            <td style="padding:22px 4px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.dim};">
              You&rsquo;re getting this because you joined the ${escapeHtml(siteConfig.name)} drop list at
              <a href="${escapeHtml(siteConfig.url)}" style="color:${C.dim};">${escapeHtml(siteConfig.url.replace(/^https?:\/\//, ""))}</a>.
              <br>
              <a href="${escapeHtml(data.unsubscribeUrl)}" style="color:${C.ash};font-family:${MONO};font-size:11px;letter-spacing:.08em;text-transform:uppercase;">Unsubscribe</a>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject: data.subject, text, html }
}
