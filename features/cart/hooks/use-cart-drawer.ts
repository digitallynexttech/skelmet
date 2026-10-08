"use client"

import { create } from "zustand"

// Apart from the persisted cart store, so a reload does not reopen the drawer.
type CartDrawerState = {
  open: boolean
  /** Gets focus back on close. Passed in: Safari does not focus a clicked button. */
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
