import type { Metadata } from "next"
import { Suspense } from "react"

import { VisitorTable } from "@/features/visitors/components/visitor-table"

export const metadata: Metadata = {
  title: "Visitors",
  description:
    "Everyone who has browsed the shop: by device for those who accepted cookies, anonymously for everyone else.",
}

export default function AdminVisitorsPage() {
  return (
    // useSearchParams needs a Suspense boundary in the app router.
    <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-white/5" />}>
      <VisitorTable />
    </Suspense>
  )
}
