"use client"

import { Suspense } from "react"

import { CouponManager } from "@/features/coupons/components/coupon-manager"

export default function AdminCouponsPage() {
  return (
    <Suspense fallback={<div className="rounded-card h-96 animate-pulse bg-white/5" />}>
      <CouponManager />
    </Suspense>
  )
}
