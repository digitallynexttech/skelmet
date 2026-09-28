"use client"

import { Suspense } from "react"

import { VisitorTable } from "@/features/visitors/components/visitor-table"

export default function AdminVisitorsPage() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-white/5" />}>
      <VisitorTable />
    </Suspense>
  )
}
