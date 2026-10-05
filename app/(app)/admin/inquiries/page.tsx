import type { Metadata } from "next"

import { InquiryInbox } from "@/features/inquiries/components/inquiry-inbox"

export const metadata: Metadata = {
  title: "Inquiries",
  description: "Messages sent through the contact form, oldest first.",
}

export default function AdminInquiriesPage() {
  return <InquiryInbox />
}
