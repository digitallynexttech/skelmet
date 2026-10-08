"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

import { FLAME_SKULL_MOUNT, getProduct, type ColourwayId } from "@/features/catalog/catalog"

// Guest cart, client-owned in localStorage: a deliberate deviation from §2.

export type CartLine = {
  /** `<productSlug>:<colourway>`, stable, so quantity merges rather than duplicates. */
  id: string
  productSlug: string
  productName: string
  colourway: ColourwayId
  colourwayName: string
  sku: string
  image: string
  unitPrice: string
  qty: number
}

export type CartTotals = {
  itemCount: number
  subtotal: number
  /** Equal to `couponOff` today: the coupon is the only discount. */
  discount: number
  couponOff: number
  shipping: number
  /** The cash-on-delivery charge. */
  paymentFee: number
  total: number
}

type CartState = {
  items: CartLine[]
  /** The code accepted in the cart drawer. A claim only: checkout re-validates it. */
  couponCode: string | null
  /** The Flame Skull unless another product is named. */
  add: (colourway: ColourwayId, qty?: number, productSlug?: string) => void
  setQty: (id: string, qty: number) => void
  remove: (id: string) => void
  setCoupon: (code: string | null) => void
  /** Brings lines up to the live database prices, by SKU, so the total shown is the one charged. */
  syncPrices: (prices: Record<string, string>) => void
  clear: () => void
}

const MAX_QTY = 9

/** A line at the registry price, for the cart or Buy now. The Flame Skull unless named. */
export function lineFor(
  colourwayId: string,
  qty: number,
  productSlug: string = FLAME_SKULL_MOUNT.slug,
): CartLine | null {
  const product = getProduct(productSlug)
  const colourway = product?.colourways.find((c) => c.id === colourwayId)
  if (!product || !colourway || !Number.isInteger(qty) || qty < 1) return null
  return {
    id: `${product.slug}:${colourway.id}`,
    productSlug: product.slug,
    productName: product.name,
    colourway: colourway.id,
    colourwayName: colourway.name,
    sku: colourway.sku,
    image: colourway.image,
    unitPrice: colourway.price,
    qty: Math.min(MAX_QTY, qty),
  }
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      couponCode: null,

      add: (colourwayId, qty = 1, productSlug) =>
        set((state) => {
          const line = lineFor(colourwayId, qty, productSlug)
          if (!line) return state

          const existing = state.items.find((l) => l.id === line.id)
          if (existing) {
            return {
              items: state.items.map((l) =>
                l.id === line.id ? { ...l, qty: Math.min(MAX_QTY, l.qty + qty) } : l,
              ),
            }
          }
          return { items: [...state.items, line] }
        }),

      setQty: (id, qty) =>
        set((state) => ({
          items:
            qty <= 0
              ? state.items.filter((line) => line.id !== id)
              : state.items.map((line) =>
                  line.id === id ? { ...line, qty: Math.min(MAX_QTY, qty) } : line,
                ),
        })),

      remove: (id) => set((state) => ({ items: state.items.filter((line) => line.id !== id) })),

      setCoupon: (code) => set({ couponCode: code }),

      syncPrices: (prices) =>
        set((state) => {
          const stale = state.items.some((l) => prices[l.sku] && prices[l.sku] !== l.unitPrice)
          if (!stale) return state
          return {
            items: state.items.map((l) =>
              prices[l.sku] ? { ...l, unitPrice: prices[l.sku] as string } : l,
            ),
          }
        }),

      clear: () => set({ items: [], couponCode: null }),
    }),
    { name: "skelmet.cart", version: 2 },
  ),
)

/**
 * A preview: the same arithmetic as `priceCart` (features/cart/server/cart-pricing.ts),
 * clamp included, so the screen matches the charge. The server wins.
 */
export function calculateTotals(
  items: CartLine[],
  couponOff = 0,
  shippingFee = 0,
  paymentFee = 0,
): CartTotals {
  const itemCount = items.reduce((n, line) => n + line.qty, 0)
  // Summed in paise, as the server does.
  const subtotal =
    items.reduce((sum, line) => sum + Math.round(Number(line.unitPrice) * 100) * line.qty, 0) / 100

  const coupon = Math.max(0, Math.round(couponOff))
  // Never past the subtotal, so a coupon cannot make an order negative.
  const discount = Math.min(subtotal, coupon)

  // 0 until checkout has checked a pincode.
  const shipping = Math.max(0, Math.round(shippingFee))
  const fee = Math.max(0, Math.round(paymentFee))

  return {
    itemCount,
    subtotal,
    discount,
    couponOff: discount,
    shipping,
    paymentFee: fee,
    total: subtotal - discount + shipping + fee,
  }
}

/** Re-renders only when the count changes. */
export function useCartCount(): number {
  return useCart((state) => state.items.reduce((n, line) => n + line.qty, 0))
}
