import { redirect } from "next/navigation"
import { Toaster } from "sonner"

import { AdminSidebar } from "@/components/layout/admin-sidebar"
import { QueryProvider } from "@/components/providers/query-provider"
import { auth } from "@/server/auth"

/**
 * Shell + session gate. No database queries here (§2) — the session already
 * carries roles and permissions from the JWT.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect("/login?next=/admin")
  if (session.user.kind !== "STAFF") redirect("/")

  return (
    <QueryProvider>
      <div className="flex min-h-dvh bg-void">
        <AdminSidebar
          permissions={session.user.permissions}
          user={{ name: session.user.name ?? null, email: session.user.email ?? "" }}
        />
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
