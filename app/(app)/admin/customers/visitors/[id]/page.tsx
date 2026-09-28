"use client"

import { use } from "react"

import { VisitorDetailView } from "@/features/visitors/components/visitor-detail"

export default function AdminVisitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <VisitorDetailView id={id} />
}
