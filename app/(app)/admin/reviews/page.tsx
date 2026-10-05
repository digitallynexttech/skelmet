import type { Metadata } from "next"

import { ReviewQueue } from "@/features/reviews/components/review-queue"

export const metadata: Metadata = {
  title: "Reviews",
  description: "Reviews waiting to be published on the product page, oldest first.",
}

export default function AdminReviewsPage() {
  return <ReviewQueue />
}
