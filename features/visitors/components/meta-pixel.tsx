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

/** First PageView and AddToCart; Meta's script reports later route changes itself. */
export function MetaPixel() {
  const accepted = useConsent(acceptedNow)

  React.useEffect(() => watchCartForPixel(), [])

  // Before the PageView effect, so a new Accept is granted first.
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

/** On the order confirmation page; reported once per order. */
export function PixelPurchase({
  order,
}: {
  order: { number: string; total: string; items: PurchaseLine[] }
}) {
  const accepted = useConsent(acceptedNow)
  const { number, total } = order
  // A string, so a new array each render is not a change.
  const items = JSON.stringify(order.items)
  React.useEffect(() => {
    if (accepted) pixelPurchase({ number, total, items: JSON.parse(items) as PurchaseLine[] })
  }, [accepted, number, total, items])
  return null
}
