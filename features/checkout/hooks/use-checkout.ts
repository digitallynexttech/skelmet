"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { siteConfig } from "@/config/site"
import { ApiFetchError, apiFetch } from "@/lib/api-fetch"
import { useCart } from "@/features/cart/hooks/use-cart"
import type { PlaceOrderInput } from "@/features/checkout/schemas/checkout.schema"
import type { StartedCheckout } from "@/features/checkout/server/checkout.service"
import { reportPlaced } from "@/features/visitors/lib/tracker"

type RazorpayHandlerResponse = {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

type RazorpayOptions = {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  order_id: string
  prefill: { name: string; email: string; contact: string }
  /** backdrop_color is Razorpay's option; its default near-white blanks a dark site. */
  theme: { color: string; backdrop_color: string }
  handler: (response: RazorpayHandlerResponse) => void
  modal: { ondismiss: () => void }
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void }
  }
}

const CHECKOUT_JS = "https://checkout.razorpay.com/v1/checkout.js"

/** Well inside the server's hold on an unpaid order's stock. */
const REUSE_UNPAID_MS = 30 * 60_000

/** Loads Razorpay's script once, on demand. */
function loadGateway(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve()

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_JS}"]`)
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true })
      existing.addEventListener("error", () => reject(new Error("gateway")), { once: true })
      return
    }

    const script = document.createElement("script")
    script.src = CHECKOUT_JS
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("gateway"))
    document.body.appendChild(script)
  })
}

export function useCheckout() {
  const router = useRouter()
  const clear = useCart((s) => s.clear)
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  // A ref, not state: two clicks in one frame would both see pending false.
  const inFlight = React.useRef(false)
  // Left unpaid by a dismissed window; the same input pays it again, not a new order.
  const unpaid = React.useRef<{ key: string; at: number; started: StartedCheckout } | null>(null)

  const submit = React.useCallback(
    /** `keepCart` for a Buy-now order, which never came from the cart. */
    async (input: PlaceOrderInput, { keepCart = false }: { keepCart?: boolean } = {}) => {
      if (inFlight.current) return
      inFlight.current = true
      setPending(true)
      setError(null)
      const settle = () => {
        inFlight.current = false
        setPending(false)
      }
      const done = (orderNumber: string) => {
        unpaid.current = null
        if (!keepCart) clear()
        router.push(`/checkout/thank-you?order=${orderNumber}`)
      }

      try {
        const key = JSON.stringify(input)
        const reuse =
          unpaid.current?.key === key && Date.now() - unpaid.current.at < REUSE_UNPAID_MS
            ? unpaid.current.started
            : null
        const started =
          reuse ??
          (await apiFetch<StartedCheckout>("/api/checkout/session", {
            method: "POST",
            body: key,
          }))
        // An order now, paid or not, so not an abandoned basket.
        if (!reuse) reportPlaced(started.orderNumber)

        if (started.paymentMethod === "COD" || !started.gatewayOrderId) {
          done(started.orderNumber)
          return
        }

        await loadGateway()
        if (!window.Razorpay) throw new Error("gateway")

        const rz = new window.Razorpay({
          key: started.gatewayKeyId!,
          // Paise: the whole order, or only the advance.
          amount: Math.round(Number(started.payNow) * 100),
          currency: "INR",
          name: "SKELMET",
          description:
            started.paymentMethod === "PARTIAL"
              ? `Advance for order ${started.orderNumber}`
              : `Order ${started.orderNumber}`,
          order_id: started.gatewayOrderId,
          prefill: {
            name: `${input.address.firstName} ${input.address.lastName}`.trim(),
            email: input.email,
            contact: input.phone,
          },
          // --color-void at 62%.
          theme: { color: "#FF5A1F", backdrop_color: "rgba(7, 6, 10, 0.62)" },
          handler: (response) => {
            // For an instant confirmation; the webhook is the source of truth.
            void apiFetch("/api/checkout/verify", {
              method: "POST",
              body: JSON.stringify({
                orderId: started.orderId,
                gatewayOrderId: response.razorpay_order_id,
                gatewayPaymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }),
            }).then(
              () => done(started.orderNumber),
              (err: unknown) => {
                // 409: Razorpay says it has not gone through. Stay, ready to pay again.
                if (err instanceof ApiFetchError && err.status === 409) {
                  unpaid.current = { key, at: Date.now(), started }
                  settle()
                  setError(
                    `Razorpay has not confirmed this payment, so the order is still unpaid. Try again, or write to ${siteConfig.supportEmail} if money has left your account.`,
                  )
                  return
                }
                // Anything else says nothing about the payment; the webhook settles it.
                done(started.orderNumber)
              },
            )
          },
          modal: {
            ondismiss: () => {
              unpaid.current = { key, at: Date.now(), started }
              settle()
              setError("Payment was cancelled. Your order is saved and still unpaid.")
            },
          },
        })

        rz.open()
      } catch (err) {
        settle()
        setError(
          err instanceof Error && err.message === "gateway"
            ? "Could not reach the payment window. Check your connection and try again."
            : err instanceof Error
              ? err.message
              : "Something went wrong. Try again.",
        )
      }
    },
    [clear, router],
  )

  return { submit, pending, error }
}
