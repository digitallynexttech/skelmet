import type { Metadata } from "next"
import { metadata as studioMetadata } from "next-sanity/studio"

import { Studio } from "@/features/blog/components/studio"
import { sanityConfigured } from "@/features/blog/sanity/env"

// The blog editor. Sanity does its own sign-in, so no fence of ours; noindex via metadata and robots.ts.
export const dynamic = "force-static"

export { viewport } from "next-sanity/studio"

/** Sanity's metadata (noindex, no referrer) with our tab title. */
export const metadata: Metadata = { ...studioMetadata, title: "Blog studio" }

export default function StudioPage() {
  // The Studio cannot start without a project id: say what is missing.
  if (!sanityConfigured) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <div className="max-w-[460px] text-center">
          <h1 className="font-display text-bone mb-4 text-[34px] leading-[1.05] uppercase">
            The blog is not set up yet
          </h1>
          <p className="text-ash text-[15.5px] leading-[1.65]">
            This is where posts will be written. It needs a Sanity project first: put its id in{" "}
            <code className="text-bone font-mono text-[14px]">config/site.ts</code>, under{" "}
            <code className="text-bone font-mono text-[14px]">sanity.projectId</code>, and deploy.
          </p>
        </div>
      </main>
    )
  }

  return <Studio />
}
