"use client"

import { Suspense } from "react"

import { AbandonedCheckouts } from "@/features/orders/components/abandoned-checkouts"

export default function AdminAbandonedCheckoutsPage() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-white/5" />}>
      <AbandonedCheckouts />
    </Suspense>
  )
}
