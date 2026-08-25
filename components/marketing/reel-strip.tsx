import Image from "next/image"
import { Play } from "lucide-react"

import { Section, SectionHeading } from "@/components/marketing/section"
import { SectionLabel } from "@/components/shared/section-label"

const CLIPS = [
  { src: "/product/lifestyle-garage.jpg", title: "Unboxing to wall", length: "0:42" },
  { src: "/product/install-drill.jpg", title: "The 10-minute fit", length: "1:08" },
  { src: "/product/lifestyle-room.jpg", title: "A week later", length: "0:26" },
]

export function ReelStrip() {
  return (
    <Section id="reel">
      <div className="mb-9 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <SectionLabel index="09" tone="violet" className="mb-3.5">
            In motion
          </SectionLabel>
          <SectionHeading>See it move</SectionHeading>
        </div>
        <span className="font-mono text-[11.5px] tracking-[0.16em] text-dim uppercase">
          Tap to play · 3 clips
        </span>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {CLIPS.map((clip) => (
          <button
            key={clip.title}
            type="button"
            className="group relative aspect-4/5 overflow-hidden rounded-card border border-white/[0.09] text-left lg:aspect-3/4"
          >
            <Image
              src={clip.src}
              alt={clip.title}
              fill
              sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 92vw"
              className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
            />
            <span className="absolute inset-0 bg-[linear-gradient(0deg,rgb(7_6_10_/_0.9)_6%,transparent_55%)]" />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex size-15 items-center justify-center rounded-full bg-bone/95 transition-transform duration-300 group-hover:scale-110">
                <Play className="size-5 fill-void text-void" strokeWidth={0} />
              </span>
            </span>
            <span className="absolute bottom-5 left-5">
              <span className="mb-1 block text-base font-bold text-bone">{clip.title}</span>
              <span className="block font-mono text-[10.5px] tracking-[0.12em] text-ash">
                {clip.length}
              </span>
            </span>
          </button>
        ))}
      </div>
    </Section>
  )
}
