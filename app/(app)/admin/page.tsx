import { redirect } from "next/navigation"

import { firstSectionFor } from "@/components/layout/admin-nav"
import { staffSession } from "@/server/action-guard"

// Sends staff to the first section their permissions open (the dashboard, usually).
export default async function AdminIndexPage() {
  const session = await staffSession()
  redirect(firstSectionFor(session?.user.permissions ?? []))
}
