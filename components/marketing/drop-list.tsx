import Image from "next/image"

import { SkullDock } from "@/components/marketing/skull-dock"
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
        {/* The hero skull's last stop: it lands on the blaze skull in the lineup. */}
        <SkullDock src="/product/colourway-lineup.jpg" sizes="(min-width: 1024px) 50vw, 100vw" />
      </div>
      <div className="bg-carbon flex flex-col justify-center px-5 py-14 sm:px-8 sm:py-16 xl:px-14">
        <SectionLabel numbered tone="violet" className="mb-4">
          Next drop
        </SectionLabel>
        <h2 className="font-display text-bone mb-4 text-[34px] leading-[1.04] uppercase sm:text-[44px] xl:text-[50px]">
          Want Some More?
        </h2>
        <p className="text-ash mb-7 max-w-[420px] text-[15px] leading-[1.6] sm:text-[15.5px]">
          New designs and colourways are dropping soon, and the good ones sell out fast. Be the
          first to know.
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
