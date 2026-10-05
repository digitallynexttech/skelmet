import type { Metadata } from "next"

import { SubscriberList } from "@/features/newsletter/components/subscriber-list"

export const metadata: Metadata = {
  title: "Newsletter",
  description: "Everyone signed up for news of the next drop.",
}

export default function AdminNewsletterPage() {
  return <SubscriberList />
}
