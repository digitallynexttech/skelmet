import Image from "next/image"

import { Section, SectionHeading } from "@/components/marketing/section"
import { SectionLabel } from "@/components/shared/section-label"

const SHOTS = [
  { src: "/product/lifestyle-room.jpg", alt: "A SKELMET mount in a rider's bedroom" },
  { src: "/product/lifestyle-gloves.jpg", alt: "Gloves hanging from the hook" },
  { src: "/product/lifestyle-concrete.jpg", alt: "A helmet on the mount against concrete" },
  { src: "/product/lifestyle-garage.jpg", alt: "The mount on a workshop wall" },
]

export function RiderWall({ index = "09" }: { index?: string } = {}) {
  return (
    <Section className="bg-carbon border-t border-white/[0.07]">
      <div className="mb-9 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SectionLabel index={index} tone="magenta" className="mb-3.5">
            Rider wall
          </SectionLabel>
          <SectionHeading>Mounted &amp; posted</SectionHeading>
        </div>
        <span className="border-magenta/40 text-magenta inline-flex h-11 items-center rounded-full border px-5 text-[13px] font-semibold tracking-[0.05em] uppercase">
          Tag @skelmet to feature
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        {SHOTS.map((shot) => (
          <div
            key={shot.src}
            className="rounded-tile relative aspect-square overflow-hidden border border-white/[0.08]"
          >
            <Image
              src={shot.src}
              alt={shot.alt}
              fill
              sizes="(min-width: 1024px) 24vw, 45vw"
              className="object-cover"
            />
          </div>
        ))}
      </div>
    </Section>
  )
}
