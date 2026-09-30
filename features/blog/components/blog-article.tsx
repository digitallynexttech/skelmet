import Link from "next/link"
import { ArrowLeft, ArrowRight } from "lucide-react"

import { Section } from "@/components/marketing/section"
import { ButtonLink } from "@/components/ui/button"
import { siteConfig } from "@/config/site"
import {
  categoryLabel,
  extractHeadings,
  type BlogListItem,
  type BlogPost,
} from "@/features/blog/blog"
import { PostBody } from "@/features/blog/components/post-body"
import { PostCard, postMeta } from "@/features/blog/components/post-card"
import { SanityImage } from "@/features/blog/components/sanity-image"
import { imageUrl } from "@/features/blog/lib/image"
import { PRODUCTS } from "@/features/catalog/catalog"

/** The post as search engines read it: schema.org's BlogPosting. */
function structuredData(post: BlogPost) {
  const cover = imageUrl(post.coverImage, { width: 1200, height: 675 })
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    ...(cover ? { image: [cover] } : {}),
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    mainEntityOfPage: `${siteConfig.url}/blog/${post.slug}`,
    author: post.author?.name
      ? { "@type": "Person", name: post.author.name }
      : { "@type": "Organization", name: siteConfig.name, url: siteConfig.url },
    publisher: { "@type": "Organization", name: siteConfig.name, url: siteConfig.url },
  }
}

/**
 * One post: its header, cover, body, and what to read next.
 *
 * `more` is the other posts, newest first; the first three are offered at the
 * end.
 */
export function BlogArticle({ post, more }: { post: BlogPost; more: BlogListItem[] }) {
  const cover = imageUrl(post.coverImage, { width: 1600, height: 900 })
  const photo = imageUrl(post.author?.photo, { width: 112, height: 112 })
  // Sub-headings stay out of the list: it is for finding a part, not a map of all of them.
  const contents = extractHeadings(post.body).filter((h) => h.level === 2)
  const hasContents = contents.length >= 3
  const product = PRODUCTS[0]!

  return (
    <>
      <script
        type="application/ld+json"
        // The post's own words, serialised: "<" is escaped so a title cannot close the tag.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData(post)).replace(/</g, "\\u003c"),
        }}
      />

      <Section className="pb-0">
        <Link
          href="/blog"
          className="text-ash hover:text-bone mb-8 inline-flex min-h-11 items-center gap-2 text-[13.5px] transition-colors"
        >
          <ArrowLeft className="size-4" strokeWidth={2} />
          All posts
        </Link>

        <header className="max-w-[900px]">
          <div className="text-ember mb-4 font-mono text-[11.5px] tracking-[0.22em] uppercase">
            {categoryLabel(post.category)}
          </div>
          <h1 className="font-display text-bone mb-5 text-[40px] leading-[1.02] text-balance uppercase sm:text-[56px] xl:text-[68px]">
            {post.title}
          </h1>
          {post.excerpt ? (
            <p className="text-ash max-w-[680px] text-[17px] leading-[1.6] text-pretty sm:text-[19px]">
              {post.excerpt}
            </p>
          ) : null}

          <div className="mt-7 flex items-center gap-3.5">
            {photo ? (
              <SanityImage
                src={photo}
                alt=""
                width={44}
                height={44}
                sizes="44px"
                className="size-11 rounded-full object-cover"
              />
            ) : null}
            <div className="flex flex-col gap-0.5">
              <span className="text-bone text-[14.5px] font-semibold">
                {post.author?.name ?? siteConfig.name}
                {post.author?.role ? (
                  <span className="text-dim font-normal"> · {post.author.role}</span>
                ) : null}
              </span>
              <span className="text-dim font-mono text-[11.5px] tracking-[0.06em]">
                {postMeta(post)}
              </span>
            </div>
          </div>
        </header>

        {cover ? (
          <div className="rounded-card bg-graphite relative mt-10 aspect-video overflow-hidden border border-white/[0.09]">
            <SanityImage
              src={cover}
              alt={post.coverImage?.alt ?? ""}
              fill
              // The page's main image.
              preload
              fetchPriority="high"
              sizes="(min-width: 1280px) 1328px, 100vw"
              className="object-cover"
            />
          </div>
        ) : null}
      </Section>

      <Section className="pt-10 sm:pt-12 xl:pt-14">
        <div className="mx-auto flex max-w-[1080px] flex-col gap-10 lg:flex-row lg:gap-16">
          <article className="min-w-0 flex-1 lg:max-w-[760px]">
            {/* The first paragraph sits flush with the top of the column. */}
            <div className="[&>*:first-child]:mt-0">
              <PostBody body={post.body ?? []} />
            </div>

            {post.author?.bio ? (
              <aside className="rounded-tile bg-carbon mt-14 flex gap-4 border border-white/[0.09] p-6">
                {photo ? (
                  <SanityImage
                    src={photo}
                    alt=""
                    width={56}
                    height={56}
                    sizes="56px"
                    className="size-14 shrink-0 rounded-full object-cover"
                  />
                ) : null}
                <div>
                  <div className="text-dim mb-1.5 font-mono text-[10.5px] tracking-[0.18em] uppercase">
                    Written by
                  </div>
                  <div className="text-bone mb-2 text-[16px] font-semibold">{post.author.name}</div>
                  <p className="text-ash text-[14.5px] leading-[1.6]">{post.author.bio}</p>
                </div>
              </aside>
            ) : null}
          </article>

          {hasContents ? (
            <nav
              aria-label="On this page"
              className="hidden w-[240px] shrink-0 lg:sticky lg:top-[106px] lg:block lg:self-start"
            >
              <div className="text-dim mb-4 font-mono text-[10.5px] tracking-[0.18em] uppercase">
                On this page
              </div>
              <ul className="flex flex-col gap-3 border-l border-white/[0.09] pl-4">
                {contents.map((h) => (
                  <li key={h.key}>
                    <a
                      href={`#${h.id}`}
                      className="text-ash hover:text-bone block text-[13.5px] leading-[1.4] transition-colors"
                    >
                      {h.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
      </Section>

      {/* What all of this is about: the mount. One line and one button. */}
      <Section className="bg-carbon border-y border-white/[0.07]">
        <div className="mx-auto flex max-w-[1080px] flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-bone mb-2 text-[30px] leading-[1.05] uppercase sm:text-[38px]">
              Give your helmet a wall
            </h2>
            <p className="text-ash max-w-[460px] text-[15.5px] leading-[1.6]">
              {siteConfig.description.split(". ")[0]}.
            </p>
          </div>
          <ButtonLink href={`/product/${product.slug}`} variant="primary" size="md">
            See the mount
            <ArrowRight className="size-4" strokeWidth={2.4} />
          </ButtonLink>
        </div>
      </Section>

      {more.length > 0 ? (
        <Section>
          <h2 className="font-display text-bone mb-8 text-[34px] leading-[1.04] uppercase sm:text-[44px]">
            Keep reading
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {more.slice(0, 3).map((other) => (
              <PostCard key={other._id} post={other} heading="h3" />
            ))}
          </div>
        </Section>
      ) : null}
    </>
  )
}
