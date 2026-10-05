"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

/**
 * Whether the console's sidebar is showing, shared by the sidebar and the
 * header's toggle.
 *
 * From lg the sidebar is a rail that closes to its icons and opens again; the
 * choice is kept in a cookie, which the layout reads, so a reload opens the
 * page as it was left rather than flashing the rail open first. Below lg it
 * is a drawer, closed on every page.
 *
 * Ctrl+B (Cmd+B on a Mac) does what the toggle does - except while typing in
 * a field or an editor, where it is Bold and stays Bold.
 */

/** Read by app/(app)/layout.tsx. */
export const SIDEBAR_COOKIE = "skm_admin_sidebar"

type AdminShellState = {
  /** The desktop rail is closed. */
  collapsed: boolean
  /** The phone drawer is open. */
  drawerOpen: boolean
  /** Opens or closes whichever of the two this screen has. */
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
  // The drawer closes when the page changes under it: a link in it was used.
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
