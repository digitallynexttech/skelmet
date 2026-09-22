import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PolicyPage } from "@/features/policies/components/policy-page"
import { POLICIES, getPolicy } from "@/features/policies/policies"

type Params = { slug: string }

export function generateStaticParams(): Params[] {
  return POLICIES.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params
  const policy = getPolicy(slug)
  if (!policy) return { title: "Not found" }

  return {
    title: policy.title,
    description: policy.intro,
    alternates: { canonical: `/policies/${policy.slug}` },
  }
}

export default async function PolicyRoute({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const policy = getPolicy(slug)
  if (!policy) notFound()

  return <PolicyPage policy={policy} />
}
