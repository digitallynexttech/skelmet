import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PolicyPage } from "@/features/policies/components/policy-page"
import { POLICIES, getPolicy } from "@/features/policies/policies"

type Params = { slug: string }

/**
 * Every policy slug is known at build time, so anything else is not a page
 * that might appear later - it is a wrong URL. Without this, notFound() below
 * still renders the not-found screen but answers 200, which is a soft 404: the
 * kind search engines index as a real page. /policies/referral became exactly
 * that when the referral programme was removed.
 */
export const dynamicParams = false

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
