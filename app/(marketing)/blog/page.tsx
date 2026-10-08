import type { Metadata } from "next"

import { pageMetadata } from "@/components/marketing/page-metadata"
import type { BlogListItem } from "@/features/blog/blog"
import { BlogIndex } from "@/features/blog/components/blog-index"
import { getBlogPosts } from "@/features/blog/server/sanity"

export const metadata: Metadata = pageMetadata({
  title: "Blog",
  description: "Helmet care, riding, gear, and how the SKELMET mount gets made.",
  path: "/blog",
})

// Each minute: a new post needs no deploy.
export const revalidate = 60

export default async function BlogPage() {
  // An unreachable Sanity renders an empty page, not a failed build.
  let posts: BlogListItem[] = []
  try {
    posts = await getBlogPosts()
  } catch (err) {
    console.error("[BLOG] could not read the posts", err)
  }

  return <BlogIndex posts={posts} />
}
