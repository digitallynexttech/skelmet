"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

/**
 * Sidebar state shared by the sidebar and the header toggle. From lg the rail's state is kept in
 * a cookie the layout reads, so a reload does not flash it open; below lg it is a drawer.
 * Ctrl/Cmd+B toggles, except while typing, where it stays Bold.
 */

/** Read by app/(app)/layout.tsx. */
export const SIDEBAR_COOKIE = "skm_admin_sidebar"

type AdminShellState = {
  /** The desktop rail is closed. */
  collapsed: boolean
  /** The phone drawer is open. */
  drawerOpen: boolean
  /** Rail on desktop, drawer below lg. */
  toggle: () => void
  closeDrawer: () => void
}

const AdminShellContext = React.createContext<AdminShellState | null>(null)

export function useAdminShell(): AdminShellState {
  const shell = React.useContext(AdminShellContext)
  if (!shell) throw new Error("useAdminShell outside AdminShell")
  return shell
}

const isDesktop = () => window.matchMedia("(min-width: 1024px)").matches

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
}

export function AdminShell({
  initialCollapsed,
  children,
}: {
  initialCollapsed: boolean
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = React.useState(initialCollapsed)
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  // The drawer closes when the page changes under it.
  const [openedOn, setOpenedOn] = React.useState(pathname)
  if (drawerOpen && openedOn !== pathname) setDrawerOpen(false)

  React.useEffect(() => {
    document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? "closed" : "open"}; path=/admin; max-age=31536000; samesite=lax`
  }, [collapsed])

  const toggle = React.useCallback(() => {
    if (isDesktop()) {
      setCollapsed((c) => !c)
      return
    }
    setOpenedOn(pathname)
    setDrawerOpen((o) => !o)
  }, [pathname])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "b" || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) {
        return
      }
      if (isTyping(e.target)) return
      e.preventDefault()
      toggle()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [toggle])

  const value = React.useMemo(
    () => ({ collapsed, drawerOpen, toggle, closeDrawer: () => setDrawerOpen(false) }),
    [collapsed, drawerOpen, toggle],
  )
  return <AdminShellContext.Provider value={value}>{children}</AdminShellContext.Provider>
}
