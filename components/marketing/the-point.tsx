import { ArrowRight } from "lucide-react"

import { SplitFeature } from "@/components/marketing/split-feature"
import { SectionLabel } from "@/components/shared/section-label"
import { ButtonLink } from "@/components/ui/button"
import { FLAME_SKULL_MOUNT } from "@/features/catalog/catalog"
import { formatMoney } from "@/lib/money"

export function ThePoint() {
  return (
    <SplitFeature
      image="/product/lifestyle-concrete.jpg"
      alt="A matte black helmet resting on a SKELMET mount against a concrete wall"
    >
      <SectionLabel numbered tone="acid" className="mb-4">
        The point
      </SectionLabel>
      <h2 className="font-display text-bone mb-5 text-[42px] leading-[1.0] uppercase sm:text-[56px] xl:text-[72px]">
        You spent 20k
        <br />
        on that lid.
      </h2>
      <p className="text-ash mb-5 max-w-[480px] text-[16px] leading-[1.62] text-pretty sm:text-[17.5px]">
        Then you put it on the floor next to the shoe rack. The visor gets scratched, the liner
        stays damp, and the whole thing smells like a gym bag by Thursday.
      </p>
      <p className="text-ash mb-8 max-w-[480px] text-[16px] leading-[1.62] text-pretty sm:text-[17.5px]">
        A wall mount costs less than one visor replacement.
      </p>
      <ButtonLink
        href={`/product/${FLAME_SKULL_MOUNT.slug}`}
        variant="light"
        size="md"
        className="self-start"
      >
        Fix that · {formatMoney(FLAME_SKULL_MOUNT.price)}
        <ArrowRight className="size-4" strokeWidth={2.4} />
      </ButtonLink>
    </SplitFeature>
  )
}
