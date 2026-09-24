import { SplitFeature } from "@/components/marketing/split-feature"
import { SectionLabel } from "@/components/shared/section-label"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const TAGS = ["0.2 mm layers", "Matte, not glossy", "Hand-checked"]

export function Texture() {
  return (
    <SplitFeature
      image="/product/detail-flame.jpg"
      alt="Macro detail of the carved flame relief and 3D-print layer lines"
      reverse
      minHeight="min-h-[360px] lg:min-h-[460px]"
    >
      <SectionLabel numbered className="mb-4">
        The finish
      </SectionLabel>
      {/* One line at every width, which the design sizes alone cannot promise:
          set in Anton this string measures 9.39em, read out of the woff2, so
          it wants 545px at 58px and 451px at 48px while the copy column is
          only 528px at xl and 448px at lg. Dropping the break without
          resizing would have overflowed everywhere except a wide desktop.

          So --fit is the largest size the column can actually hold - its
          width over the string's own em-width - and each breakpoint takes
          whichever is smaller, that or the size the scale asks for. The
          divisor is 9.75 rather than 9.39 to leave ~4%: `50vw` counts the
          scrollbar the column does not get, and the fallback face is wider
          than Anton before the webfont lands. */}
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
      {/* Measured in Space Grotesk this paragraph is 97.63em, so at 16.5px it
          is 1611px of text: it needs more than 805px of measure to fall to two
          lines and less than ~560px to spill to four. 640 sits inside that
          band at every width the column can actually offer, which is why the
          cap is here at all rather than removed - the column runs to 848px at
          1920, and an unbounded measure would drop this to two lines there. */}
      <p className="text-ash mb-7 max-w-[640px] text-[16px] leading-[1.62] text-pretty sm:text-[16.5px]">
        We don&apos;t sand the print smooth and pretend it was moulded. The fine horizontal ridges
        catch the light, the flame valleys go properly deep, and the whole thing reads as made
        rather than manufactured.
      </p>
      <div className="flex flex-wrap gap-2.5">
        {TAGS.map((tag) => (
          <Badge key={tag} variant="acid">
            {tag}
          </Badge>
        ))}
      </div>
    </SplitFeature>
  )
}
