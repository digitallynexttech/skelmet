import type { Metadata } from "next"
import { Suspense } from "react"

import { CouponManager } from "@/features/coupons/components/coupon-manager"

export const metadata: Metadata = {
  title: "Offers & codes",
  description: "Discount codes for checkout and the cart, live and archived.",
}

export default function AdminCouponsPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-md bg-white/5" />}>
      <CouponManager />
    </Suspense>
  )
}
