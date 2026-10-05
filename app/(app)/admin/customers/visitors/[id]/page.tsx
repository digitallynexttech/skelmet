import type { Metadata } from "next"

import { VisitorDetailView } from "@/features/visitors/components/visitor-detail"

export const metadata: Metadata = {
  title: "Visitor",
  description: "One visitor: their visits, the pages they saw and where they came from.",
}

export default async function AdminVisitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <VisitorDetailView id={id} />
}
