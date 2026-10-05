import { redirect } from "next/navigation"

import { firstSectionFor } from "@/components/layout/admin-nav"
import { staffSession } from "@/server/action-guard"

/**
 * The console's front door, and where a sign-in lands: on to the dashboard,
 * or for someone who may not read it, the first section they may open. The
 * layout has already turned away anyone who is not staff.
 */
export default async function AdminIndexPage() {
  const session = await staffSession()
  redirect(firstSectionFor(session?.user.permissions ?? []))
}
