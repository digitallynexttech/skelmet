import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { Toaster } from "sonner"

import { AdminHeader } from "@/components/layout/admin-header"
import { AdminShell, SIDEBAR_COOKIE } from "@/components/layout/admin-shell"
import { AdminSidebar } from "@/components/layout/admin-sidebar"
import { QueryProvider } from "@/components/providers/query-provider"
import { auth } from "@/server/auth"
import { staffSession } from "@/server/action-guard"

/** Shell + session gate: reads access from the database, not the token, so revocation is immediate. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!(await auth())?.user) redirect("/login?next=/admin")
  const session = await staffSession()
  if (!session || session.user.kind !== "STAFF") redirect("/")

  // A temporary password must be replaced. /change-password is in (auth), so this cannot loop.
  if (session.user.mustChangePassword) redirect("/change-password?next=/admin")

  // Read on the server so the sidebar opens as it was left, with no jump.
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
