import { create } from "zustand"

type NavState = {
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
}

export const useNav = create<NavState>((set) => ({
  mobileOpen: false,
  setMobileOpen: (mobileOpen) => set({ mobileOpen }),
}))
