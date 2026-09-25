import "server-only"

import { siteConfig } from "@/config/site"
import { C, escapeHtml, FONT, MONO } from "@/features/orders/emails/email-theme"

/**
 * "It's on its way." Sent once, when an order becomes SHIPPED - by a courier
 * booked through Shiprocket, by a Shiprocket tracking update, or by staff
 * typing the AWB in.
 *
 * The AWB is the thing the customer will actually use, so it leads, in a box
 * they can copy from. The courier's own tracking page is linked when there is
 * one; /track works for every order regardless.
 *
 * Same rules as the receipt (order-confirmed.ts): tables for layout, inline
 * styles, a plain-text part always.
 */
export type OrderShippedData = {
  number: string
  courier: string
  awb: string | null
  /** Shiprocket's tracking page, when the shipment was booked there. */
  trackingUrl: string | null
  items: { name: string; qty: number }[]
}

export function renderOrderShipped(data: OrderShippedData): {
  subject: string
  text: string
  html: string
} {
  const ourTrackUrl = `${siteConfig.url}/track`
  const subject = `Order ${data.number} has shipped`

  const text = [
    `Your order is on its way.`,
    ``,
    `Order number: ${data.number}`,
    `Courier: ${data.courier}`,
    ...(data.awb ? [`Tracking number (AWB): ${data.awb}`] : []),
    ...data.items.map((i) => `${i.qty} x ${i.name}`),
    ``,
    ...(data.trackingUrl ? [`Live tracking: ${data.trackingUrl}`] : []),
    `Or track it at ${ourTrackUrl} with your order number and this email address.`,
    ``,
    `Questions: just reply to this email.`,
    `${siteConfig.name}`,
  ].join("\n")

  const items = data.items
    .map(
      (i) => `
              <tr>
                <td style="padding:9px 0;border-bottom:1px solid ${C.line};color:${C.bone};font-size:14.5px;line-height:1.4">
                  ${escapeHtml(i.name)}
                </td>
                <td align="right" style="padding:9px 0;border-bottom:1px solid ${C.line};color:${C.ash};font-family:${MONO};font-size:13px;white-space:nowrap">
                  &times;&nbsp;${i.qty}
                </td>
              </tr>`,
    )
    .join("")

  const button = (href: string, label: string) => `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;">
                <tr>
                  <td align="center" bgcolor="${C.blaze}" style="border-radius:9px;">
                    <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:14px;font-weight:700;color:${C.void};text-decoration:none;border-radius:9px;">
                      ${label}
                    </a>
                  </td>
                </tr>
              </table>`

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
    ${escapeHtml(data.number)} &mdash; handed to ${escapeHtml(data.courier)}${data.awb ? `, AWB ${escapeHtml(data.awb)}` : ""}.
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

              <p style="margin:0 0 24px;font-family:${FONT};font-size:16px;line-height:1.5;color:${C.bone};">
                Your order ${escapeHtml(data.number)} is on its way with <span style="color:${C.acid};">${escapeHtml(data.courier)}</span>.
              </p>
${
  data.awb
    ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;">
                <tr>
                  <td style="background:${C.void};border:1px solid ${C.line};border-radius:10px;padding:16px 18px;">
                    <div style="font-family:${MONO};font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${C.dim};padding-bottom:6px;">
                      Tracking number (AWB)
                    </div>
                    <div style="font-family:${MONO};font-size:22px;font-weight:700;letter-spacing:.04em;color:${C.bone};">
                      ${escapeHtml(data.awb)}
                    </div>
                  </td>
                </tr>
              </table>`
    : ""
}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td colspan="2" style="font-family:${MONO};font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${C.dim};padding-bottom:4px;">
                    In this parcel
                  </td>
                </tr>${items}
              </table>
${data.trackingUrl ? button(data.trackingUrl, "Track your parcel") : button(ourTrackUrl, "Track your order")}

              <p style="margin:14px 0 0;font-family:${FONT};font-size:12.5px;line-height:1.55;color:${C.dim};">
                ${
                  data.trackingUrl
                    ? `You can also track it at <a href="${ourTrackUrl}" style="color:${C.ash};">${escapeHtml(ourTrackUrl.replace(/^https?:\/\//, ""))}</a> with your order number and this email address.`
                    : `You will need your order number and this email address.`
                }
              </p>

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
