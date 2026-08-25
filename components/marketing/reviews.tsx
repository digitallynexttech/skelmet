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
          <h2 className="mb-6 font-display text-[36px] leading-[1.04] text-bone uppercase sm:text-[46px] xl:text-[52px]">
            What riders say
          </h2>

          <div className="mb-2 flex items-baseline gap-3">
            <span className="font-display text-[56px] leading-none text-blaze sm:text-[66px]">
              {product.rating}
            </span>
            <span className="text-[15px] text-ash">/ 5 · {product.reviewCount} reviews</span>
          </div>
          <Stars rating={product.rating} className="mb-7 block text-[17px]" />

          <div className="flex flex-col gap-2.5">
            {RATING_BREAKDOWN.map((row) => (
              <div key={row.stars} className="flex items-center gap-3">
                <span className="w-3.5 font-mono text-[11px] text-dim">{row.stars}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-sm bg-white/[0.09]">
                  <span
                    className="block h-full rounded-sm bg-blaze"
                    style={{ width: `${row.percent}%` }}
                  />
                </span>
                <span className="w-9 text-right font-mono text-[11px] text-ash">
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
              className="rounded-tile border border-white/[0.09] bg-carbon p-6"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <Stars rating={review.rating} className="text-[13px]" />
                <Badge variant="acid">Verified</Badge>
              </div>
              <h3 className="mb-2 text-[15.5px] font-bold text-bone">{review.title}</h3>
              <p className="mb-4 text-[14px] leading-[1.58] text-ash">{review.body}</p>
              <div className="font-mono text-[11px] tracking-[0.1em] text-dim">{review.author}</div>
            </article>
          ))}
        </div>
      </div>
    </Section>
  )
}
