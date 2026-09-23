import "server-only"

import { siteConfig } from "@/config/site"
import { formatMoney } from "@/lib/money"

/**
 * The receipt. With no customer accounts, this email is the ONLY record a
 * buyer keeps of their order number — and the number plus their email is the
 * whole credential for /track. So it leads with the number, repeats it in the
 * subject line where inbox search will find it, and says plainly what it is
 * for.
 *
 * Plain text alongside the HTML, always: it is what some clients render, what
 * spam filters read, and what survives a stripped-down mail app.
 */
export type OrderConfirmedData = {
  number: string
  email: string
  total: string
  paymentMethod: "ONLINE" | "COD"
  items: { name: string; qty: number }[]
}

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
    `Thanks — your order is in.`,
    ``,
    `Order number: ${data.number}`,
    ...lines,
    ``,
    paid
      ? `Paid: ${formatMoney(data.total)}`
      : `Due on delivery: ${formatMoney(data.total)} (cash on delivery)`,
    ``,
    `We dispatch within ${siteConfig.promise.dispatchHours} hours on working days, and most`,
    `pincodes see it in ${siteConfig.promise.deliveryDays}.`,
    ``,
    `Track it any time at ${trackUrl}`,
    `You will need this order number and this email address — there is no account to sign in to.`,
    ``,
    `Questions: just reply to this email.`,
    `${siteConfig.name}`,
  ].join("\n")

  // Deliberately plain HTML: tables and inline styles are what mail clients
  // actually support, and anything cleverer degrades worse than this does.
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;max-width:520px;color:#16141c;line-height:1.55">
  <p style="margin:0 0 18px">Thanks — your order is in.</p>

  <p style="margin:0 0 6px;font-size:13px;color:#63606f">ORDER NUMBER</p>
  <p style="margin:0 0 20px;font-size:26px;font-weight:700;letter-spacing:0.04em">${escapeHtml(data.number)}</p>

  <ul style="margin:0 0 20px;padding-left:18px">
    ${data.items.map((i) => `<li>${i.qty} &times; ${escapeHtml(i.name)}</li>`).join("\n    ")}
  </ul>

  <p style="margin:0 0 20px;font-size:17px">
    <strong>${paid ? "Paid" : "Due on delivery"}:</strong> ${formatMoney(data.total)}${
      paid ? "" : " (cash on delivery)"
    }
  </p>

  <p style="margin:0 0 20px">
    We dispatch within ${siteConfig.promise.dispatchHours} hours on working days, and most
    pincodes see it in ${siteConfig.promise.deliveryDays}.
  </p>

  <p style="margin:0 0 6px"><a href="${trackUrl}" style="color:#FF5A1F">Track your order</a></p>
  <p style="margin:0 0 20px;font-size:13px;color:#63606f">
    You will need this order number and this email address. There is no account to sign in to.
  </p>

  <p style="margin:0;font-size:13px;color:#63606f">
    Questions? Just reply to this email.<br />${escapeHtml(siteConfig.name)}
  </p>
</div>`

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
