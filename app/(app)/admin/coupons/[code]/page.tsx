import type { Metadata } from "next"

import { CouponHistoryView } from "@/features/coupons/components/coupon-history"

type Props = { params: Promise<{ code: string }> }

// The code is the page's address and a name a person chose, so it is the title.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const code = decodeURIComponent((await params).code)
  return {
    title: `Code ${code}`,
    description: `Discount code ${code}: its terms and every order that used it.`,
  }
}

export default async function AdminCouponPage({ params }: Props) {
  const { code } = await params
  return <CouponHistoryView code={decodeURIComponent(code)} />
}
