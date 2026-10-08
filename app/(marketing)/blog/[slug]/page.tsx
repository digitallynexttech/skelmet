import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { pageMetadata } from "@/components/marketing/page-metadata"
import { BlogArticle } from "@/features/blog/components/blog-article"
import { imageUrl } from "@/features/blog/lib/image"
import { getBlogPost, getBlogPosts, getBlogSlugs } from "@/features/blog/server/sanity"

type Params = { slug: string }

// Unknown slugs stay open for posts published after the build; proxy.ts 404s non-posts.
export const revalidate = 60

export async function generateStaticParams(): Promise<Params[]> {
  try {
    return (await getBlogSlugs()).map((slug) => ({ slug }))
  } catch {
    // Sanity out of reach at build time: the posts render on their first visit instead.
    return []
  }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params
  const post = await getBlogPost(slug).catch(() => null)
  if (!post) return { title: "Not found" }

  const cover = imageUrl(post.coverImage, { width: 1200, height: 630 })
  const meta = pageMetadata({
    title: post.title,
    description: post.excerpt ?? "",
    path: `/blog/${post.slug}`,
    ...(cover
      ? { image: { url: cover, width: 1200, height: 630, alt: post.coverImage?.alt ?? post.title } }
      : {}),
  })
  return {
    ...meta,
    openGraph: {
      ...meta.openGraph,
      type: "article",
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt,
    },
  }
}

export default async function BlogPostPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const [post, posts] = await Promise.all([
    getBlogPost(slug).catch(() => null),
    getBlogPosts().catch(() => []),
  ])
  if (!post) notFound()

  return <BlogArticle post={post} more={posts.filter((p) => p.slug !== post.slug)} />
}
