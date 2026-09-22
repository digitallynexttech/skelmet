import { SplitFeature } from "@/components/marketing/split-feature"
import { SectionLabel } from "@/components/shared/section-label"
import { Badge } from "@/components/ui/badge"

const TAGS = ["0.2 mm layers", "Matte, not glossy", "Hand-checked"]

export function Texture() {
  return (
    <SplitFeature
      image="/product/detail-flame.jpg"
      alt="Macro detail of the carved flame relief and 3D-print layer lines"
      reverse
      minHeight="min-h-[360px] lg:min-h-[460px]"
    >
      <SectionLabel index="04" className="mb-4">
        The finish
      </SectionLabel>
      <h2 className="font-display text-bone mb-5 text-[38px] leading-[1.04] uppercase sm:text-[48px] xl:text-[58px]">
        Layer lines,
        <br />
        on purpose
      </h2>
      <p className="text-ash mb-7 max-w-[440px] text-[16px] leading-[1.62] text-pretty sm:text-[16.5px]">
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
