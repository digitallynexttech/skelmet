import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Toaster } from "sonner"

import { AdminHeader } from "@/components/layout/admin-header"
import { AdminShell, SIDEBAR_COOKIE } from "@/components/layout/admin-shell"
import { AdminSidebar } from "@/components/layout/admin-sidebar"
import { QueryProvider } from "@/components/providers/query-provider"
import { auth } from "@/server/auth"
import { staffSession } from "@/server/action-guard"

/**
 * Shell + session gate. One query, for access that is current rather than
 * whatever the week-old token remembers: a revoked staff member is sent away
 * here on their next page load, and the sidebar only offers what they can
 * still do.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await auth())?.user) redirect("/login?next=/admin")
  const session = await staffSession()
  if (!session || session.user.kind !== "STAFF") redirect("/")

  // The flag was set by createStaff and resetStaffPassword, carried onto the
  // JWT, typed on the session - and read by nothing, so a temporary password
  // an admin chose stayed valid for as long as its owner never bothered. This
  // is the half that makes it mean something. The target is in the (auth)
  // group precisely so this redirect cannot loop into itself.
  if (session.user.mustChangePassword) redirect("/change-password?next=/admin")

  // The sidebar as it was left (components/layout/admin-shell.tsx), read
  // here so the page opens that way instead of correcting itself after load.
  const collapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "closed"

  return (
    <QueryProvider>
      <AdminShell initialCollapsed={collapsed}>
        {/* data-console: the console's corners (globals.css). */}
        <div data-console className="bg-void flex min-h-dvh">
          <AdminSidebar permissions={session.user.permissions} />
          <div className="min-w-0 flex-1">
            <AdminHeader />
            <main className="px-5 pt-8 pb-16 sm:px-8 lg:pt-10 xl:px-10">{children}</main>
          </div>
          <Toaster
            position="bottom-right"
            theme="dark"
            toastOptions={{
              style: {
                background: "var(--color-graphite)",
                border: "1px solid rgb(255 255 255 / 0.1)",
                color: "var(--color-bone)",
                // Sonner's own 8px otherwise: the console's corner is rounded-sm.
                borderRadius: "var(--radius-sm, 0.25rem)",
              },
            }}
          />
        </div>
      </AdminShell>
    </QueryProvider>
  )
}
