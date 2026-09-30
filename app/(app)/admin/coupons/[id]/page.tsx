"use client"

import { use } from "react"

import { CouponHistoryView } from "@/features/coupons/components/coupon-history"

export default function AdminCouponPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <CouponHistoryView id={id} />
}
