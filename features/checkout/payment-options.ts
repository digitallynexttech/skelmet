import { siteConfig } from "@/lib/config/site"
import type {
  AdvanceKind,
  Offer,
  PaymentOptions,
} from "@/features/settings/schemas/runtime-settings.schema"
import { formatMoney } from "@/lib/money"

/**
 * The ways to pay and their arithmetic: ONLINE (all now), PARTIAL (advance now,
 * balance to the courier), COD (all to the courier). Client-safe: checkout
 * previews and the server charges with the same functions.
 */

export const PAYMENT_METHODS = ["ONLINE", "PARTIAL", "COD"] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/** Online only until saved. Here, not beside its schema, to keep zod out of storefront bundles. */
export const DEFAULT_PAYMENT_OPTIONS: PaymentOptions = {
  cod: { offer: "off", feeRupees: 0 },
  partial: { offer: "off", feeRupees: 0, advanceKind: "PERCENT", advanceValue: 20 },
}

export type Advance = { kind: AdvanceKind; value: number }

export function offered(offer: Offer, staff: boolean): boolean {
  return offer === "everyone" || (offer === "staff" && staff)
}

/** Rupees this method adds to the order; 0 for ONLINE. */
export function methodFee(options: PaymentOptions, method: PaymentMethod): number {
  if (method === "COD") return options.cod.feeRupees
  if (method === "PARTIAL") return options.partial.feeRupees
  return 0
}

export function advanceOf(options: PaymentOptions): Advance {
  return { kind: options.partial.advanceKind, value: options.partial.advanceValue }
}

export type Split = {
  /** Taken online when the order is placed. */
  payNow: number
  /** Collected by the courier. */
  dueOnDelivery: number
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/**
 * How an order's `total` (method fee included) is paid. For PARTIAL the courier
 * collects whole rupees and the advance carries the paise. Null when either
 * side would be under ₹1.
 */
export function splitPayment(
  method: PaymentMethod,
  total: number,
  advance: Advance | null,
): Split | null {
  if (method === "ONLINE") return { payNow: total, dueOnDelivery: 0 }
  if (method === "COD") return { payNow: 0, dueOnDelivery: total }
  if (!advance) return null

  const wanted = advance.kind === "PERCENT" ? (total * advance.value) / 100 : advance.value
  const dueOnDelivery = Math.floor(round2(total - wanted))
  const payNow = round2(total - dueOnDelivery)
  if (dueOnDelivery < 1 || payNow < 1) return null
  return { payNow, dueOnDelivery }
}

/** "20%" or "₹500". */
export function advanceLabel(advance: Advance): string {
  return advance.kind === "PERCENT" ? `${advance.value}%` : formatMoney(advance.value)
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  ONLINE: "Paid online",
  PARTIAL: "Advance + on delivery",
  COD: "Cash on delivery",
}

/** For a table column. */
export const PAYMENT_METHOD_SHORT: Record<PaymentMethod, string> = {
  ONLINE: "Online",
  PARTIAL: "Advance + COD",
  COD: "COD",
}

/** "Advance paid" for a PAID partial order; undefined keeps the usual label. */
export function statusLabelFor(status: string, method: PaymentMethod): string | undefined {
  return status === "PAID" && method === "PARTIAL" ? "Advance paid" : undefined
}

// ── what the storefront says ────────────────────────────────

const charge = (rupees: number) =>
  rupees > 0 ? `costs ${formatMoney(rupees)} extra` : "costs nothing extra"

/** How to pay, for the FAQ and terms. Staff-only options are not mentioned. */
export function paymentCopy(options: PaymentOptions): { faq: string; terms: string } {
  const cod = options.cod.offer === "everyone"
  const partial = options.partial.offer === "everyone"

  if (!cod && !partial) {
    return {
      faq: "Online at checkout, by UPI, card or netbanking, through Razorpay. We never see your card or UPI details. There is no cash on delivery.",
      terms:
        "We accept UPI, cards and netbanking, paid online at checkout; there is no cash on delivery. Payments are handled by Razorpay; we never see your card or UPI credentials.",
    }
  }

  const onDelivery: string[] = []
  if (partial) {
    onDelivery.push(
      `You can pay ${advanceLabel(advanceOf(options))} ${
        options.partial.advanceKind === "PERCENT" ? "of the order " : ""
      }online as an advance and the rest to the courier on delivery, which ${charge(options.partial.feeRupees)}.`,
    )
  }
  if (cod) {
    // Elsewhere dispatch runs from payment; COD has none until the door.
    onDelivery.push(
      `${partial ? "Or pay" : "You can also pay"} the whole amount to the courier on delivery, which ${charge(options.cod.feeRupees)}; those orders are dispatched within ${siteConfig.promise.dispatchHours} hours of being placed.`,
    )
  }
  const where =
    "Paying on delivery is offered where a courier collects at your pincode, and checkout shows each option and the full total before you place the order."

  return {
    faq: `Online at checkout, by UPI, card or netbanking, through Razorpay. We never see your card or UPI details. ${onDelivery.join(" ")} ${where}`,
    terms: `We accept UPI, cards and netbanking, paid online at checkout. ${onDelivery.join(" ")} ${where} Online payments are handled by Razorpay; we never see your card or UPI credentials.`,
  }
}
