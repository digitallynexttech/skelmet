"use client"

import { PanelLeftClose, PanelLeftOpen } from "lucide-react"

import { useAdminShell } from "@/components/layout/admin-shell"

/** Holds the sidebar toggle; 68px to match the sidebar's logo row. */
export function AdminHeader() {
  const { collapsed, drawerOpen, toggle } = useAdminShell()
  // The rail from lg, the drawer below.
  const railLabel = collapsed ? "Open sidebar" : "Close sidebar"
  const drawerLabel = drawerOpen ? "Close menu" : "Open menu"

  return (
    <header className="bg-carbon sticky top-0 z-40 flex h-[68px] items-center gap-3 border-b border-white/[0.07] px-5 sm:px-8 xl:px-10">
      <button
        type="button"
        onClick={toggle}
        aria-controls="admin-sidebar admin-drawer"
        title="Toggle sidebar (Ctrl+B)"
        className="text-ash hover:text-bone focus-visible:text-bone flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 transition-colors hover:bg-white/[0.05] focus-visible:bg-white/[0.05] focus-visible:outline-none"
      >
        <span className="sr-only lg:hidden">{drawerLabel}</span>
        <span className="sr-only hidden lg:inline">{railLabel}</span>
        {collapsed ? (
          <PanelLeftOpen className="hidden size-[18px] lg:block" strokeWidth={1.8} aria-hidden />
        ) : (
          <PanelLeftClose className="hidden size-[18px] lg:block" strokeWidth={1.8} aria-hidden />
        )}
        <PanelLeftOpen className="size-[18px] lg:hidden" strokeWidth={1.8} aria-hidden />
      </button>
    </header>
  )
}
