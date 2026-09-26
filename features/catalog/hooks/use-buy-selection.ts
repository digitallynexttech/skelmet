"use client"

import { create } from "zustand"

/**
 * The colourway and quantity picked on the product page, for the phone's
 * sticky bar to buy - it sits outside the buy panel that owns them.
 */
type BuySelection = {
  colourway: string | null
  qty: number
  set: (colourway: string, qty: number) => void
}

export const useBuySelection = create<BuySelection>()((set) => ({
  colourway: null,
  qty: 1,
  set: (colourway, qty) => set({ colourway, qty }),
}))

/** Buy it now: checkout with just this, leaving the cart as it is. */
export const buyNowHref = (colourway: string, qty: number) =>
  `/checkout?buy=${encodeURIComponent(colourway)}&qty=${qty}`
