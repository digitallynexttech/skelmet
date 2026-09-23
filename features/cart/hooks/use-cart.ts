"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

import { COLOURWAYS, FLAME_SKULL_MOUNT, type ColourwayId } from "@/features/catalog/catalog"
import { BUNDLE_DISCOUNT, COD_FEE } from "@/lib/constants"

/**
 * Guest cart.
 *
 * Deviation from §2, deliberate and temporary: until Postgres is wired up the
 * cart is client-owned and persisted to localStorage, so the storefront is
 * usable end to end today. When the database lands this file becomes a
 * TanStack Query hook over `/api/cart`, `features/cart/server/cart.service.ts`
 * and the routes are already written against that shape, and the component
 * API below (`items`, `add`, `setQty`, `remove`, `totals`) does not change.
 */

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
  /** Bundle and coupon together, which is what the summary shows as one line. */
  discount: number
  /** The coupon's share of `discount`, so a screen can name it separately. */
  couponOff: number
  shipping: number
  codFee: number
  total: number
}

type CartState = {
  items: CartLine[]
  /**
   * The code accepted on /cart, so checkout can send it without the customer
   * typing it twice. The value is a claim, never an authority — checkout
   * re-validates it against the database and re-prices from scratch, so a
   * hand-edited localStorage entry buys nothing.
   */
  couponCode: string | null
  add: (colourway: ColourwayId, qty?: number) => void
  setQty: (id: string, qty: number) => void
  remove: (id: string) => void
  setCoupon: (code: string | null) => void
  clear: () => void
}

const MAX_QTY = 9

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      couponCode: null,

      add: (colourwayId, qty = 1) =>
        set((state) => {
          const colourway = COLOURWAYS.find((c) => c.id === colourwayId)
          if (!colourway) return state

          const id = `${FLAME_SKULL_MOUNT.slug}:${colourway.id}`
          const existing = state.items.find((line) => line.id === id)

          if (existing) {
            return {
              items: state.items.map((line) =>
                line.id === id ? { ...line, qty: Math.min(MAX_QTY, line.qty + qty) } : line,
              ),
            }
          }

          const line: CartLine = {
            id,
            productSlug: FLAME_SKULL_MOUNT.slug,
            productName: FLAME_SKULL_MOUNT.name,
            colourway: colourway.id,
            colourwayName: colourway.name,
            sku: colourway.sku,
            image: colourway.image,
            unitPrice: FLAME_SKULL_MOUNT.price,
            qty: Math.min(MAX_QTY, qty),
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

      clear: () => set({ items: [], couponCode: null }),
    }),
    { name: "skelmet.cart", version: 2 },
  ),
)

/**
 * Pure pricing, mirrored by `features/cart/server/cart-pricing.ts` so the server
 * is the authority at checkout and this is only ever a preview.
 */
/**
 * Mirrors `priceCart` in features/cart/server/cart-pricing.ts deliberately,
 * including the clamp: the two are the same arithmetic on purpose so the
 * number on screen matches the one the server charges. This copy is a preview
 * only — checkout recomputes from the database and can disagree, and when it
 * does the server wins.
 */
export function calculateTotals(
  items: CartLine[],
  codSelected = false,
  couponOff = 0,
): CartTotals {
  const itemCount = items.reduce((n, line) => n + line.qty, 0)
  const subtotal = items.reduce((sum, line) => sum + Number(line.unitPrice) * line.qty, 0)

  const bundle = itemCount >= 2 ? BUNDLE_DISCOUNT : 0
  const coupon = Math.max(0, Math.round(couponOff))
  // Never past the subtotal, so the two together cannot make an order negative.
  const discount = Math.min(subtotal, bundle + coupon)

  const shipping = 0
  const codFee = codSelected ? COD_FEE : 0

  return {
    itemCount,
    subtotal,
    discount,
    couponOff: Math.max(0, discount - bundle),
    shipping,
    codFee,
    total: subtotal - discount + shipping + codFee,
  }
}

/** Reads the live count without re-rendering on unrelated cart changes. */
export function useCartCount(): number {
  return useCart((state) => state.items.reduce((n, line) => n + line.qty, 0))
}
