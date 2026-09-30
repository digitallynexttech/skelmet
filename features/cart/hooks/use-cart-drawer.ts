"use client"

import { create } from "zustand"

/**
 * Whether the cart drawer is open. Its own store, not a field on the cart:
 * the cart is persisted to localStorage, and an open drawer must not be
 * something a reload brings back.
 *
 * Anything may open it - the header's cart button, a button that has just
 * added something - so it lives outside the drawer that reads it.
 */
type CartDrawerState = {
  open: boolean
  /**
   * What opened it, so focus can go back there when it closes. Handed in
   * rather than read off `document.activeElement`: Safari does not focus a
   * button that is clicked, and the page would be left with focus nowhere.
   */
  opener: HTMLElement | null
  show: (opener?: HTMLElement | null) => void
  hide: () => void
}

export const useCartDrawer = create<CartDrawerState>()((set) => ({
  open: false,
  opener: null,
  show: (opener = null) => set({ open: true, opener }),
  hide: () => set({ open: false }),
}))
