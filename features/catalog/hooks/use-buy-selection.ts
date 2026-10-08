"use client"

import { create } from "zustand"

// The product page's pick, for the phone's sticky bar, which sits outside the buy panel.
type BuySelection = {
  colourway: string | null
  qty: number
  /** Live price, so the bar quotes what Buy now charges. */
  price: string | null
  /** Shipping is free everywhere (Settings > Shipping charge at 0%). */
  freeShipping: boolean | null
  set: (colourway: string, qty: number, price: string, freeShipping: boolean) => void
}

export const useBuySelection = create<BuySelection>()((set) => ({
  colourway: null,
  qty: 1,
  price: null,
  freeShipping: null,
  set: (colourway, qty, price, freeShipping) => set({ colourway, qty, price, freeShipping }),
}))

/** Buy it now: checkout with just this, leaving the cart as it is. */
export const buyNowHref = (colourway: string, qty: number, productSlug: string) =>
  `/checkout?buy=${encodeURIComponent(colourway)}&qty=${qty}&product=${encodeURIComponent(productSlug)}`
