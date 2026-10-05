import type { Metadata } from "next"

import { NewsletterEmails } from "@/features/newsletter/components/newsletter-emails"

export const metadata: Metadata = {
  title: "Write an email",
  description: "Write an email to everyone subscribed, send yourself a test, then send it.",
}

export default function AdminNewsletterEmailsPage() {
  return <NewsletterEmails />
}
