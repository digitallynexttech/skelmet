import "server-only"

import { siteConfig } from "@/config/site"
import { C, escapeHtml, FONT, MONO } from "@/features/orders/emails/email-theme"

/**
 * "It's arrived - here's your invoice." Sent once, when an order is delivered,
 * with the tax invoice attached as a PDF. Staff can send it again from the
 * order page.
 *
 * Same rules as the other customer emails: tables for layout, inline styles,
 * a plain-text part always.
 */
export type OrderInvoiceData = {
  number: string
  invoiceNumber: string
  firstName: string
  total: string
}

export function renderOrderInvoice(data: OrderInvoiceData): {
  subject: string
  text: string
  html: string
} {
  const subject = `Your invoice for order ${data.number}`
  const greeting = data.firstName ? `Hi ${data.firstName},` : `Hi,`

  const text = [
    greeting,
    ``,
    `Your order ${data.number} has been delivered. Ride safe.`,
    ``,
    `The tax invoice ${data.invoiceNumber} is attached to this email as a PDF.`,
    `Amount: Rs ${data.total}`,
    ``,
    `Questions: just reply to this email.`,
    `${siteConfig.name}`,
  ].join("\n")

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.void};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${escapeHtml(data.number)} &mdash; delivered. Invoice ${escapeHtml(data.invoiceNumber)} attached.
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

              <p style="margin:0 0 10px;font-family:${FONT};font-size:16px;line-height:1.5;color:${C.bone};">
                ${escapeHtml(greeting)}
              </p>
              <p style="margin:0 0 24px;font-family:${FONT};font-size:16px;line-height:1.5;color:${C.bone};">
                Your order ${escapeHtml(data.number)} has been <span style="color:${C.acid};">delivered</span>. Ride safe.
              </p>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background:${C.void};border:1px solid ${C.line};border-radius:10px;padding:16px 18px;">
                    <div style="font-family:${MONO};font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${C.dim};padding-bottom:6px;">
                      Tax invoice
                    </div>
                    <div style="font-family:${MONO};font-size:20px;font-weight:700;letter-spacing:.03em;color:${C.bone};">
                      ${escapeHtml(data.invoiceNumber)}
                    </div>
                    <div style="font-family:${FONT};font-size:13px;color:${C.ash};padding-top:6px;">
                      &#8377;${escapeHtml(data.total)} &middot; attached as a PDF
                    </div>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <tr>
            <td style="padding:20px 4px 0;font-family:${FONT};font-size:12.5px;line-height:1.6;color:${C.dim};">
              Questions? Just reply to this email - it reaches a person.<br>
              <span style="color:${C.ash};">${escapeHtml(siteConfig.name)}</span>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

  return { subject, text, html }
}
