import type { Metadata } from "next"
import { Suspense } from "react"

import { PageSkeleton } from "@/components/shared/page-skeleton"

import { CouponManager } from "@/features/coupons/components/coupon-manager"

export const metadata: Metadata = {
  title: "Offers & codes",
  description: "Discount codes for checkout and the cart, live and archived.",
}

export default function AdminCouponsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CouponManager />
    </Suspense>
  )
}
