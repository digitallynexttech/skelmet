import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { pageMetadata } from "@/components/marketing/page-metadata"
import { PolicyPage } from "@/features/policies/components/policy-page"
import { POLICIES, getPolicy } from "@/features/policies/policies"
import { paymentOptions, shippingCharge } from "@/features/settings/server/runtime-settings"

type Params = { slug: string }

// Unknown slugs get a real 404 from proxy.ts (notFound() here would answer 200).
// Not `dynamicParams = false`: a Settings change refreshes this page, which would then 404 itself.
export const revalidate = 60

export function generateStaticParams(): Params[] {
  return POLICIES.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params
  const policy = getPolicy(slug)
  if (!policy) return { title: "Not found" }

  return pageMetadata({
    title: policy.title,
    description: policy.intro,
    path: `/policies/${policy.slug}`,
  })
}

export default async function PolicyRoute({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const policy = getPolicy(slug, await shippingCharge(), await paymentOptions())
  if (!policy) notFound()

  return <PolicyPage policy={policy} />
}
