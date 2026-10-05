import type { Metadata } from "next"
import { Suspense } from "react"

import { PageSkeleton } from "@/components/shared/page-skeleton"

import { SettingsView } from "@/features/settings/components/settings-view"

export const metadata: Metadata = {
  title: "Settings",
  description:
    "Payments, paying on delivery, Shiprocket, the shipping charge, and staff and roles.",
}

export default function AdminSettingsPage() {
  return (
    // The open tab lives in the URL, which useSearchParams reads.
    <Suspense fallback={<PageSkeleton />}>
      <SettingsView />
    </Suspense>
  )
}
