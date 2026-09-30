import { Section } from "@/components/marketing/section"
import { HeroWatermark } from "@/components/shared/hero-watermark"
import { SectionLabel } from "@/components/shared/section-label"
import type { BlogListItem } from "@/features/blog/blog"
import { BlogFeed } from "@/features/blog/components/blog-feed"

/** The blog page: the hero every storefront page opens with, then the posts. */
export function BlogIndex({ posts }: { posts: BlogListItem[] }) {
  return (
    <>
      <Section className="overflow-hidden pb-0">
        <HeroWatermark accent="blaze">BLOG</HeroWatermark>

        <div className="relative z-10">
          <SectionLabel className="mb-4">The SKELMET blog</SectionLabel>
          <h1 className="font-display text-bone mb-5 text-[52px] leading-[1.0] uppercase sm:text-[72px] xl:text-[88px]">
            From the
            <br />
            garage
          </h1>
          <p className="text-ash max-w-[540px] text-[16px] leading-[1.62] sm:text-[17.5px]">
            Helmet care, riding, gear, and how the mount gets made.
          </p>
        </div>
      </Section>

      <Section>
        <BlogFeed posts={posts} />
      </Section>
    </>
  )
}
