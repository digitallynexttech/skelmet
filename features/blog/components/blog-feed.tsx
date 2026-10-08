"use client"

import * as React from "react"

import { BLOG_CATEGORIES, type BlogListItem } from "@/features/blog/blog"
import { PostCard } from "@/features/blog/components/post-card"
import { cn } from "@/lib/utils"

/**
 * The posts, filtered by category in memory: no request, and no search param, which would need a
 * Suspense boundary on a prerendered page.
 */
export function BlogFeed({ posts }: { posts: BlogListItem[] }) {
  const [category, setCategory] = React.useState<string>("all")

  // Only non-empty categories, in the Studio's order.
  const categories = BLOG_CATEGORIES.filter((c) => posts.some((p) => p.category === c.value))
  const shown = category === "all" ? posts : posts.filter((p) => p.category === category)

  // The featured post leads, else the newest; filtered, the newest in that category.
  const lead = (category === "all" ? shown.find((p) => p.featured) : undefined) ?? shown[0]
  const rest = shown.filter((p) => p !== lead)

  if (posts.length === 0) {
    return (
      <div className="rounded-card bg-carbon border border-dashed border-white/[0.14] px-6 py-16 text-center">
        <h2 className="font-display text-bone mb-3 text-[28px] leading-[1.1] uppercase">
          Nothing here yet
        </h2>
        <p className="text-ash mx-auto max-w-[420px] text-[15px] leading-[1.6]">
          The first posts are being written. Come back soon.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {categories.length > 1 ? (
        <div className="flex flex-wrap gap-2.5" role="group" aria-label="Filter posts by category">
          {[{ value: "all", label: "All posts" }, ...categories].map((c) => {
            const on = c.value === category
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={on}
                onClick={() => setCategory(c.value)}
                className={cn(
                  "min-h-11 rounded-full border px-5 text-[13px] font-semibold tracking-[0.04em] uppercase transition-colors",
                  on
                    ? "border-blaze bg-blaze/[0.1] text-bone"
                    : "text-ash hover:text-bone border-white/[0.14] hover:border-white/30",
                )}
              >
                {c.label}
              </button>
            )
          })}
        </div>
      ) : null}

      {lead ? <PostCard post={lead} lead /> : null}

      {rest.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((post) => (
            <PostCard key={post._id} post={post} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
