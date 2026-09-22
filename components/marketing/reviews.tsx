import { RATING_BREAKDOWN, REVIEWS } from "@/components/marketing/content"
import { Section } from "@/components/marketing/section"
import { SectionLabel } from "@/components/shared/section-label"
import { Stars } from "@/components/shared/stars"
import { Badge } from "@/components/ui/badge"
import { FLAME_SKULL_MOUNT } from "@/features/catalog/catalog"

export function Reviews() {
  const product = FLAME_SKULL_MOUNT

  return (
    <Section id="reviews">
      <div className="grid gap-10 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-14">
        <div>
          <SectionLabel index="11" className="mb-3.5">
            Reviews
          </SectionLabel>
          <h2 className="font-display text-bone mb-6 text-[36px] leading-[1.04] uppercase sm:text-[46px] xl:text-[52px]">
            What riders say
          </h2>

          <div className="mb-2 flex items-baseline gap-3">
            <span className="font-display text-blaze text-[56px] leading-none sm:text-[66px]">
              {product.rating}
            </span>
            <span className="text-ash text-[15px]">/ 5 · {product.reviewCount} reviews</span>
          </div>
          <Stars rating={product.rating} className="mb-7 block text-[17px]" />

          <div className="flex flex-col gap-2.5">
            {RATING_BREAKDOWN.map((row) => (
              <div key={row.stars} className="flex items-center gap-3">
                <span className="text-dim w-3.5 font-mono text-[11px]">{row.stars}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-sm bg-white/[0.09]">
                  <span
                    className="bg-blaze block h-full rounded-sm"
                    style={{ width: `${row.percent}%` }}
                  />
                </span>
                <span className="text-ash w-9 text-right font-mono text-[11px]">
                  {row.percent}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {REVIEWS.map((review) => (
            <article
              key={review.title}
              className="rounded-tile bg-carbon border border-white/[0.09] p-6"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <Stars rating={review.rating} className="text-[13px]" />
                <Badge variant="acid">Verified</Badge>
              </div>
              <h3 className="text-bone mb-2 text-[15.5px] font-bold">{review.title}</h3>
              <p className="text-ash mb-4 text-[14px] leading-[1.58]">{review.body}</p>
              <div className="text-dim font-mono text-[11px] tracking-[0.1em]">{review.author}</div>
            </article>
          ))}
        </div>
      </div>
    </Section>
  )
}
