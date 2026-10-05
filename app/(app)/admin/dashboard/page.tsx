import type { Metadata } from "next"

import { AdminDashboard } from "@/features/orders/components/admin-dashboard"

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Today at a glance: orders waiting to be packed, the week's revenue and stock running low.",
}

export default function AdminDashboardPage() {
  return <AdminDashboard />
}
