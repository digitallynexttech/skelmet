"use client"

import * as React from "react"

import { acceptedNow, useConsent } from "@/features/visitors/hooks/use-consent"
import {
  pixelConsent,
  pixelPageView,
  pixelPurchase,
  pixelViewContent,
  watchCartForPixel,
} from "@/features/visitors/lib/meta-pixel"

/**
 * The Meta Pixel on every storefront page: a PageView where it starts - on
 * arrival, or on the page where the visitor accepts - and AddToCart as the
 * cart grows. The route changes after that Meta's script reports itself.
 * Nothing at all until Accept; see features/visitors/lib/meta-pixel.ts for
 * what is sent and when.
 */
export function MetaPixel() {
  const accepted = useConsent(acceptedNow)

  React.useEffect(() => watchCartForPixel(), [])

  // A change of mind once the page is open. Before the PageView, so that a
  // new Accept is granted before anything is asked of the pixel.
  const previous = React.useRef(accepted)
  React.useEffect(() => {
    if (previous.current === accepted) return
    previous.current = accepted
    pixelConsent(accepted)
  }, [accepted])

  React.useEffect(() => {
    if (accepted) pixelPageView()
  }, [accepted])

  return null
}

/**
 * ViewContent for the product page: on arrival, or when the visitor accepts
 * while on it.
 */
export function PixelViewContent({
  sku,
  name,
  price,
}: {
  sku: string
  name: string
  price: string
}) {
  const accepted = useConsent(acceptedNow)
  React.useEffect(() => {
    if (accepted) pixelViewContent({ sku, name, price })
  }, [accepted, sku, name, price])
  return null
}

type PurchaseLine = { sku: string; qty: number; unitPrice: string }

/** Purchase, from the order confirmation page. Reported once per order. */
export function PixelPurchase({
  order,
}: {
  order: { number: string; total: string; items: PurchaseLine[] }
}) {
  const accepted = useConsent(acceptedNow)
  const { number, total } = order
  // The lines as a string, so a new array from the server each render is not a change.
  const items = JSON.stringify(order.items)
  React.useEffect(() => {
    if (accepted) pixelPurchase({ number, total, items: JSON.parse(items) as PurchaseLine[] })
  }, [accepted, number, total, items])
  return null
}
