"use client"

import { use } from "react"

import { CouponHistoryView } from "@/features/coupons/components/coupon-history"

export default function AdminCouponPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  return <CouponHistoryView code={decodeURIComponent(code)} />
}
