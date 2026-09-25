import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { PolicyPage } from "@/features/policies/components/policy-page"
import { POLICIES, getPolicy } from "@/features/policies/policies"
import { shippingCharge } from "@/features/settings/server/runtime-settings"

type Params = { slug: string }

/**
 * Every policy slug is known at build time, so anything else is not a page
 * that might appear later - it is a wrong URL, and proxy.ts answers it with a
 * real 404 before it gets here. notFound() below would render the not-found
 * screen but answer 200, a soft 404 search engines index as a real page:
 * /policies/referral became exactly that when the referral programme went.
 *
 * Not `dynamicParams = false`, which did that job before: the shipping policy
 * states the shipping charge set in Settings, a change there refreshes this
 * page, and a refreshed page limited to its prerendered params 404s itself.
 */
export const revalidate = 60

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
  const policy = getPolicy(slug, await shippingCharge())
  if (!policy) notFound()

  return <PolicyPage policy={policy} />
}
