"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import { ChevronRight, LogOut, X } from "lucide-react"

import { NAV, type NavChild } from "@/components/layout/admin-nav"
import { useAdminShell } from "@/components/layout/admin-shell"
import { Wordmark } from "@/components/shared/wordmark"
import { siteConfig } from "@/config/site"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import type { Permission } from "@/lib/constants"
import { cn } from "@/lib/utils"

// The "↳" from a section into one of its pages. Its offsets follow the section row's px-3.5,
// 18px icon and the page rows' h-9: change those and these move with them.
function Elbow() {
  return (
    <svg
      width={16}
      height={23}
      viewBox="0 0 16 23"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="miter"
      aria-hidden
      className="pointer-events-none absolute -top-0.5 left-[22px] text-white/25"
    >
      <path d="M1 0v20h10" />
      <path d="m9 18 2 2-2 2" />
    </svg>
  )
}

const within = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`)

// The longest child href the page sits under; none for the section's own pages.
function currentChild(pathname: string, children: NavChild[]): NavChild | undefined {
  return children
    .filter((c) => within(pathname, c.href))
    .sort((a, b) => b.href.length - a.href.length)[0]
}

export function AdminSidebar({ permissions }: { permissions: Permission[] }) {
  const pathname = usePathname()
  const { collapsed, drawerOpen: open, closeDrawer } = useAdminShell()
  const [confirmingSignOut, setConfirmingSignOut] = React.useState(false)
  // Never unset: signOut navigates away. Stops a second press during the redirect.
  const [signingOut, setSigningOut] = React.useState(false)

  // Cosmetic filter only - proxy.ts and requirePermission are the enforcement.
  const items = NAV.filter((item) => permissions.includes(item.scope))

  // compact: the closed desktop rail, icons only with sr-only labels. The drawer is never compact.
  const body = (compact: boolean) => (
    <>
      <div
        className={cn(
          "flex h-[68px] items-center border-b border-white/[0.07]",
          compact ? "justify-center" : "gap-3 px-5",
        )}
      >
        {compact ? (
          <Link href="/" title={siteConfig.name} className="inline-flex items-center">
            <Image
              src="/brand/skelmet-mark.png"
              width={351}
              height={435}
              alt={siteConfig.name}
              sizes="32px"
              className="h-8 w-auto"
            />
          </Link>
        ) : (
          <Wordmark size="sm" />
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        {items.map((item) => {
          const active = within(pathname, item.href)
          const current =
            item.children && active ? currentChild(pathname, item.children) : undefined
          const here = active && !current
          // The closed rail hides child pages, so the section lights for any of them.
          const lit = compact ? active : here
          return (
            <div key={item.href}>
              <Link
                href={item.href}
                aria-current={here ? "page" : lit ? "true" : undefined}
                title={compact ? item.label : undefined}
                // Only one row lights, or two would read as the current page.
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-xl text-[14px] transition-colors",
                  compact ? "justify-center" : "px-3.5",
                  lit
                    ? "bg-blaze/12 text-bone font-semibold"
                    : "text-ash hover:text-bone hover:bg-white/[0.04]",
                )}
              >
                <item.icon
                  className={cn("size-[18px] shrink-0", lit ? "text-blaze" : "text-dim")}
                  strokeWidth={1.8}
                />
                <span className={compact ? "sr-only" : undefined}>{item.label}</span>
                {item.children && !compact ? (
                  <ChevronRight
                    aria-hidden
                    className={cn(
                      "text-dim ml-auto size-4 shrink-0 transition-transform duration-200",
                      active && "rotate-90",
                    )}
                    strokeWidth={2}
                  />
                ) : null}
              </Link>
              {/* A section's pages show only while you are in it. */}
              {item.children && active && !compact ? (
                <ul className="flex flex-col gap-0.5 py-0.5">
                  {item.children.map((child) => {
                    const on = current?.href === child.href
                    return (
                      <li key={child.href} className="relative">
                        <Elbow />
                        {/* ml-[36px] clears the arrow; px-2 aligns the label with the section. */}
                        <Link
                          href={child.href}
                          aria-current={on ? "page" : undefined}
                          className={cn(
                            "ml-[36px] flex min-h-9 items-center rounded-lg px-2 text-[13.5px] transition-colors",
                            on
                              ? "bg-blaze/12 text-bone font-semibold"
                              : "text-ash hover:text-bone hover:bg-white/[0.04]",
                          )}
                        >
                          {child.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </div>
          )
        })}
      </nav>

      <div className="border-t border-white/[0.07] p-3">
        <button
          type="button"
          onClick={() => setConfirmingSignOut(true)}
          title={compact ? "Sign out" : undefined}
          className={cn(
            "text-ash hover:text-magenta flex min-h-11 w-full items-center gap-3 rounded-md text-[14px] transition-colors hover:bg-white/[0.04]",
            compact ? "justify-center" : "px-3.5",
          )}
        >
          <LogOut className="text-dim size-[18px] shrink-0" strokeWidth={1.8} />
          <span className={compact ? "sr-only" : undefined}>Sign out</span>
        </button>
      </div>
    </>
  )

  return (
    <>
      <aside
        id="admin-sidebar"
        className={cn(
          "bg-carbon sticky top-0 hidden h-dvh shrink-0 flex-col overflow-hidden border-r border-white/[0.07] transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:flex",
          collapsed ? "w-[72px]" : "w-[248px]",
        )}
      >
        {body(collapsed)}
      </aside>

      <div
        className={cn("fixed inset-0 z-50 lg:hidden", open ? "" : "pointer-events-none")}
        aria-hidden={!open}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close menu"
          onClick={closeDrawer}
          className={cn(
            "bg-void/80 absolute inset-0 transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          id="admin-drawer"
          className={cn(
            "bg-carbon absolute inset-y-0 left-0 flex w-[262px] flex-col border-r border-white/[0.08] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <button
            type="button"
            aria-label="Close menu"
            onClick={closeDrawer}
            className="text-bone absolute top-3.5 right-3 z-10 flex size-10 items-center justify-center"
          >
            <X className="size-5" strokeWidth={2} />
          </button>
          {body(false)}
        </div>
      </div>

      {/* Outside both copies of `body`, or each would render its own dialog. */}
      <ConfirmDialog
        open={confirmingSignOut}
        title="Sign out?"
        body="You will need your email and password to sign back in."
        confirmLabel="Sign out"
        tone="danger"
        pending={signingOut}
        onConfirm={() => {
          setSigningOut(true)
          void signOut({ callbackUrl: "/login" })
        }}
        onClose={() => setConfirmingSignOut(false)}
      />
    </>
  )
}
