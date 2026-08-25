import Image from "next/image"

import { SectionLabel } from "@/components/shared/section-label"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function DropList() {
  return (
    <section className="grid border-t border-white/[0.07] lg:grid-cols-2">
      <div className="relative min-h-[260px] lg:min-h-[380px]">
        <Image
          src="/product/colourway-lineup.jpg"
          alt="All three SKELMET colourways lined up"
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
      <div className="flex flex-col justify-center bg-carbon px-5 py-14 sm:px-8 sm:py-16 xl:px-14">
        <SectionLabel index="16" tone="violet" className="mb-4">
          Next drop
        </SectionLabel>
        <h2 className="mb-4 font-display text-[34px] leading-[1.04] text-bone uppercase sm:text-[44px] xl:text-[50px]">
          Get first dibs
          <br />
          on batch 05
        </h2>
        <p className="mb-7 max-w-[420px] text-[15px] leading-[1.6] text-ash sm:text-[15.5px]">
          New colourways drop roughly every six weeks and the small ones sell out. One email per
          drop, nothing else, ever.
        </p>
        <form className="flex max-w-[460px] flex-col gap-2.5 sm:flex-row">
          <Input
            type="email"
            required
            placeholder="you@example.com"
            aria-label="Email address"
            className="h-[54px] rounded-full"
          />
          <Button type="submit" variant="violet" size="md">
            Notify me
          </Button>
        </form>
      </div>
    </section>
  )
}
