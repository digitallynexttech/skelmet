import { redirect } from "next/navigation"
import { Toaster } from "sonner"

import { AdminSidebar } from "@/components/layout/admin-sidebar"
import { QueryProvider } from "@/components/providers/query-provider"
import { auth } from "@/server/auth"

/**
 * Shell + session gate. No database queries here (§2) - the session already
 * carries roles and permissions from the JWT.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect("/login?next=/admin")
  if (session.user.kind !== "STAFF") redirect("/")

  // The flag was set by createStaff and resetStaffPassword, carried onto the
  // JWT, typed on the session - and read by nothing, so a temporary password
  // an admin chose stayed valid for as long as its owner never bothered. This
  // is the half that makes it mean something. The target is in the (auth)
  // group precisely so this redirect cannot loop into itself.
  if (session.user.mustChangePassword) redirect("/change-password?next=/admin")

  return (
    <QueryProvider>
      <div className="bg-void flex min-h-dvh">
        <AdminSidebar permissions={session.user.permissions} />
        <div className="min-w-0 flex-1">
          <main className="px-5 pt-20 pb-16 sm:px-8 lg:pt-10 xl:px-10">{children}</main>
        </div>
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            style: {
              background: "var(--color-graphite)",
              border: "1px solid rgb(255 255 255 / 0.1)",
              color: "var(--color-bone)",
            },
          }}
        />
      </div>
    </QueryProvider>
  )
}
