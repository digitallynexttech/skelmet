"use client"

import { Suspense } from "react"

import { CouponManager } from "@/features/coupons/components/coupon-manager"

export default function AdminCouponsPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-card bg-white/5" />}>
      <CouponManager />
    </Suspense>
  )
}
