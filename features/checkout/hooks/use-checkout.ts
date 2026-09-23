"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { apiFetch } from "@/lib/api-fetch"
import { useCart } from "@/features/cart/hooks/use-cart"
import type { PlaceOrderInput } from "@/features/checkout/schemas/checkout.schema"

type StartedCheckout = {
  orderId: string
  orderNumber: string
  total: string
  gatewayOrderId: string | null
  gatewayKeyId: string | null
  paymentMethod: "ONLINE" | "COD"
}

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
  /**
   * backdrop_color is Razorpay's own option, not a CSS override — their
   * container is same-origin but the sheet inside is an iframe, and the
   * default backdrop is a near-opaque white that blanks a dark site the
   * instant the modal opens. The blur on top of it is ours (globals.css).
   */
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

/** Loads Razorpay's script once, on demand rather than on every page. */
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

  const submit = React.useCallback(
    async (input: PlaceOrderInput) => {
      setPending(true)
      setError(null)

      try {
        const started = await apiFetch<StartedCheckout>("/api/checkout/session", {
          method: "POST",
          body: JSON.stringify(input),
        })

        // Cash on delivery: the order already exists, nothing to pay now.
        if (started.paymentMethod === "COD" || !started.gatewayOrderId) {
          clear()
          router.push(`/checkout/thank-you?order=${started.orderNumber}`)
          return
        }

        await loadGateway()
        if (!window.Razorpay) throw new Error("gateway")

        const rz = new window.Razorpay({
          key: started.gatewayKeyId!,
          amount: Math.round(Number(started.total) * 100),
          currency: "INR",
          name: "SKELMET",
          description: `Order ${started.orderNumber}`,
          order_id: started.gatewayOrderId,
          prefill: {
            name: `${input.address.firstName} ${input.address.lastName}`.trim(),
            email: input.email,
            contact: input.phone,
          },
          // --color-void at 62%: the page stays visible behind the sheet
          // instead of being replaced by a white plate.
          theme: { color: "#FF5A1F", backdrop_color: "rgba(7, 6, 10, 0.62)" },
          handler: (response) => {
            // Confirm so the customer sees success immediately. The webhook is
            // still the source of truth if this request never lands.
            void apiFetch("/api/checkout/verify", {
              method: "POST",
              body: JSON.stringify({
                orderId: started.orderId,
                gatewayOrderId: response.razorpay_order_id,
                gatewayPaymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }),
            })
              .catch(() => {
                // Payment succeeded at the gateway; the webhook will reconcile.
              })
              .finally(() => {
                clear()
                router.push(`/checkout/thank-you?order=${started.orderNumber}`)
              })
          },
          modal: {
            ondismiss: () => {
              setPending(false)
              setError("Payment was cancelled. Your order is saved and still unpaid.")
            },
          },
        })

        rz.open()
      } catch (err) {
        setPending(false)
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
