import "server-only"

import { siteConfig } from "@/config/site"
import { formatMoney } from "@/lib/money"

/**
 * The receipt. With no customer accounts, this email is the ONLY record a
 * buyer keeps of their order number - and the number plus their email is the
 * whole credential for /track. So it leads with the number, repeats it in the
 * subject line where inbox search will find it, and says plainly what it is
 * for.
 *
 * Plain text alongside the HTML, always: it is what some clients render, what
 * spam filters read, and what survives a stripped-down mail app.
 *
 * ── Why the HTML looks like 2005 ──────────────────────────────────────────
 * Mail clients are not browsers. Outlook renders with Word, which has no
 * flexbox, no grid, no border-radius on anything that matters and drops most
 * shorthand. So: nested tables for layout, inline styles on every cell, no
 * <style> block doing anything load-bearing, no web fonts, and the button is
 * a table cell with a link in it rather than a styled anchor, because a
 * padded anchor collapses to bare text in Outlook.
 *
 * Everything degrades to legible dark-on-light or light-on-dark text if the
 * styles are stripped entirely.
 */
export type OrderConfirmedData = {
  number: string
  email: string
  total: string
  paymentMethod: "ONLINE" | "COD"
  items: { name: string; qty: number }[]
}

/* Brand palette, duplicated from globals.css on purpose: an email cannot read
   CSS variables, and a colour that silently resolved to nothing would render
   as black text on a black card. */
const C = {
  void: "#07060a",
  carbon: "#14121b",
  line: "#2a2733",
  blaze: "#ff5a1f",
  ember: "#ff8a00",
  acid: "#d4ff3d",
  bone: "#f7f4ed",
  ash: "#a3a0b0",
  dim: "#7c7989",
} as const

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
const MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace"

export function renderOrderConfirmed(data: OrderConfirmedData): {
  subject: string
  text: string
  html: string
} {
  const paid = data.paymentMethod === "ONLINE"
  const trackUrl = `${siteConfig.url}/track`
  const lines = data.items.map((i) => `${i.qty} x ${i.name}`)

  const subject = `Order ${data.number} confirmed`

  const text = [
    `Thanks - your order is in.`,
    ``,
    `Order number: ${data.number}`,
    ...lines,
    ``,
    paid
      ? `Paid: ${formatMoney(data.total)}`
      : `Due on delivery: ${formatMoney(data.total)} (cash on delivery)`,
    ``,
    `We dispatch within ${siteConfig.promise.dispatchHours} hours on working days, and most`,
    `pincodes see it within ${siteConfig.promise.deliveryDays}.`,
    ``,
    `Track it any time at ${trackUrl}`,
    `You will need this order number and this email address - there is no account to sign in to.`,
    ``,
    `Questions: just reply to this email.`,
    `${siteConfig.name}`,
  ].join("\n")

  const items = data.items
    .map(
      (i) => `
              <tr>
                <td style="padding:11px 0;border-bottom:1px solid ${C.line};color:${C.bone};font-size:15px;line-height:1.4">
                  ${escapeHtml(i.name)}
                </td>
                <td align="right" style="padding:11px 0;border-bottom:1px solid ${C.line};color:${C.ash};font-family:${MONO};font-size:13px;white-space:nowrap">
                  &times;&nbsp;${i.qty}
                </td>
              </tr>`,
    )
    .join("")

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${C.void};">
  <!-- Inbox preview line. Hidden in the body, but it is what the list shows
       beside the subject, and without it clients grab the first stray text. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    ${escapeHtml(data.number)} &mdash; ${paid ? "paid" : "confirmed"}, dispatching within ${siteConfig.promise.dispatchHours} hours.
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.void};">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">

          <!-- wordmark -->
          <tr>
            <td style="padding:0 0 22px;">
              <span style="font-family:${FONT};font-size:19px;font-weight:800;letter-spacing:.18em;color:${C.bone};">SKEL</span><span style="font-family:${FONT};font-size:19px;font-weight:800;letter-spacing:.18em;color:${C.blaze};">MET</span>
            </td>
          </tr>

          <!-- the card -->
          <tr>
            <td style="background:${C.carbon};border:1px solid ${C.line};border-radius:14px;padding:30px 28px;">

              <p style="margin:0 0 24px;font-family:${FONT};font-size:16px;line-height:1.5;color:${C.bone};">
                Thanks - your order is in.
              </p>

              <!-- order number -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px;">
                <tr>
                  <td style="background:${C.void};border:1px solid ${C.line};border-radius:10px;padding:16px 18px;">
                    <div style="font-family:${MONO};font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${C.dim};padding-bottom:6px;">
                      Order number
                    </div>
                    <div style="font-family:${MONO};font-size:24px;font-weight:700;letter-spacing:.04em;color:${C.bone};">
                      ${escapeHtml(data.number)}
                    </div>
                  </td>
                </tr>
              </table>

              <!-- items -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td colspan="2" style="font-family:${MONO};font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${C.dim};padding-bottom:4px;">
                    In this order
                  </td>
                </tr>${items}
                <tr>
                  <td style="padding:16px 0 0;font-family:${FONT};font-size:15px;font-weight:700;color:${C.bone};">
                    ${paid ? "Paid" : "Due on delivery"}
                  </td>
                  <td align="right" style="padding:16px 0 0;font-family:${FONT};font-size:20px;font-weight:700;color:${paid ? C.acid : C.ember};white-space:nowrap;">
                    ${formatMoney(data.total)}
                  </td>
                </tr>${
                  paid
                    ? ""
                    : `
                <tr>
                  <td colspan="2" style="padding:4px 0 0;font-family:${FONT};font-size:13px;color:${C.ash};">
                    Cash on delivery - pay the courier at the door.
                  </td>
                </tr>`
                }
              </table>

              <!-- dispatch -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0;">
                <tr>
                  <td style="border-top:1px solid ${C.line};padding:20px 0 0;font-family:${FONT};font-size:14px;line-height:1.6;color:${C.ash};">
                    We dispatch within <span style="color:${C.bone};">${siteConfig.promise.dispatchHours} hours</span> on working days, and most pincodes see it within <span style="color:${C.bone};">${siteConfig.promise.deliveryDays}</span>.
                  </td>
                </tr>
              </table>

              <!-- button: a table cell, not a padded anchor, or Outlook drops the shape -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;">
                <tr>
                  <td align="center" bgcolor="${C.blaze}" style="border-radius:9px;">
                    <a href="${trackUrl}" style="display:inline-block;padding:13px 26px;font-family:${FONT};font-size:14px;font-weight:700;color:${C.void};text-decoration:none;border-radius:9px;">
                      Track your order
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:14px 0 0;font-family:${FONT};font-size:12.5px;line-height:1.55;color:${C.dim};">
                You will need this order number and this email address. There is no account to sign in to.
              </p>

            </td>
          </tr>

          <!-- footer -->
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

/** Order numbers and product names are ours, but never interpolate unescaped. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
