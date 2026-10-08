import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { categoryLabel, formatPostDate, type BlogListItem } from "@/features/blog/blog"
import { SanityImage } from "@/features/blog/components/sanity-image"
import { imageUrl } from "@/features/blog/lib/image"
import { cn } from "@/lib/utils"

/** "30 September 2026 · 4 min read", with whichever half is known. */
export function postMeta(post: Pick<BlogListItem, "publishedAt" | "readMinutes">): string {
  return [formatPostDate(post.publishedAt), post.readMinutes ? `${post.readMinutes} min read` : ""]
    .filter(Boolean)
    .join(" · ")
}

/** One post card. `lead` is the large one across the top, and the page's first image. */
export function PostCard({
  post,
  lead = false,
  heading: Heading = "h2",
}: {
  post: BlogListItem
  lead?: boolean
  /** h2 on the blog page; h3 under a section that has a heading of its own. */
  heading?: "h2" | "h3"
}) {
  const cover = imageUrl(post.coverImage, { width: 1280, height: 720 })

  return (
    <article
      className={cn(
        "group rounded-card bg-carbon relative flex flex-col overflow-hidden border border-white/[0.09] transition-colors hover:border-white/20",
        lead && "lg:flex-row",
      )}
    >
      <div
        className={cn(
          "bg-graphite relative aspect-video shrink-0 overflow-hidden",
          lead && "lg:aspect-auto lg:min-h-[380px] lg:w-[58%]",
        )}
      >
        {cover ? (
          <SanityImage
            src={cover}
            alt={post.coverImage?.alt ?? ""}
            fill
            preload={lead}
            fetchPriority={lead ? "high" : undefined}
            sizes={
              lead
                ? "(min-width: 1024px) 58vw, 100vw"
                : "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            }
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
          />
        ) : null}
        {post.featured ? (
          <Badge variant="blaze" className="absolute top-4 left-4">
            Featured
          </Badge>
        ) : null}
      </div>

      <div className={cn("flex flex-1 flex-col p-6", lead && "lg:justify-center lg:p-10")}>
        <div className="text-ember mb-3 font-mono text-[11px] tracking-[0.2em] uppercase">
          {categoryLabel(post.category)}
        </div>
        <Heading
          className={cn(
            "text-bone mb-3 leading-[1.2] font-bold text-balance",
            lead ? "text-[26px] sm:text-[32px]" : "text-[20px]",
          )}
        >
          {/* The stretched ::after makes the whole card the link. */}
          <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0">
            {post.title}
          </Link>
        </Heading>
        {post.excerpt ? (
          <p
            className={cn(
              "text-ash mb-5 leading-[1.6] text-pretty",
              lead ? "max-w-[520px] text-[16px]" : "line-clamp-3 text-[14.5px]",
            )}
          >
            {post.excerpt}
          </p>
        ) : null}
        <div className="text-dim mt-auto flex items-center justify-between gap-4 font-mono text-[11.5px] tracking-[0.06em]">
          <span>{postMeta(post)}</span>
          <ArrowUpRight
            className="text-ash group-hover:text-blaze size-4 shrink-0 transition-colors"
            strokeWidth={2}
          />
        </div>
      </div>
    </article>
  )
}
