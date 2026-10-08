import { SplitFeature } from "@/components/marketing/split-feature"
import { SectionLabel } from "@/components/shared/section-label"
import { Badge } from "@/components/ui/badge"
import { ButtonLink } from "@/components/ui/button"
import { FLAME_FINISH, FLAME_SKULL_MOUNT, type ProductSections } from "@/features/catalog/catalog"
import { getFeaturedProduct } from "@/features/catalog/server/catalog.service"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"

const TAGS = ["0.2 mm layers", "Matte, not glossy", "Hand-checked"]

export async function Texture({
  /** Where the buy button goes; the product page points it at its own buy panel. */
  ctaHref = `/product/${FLAME_SKULL_MOUNT.slug}`,
  /** The live price, when the page has it already; otherwise read here. */
  price,
  /** The close-up and its words: the Flame Skull's unless a product page gives its own. */
  finish = FLAME_FINISH,
}: {
  ctaHref?: string
  price?: string
  finish?: NonNullable<ProductSections["finish"]>
} = {}) {
  // The live admin price, not the registry's, so it matches the product page.
  const shown =
    price ??
    (await getFeaturedProduct().then(
      (r) => (r.ok ? r.data.price : FLAME_SKULL_MOUNT.price),
      () => FLAME_SKULL_MOUNT.price,
    ))
  // An in-page link only scrolls to the buy panel, so it gets its own label.
  const label = ctaHref.startsWith("#") ? "Pick your colour" : "Buy it now"
  return (
    <SplitFeature
      image={finish.picture.src}
      alt={finish.picture.alt}
      reverse
      minHeight="min-h-[360px] lg:min-h-[460px]"
    >
      <SectionLabel numbered className="mb-4">
        The finish
      </SectionLabel>
      {/* Kept on one line without overflow: --fit is the largest size the column holds
          (its width over the string's em-width, 9.75 with ~4% slack). Retune if the text
          changes. */}
      <h2
        className={cn(
          "font-display text-bone mb-5 leading-[1.04] whitespace-nowrap uppercase",
          "[--fit:calc((100vw-40px)/9.75)] sm:[--fit:calc((100vw-64px)/9.75)]",
          "lg:[--fit:calc((50vw-64px)/9.75)] xl:[--fit:calc((50vw-112px)/9.75)]",
          "text-[min(38px,var(--fit))] sm:text-[min(48px,var(--fit))]",
          "xl:text-[min(58px,var(--fit))]",
        )}
      >
        Layer lines, on purpose
      </h2>
      {/* The 640px cap keeps this at three lines; wide screens would drop it to two. */}
      <p className="text-ash mb-7 max-w-[640px] text-[16px] leading-[1.62] text-pretty sm:text-[16.5px]">
        {finish.body}
      </p>
      <div className="flex flex-wrap gap-2.5">
        {TAGS.map((tag) => (
          <Badge key={tag} variant="acid">
            {tag}
          </Badge>
        ))}
      </div>
      {/* Carries the price, as the other marketing CTAs do. */}
      <ButtonLink href={ctaHref} variant="accent" size="md" className="mt-8 self-start">
        {label} · {formatMoney(shown)}
      </ButtonLink>
    </SplitFeature>
  )
}
