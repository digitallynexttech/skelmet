import { siteConfig } from "@/config/site"
import type {
  AdvanceKind,
  Offer,
  PaymentOptions,
} from "@/features/settings/schemas/runtime-settings.schema"
import { formatMoney } from "@/lib/money"

/**
 * The ways to pay, and the arithmetic of each, as pure functions.
 *
 *   ONLINE   all of it now, through Razorpay
 *   PARTIAL  an advance now, the balance to the courier
 *   COD      all of it to the courier
 *
 * Client-safe: checkout previews with these and the server charges with them,
 * so the amount on the button is the amount taken. What is on offer, and what
 * each costs, is set in the console (Settings > Pay on delivery).
 */

export const PAYMENT_METHODS = ["ONLINE", "PARTIAL", "COD"] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/**
 * Until something is saved: online only, as the shop has always sold. Here
 * rather than beside its schema, so the storefront pages that only state how
 * to pay do not pull the schema's validation into their bundle.
 */
export const DEFAULT_PAYMENT_OPTIONS: PaymentOptions = {
  cod: { offer: "off", feeRupees: 0 },
  partial: { offer: "off", feeRupees: 0, advanceKind: "PERCENT", advanceValue: 20 },
}

export type Advance = { kind: AdvanceKind; value: number }

/** Whether a way of paying is shown to this viewer. */
export function offered(offer: Offer, staff: boolean): boolean {
  return offer === "everyone" || (offer === "staff" && staff)
}

/** What paying this way adds to the order, rupees. Paying online never adds anything. */
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
 * How an order's `total` - the method's own charge included - is paid.
 *
 * For PARTIAL the courier collects whole rupees, since nobody at a door has
 * paise: the balance is rounded down and the advance carries the rest, so a
 * 20% advance on ₹3,599 is ₹720 now and ₹2,879 on delivery. Null when the
 * total cannot be split - an advance that would cover all of it, or leave
 * under a rupee either side - and the order has to be paid another way.
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

/** "20%" or "₹500": the advance as the console set it. */
export function advanceLabel(advance: Advance): string {
  return advance.kind === "PERCENT" ? `${advance.value}%` : formatMoney(advance.value)
}

/** How the console names an order's way of paying. */
export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  ONLINE: "Paid online",
  PARTIAL: "Advance + on delivery",
  COD: "Cash on delivery",
}

/** The same, for a table column. */
export const PAYMENT_METHOD_SHORT: Record<PaymentMethod, string> = {
  ONLINE: "Online",
  PARTIAL: "Advance + COD",
  COD: "COD",
}

/**
 * What to call a status where its own label would mislead: "Paid" on an
 * order that has only had its advance paid. Undefined leaves the label as is.
 */
export function statusLabelFor(status: string, method: PaymentMethod): string | undefined {
  return status === "PAID" && method === "PARTIAL" ? "Advance paid" : undefined
}

// ── what the storefront says ────────────────────────────────

const charge = (rupees: number) =>
  rupees > 0 ? `costs ${formatMoney(rupees)} extra` : "costs nothing extra"

/**
 * How to pay, as the FAQ and the terms state it. Only what every customer is
 * offered is mentioned: an option on test with staff changes nothing here.
 */
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
    // Everywhere else the dispatch promise runs from payment, which a
    // cash-on-delivery order has none of until the door.
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
