import { Check } from "lucide-react"

import { SplitFeature } from "@/components/marketing/split-feature"
import { SectionLabel } from "@/components/shared/section-label"

const USES = ["Gloves, wet or dry", "Keys and a lanyard", "A jacket, by the collar loop"]

export function TheHook() {
  return (
    <SplitFeature
      image="/product/lifestyle-gloves.jpg"
      alt="Gloves and keys hanging from the hook under the skull's jaw"
      reverse
      minHeight="min-h-[380px] lg:min-h-[500px]"
    >
      <SectionLabel index="08" className="mb-4">
        The hook
      </SectionLabel>
      <h2 className="mb-5 font-display text-[40px] leading-[1.0] text-bone uppercase sm:text-[50px] xl:text-[60px]">
        It holds more
        <br />
        than a helmet
      </h2>
      <p className="mb-7 max-w-[450px] text-[16px] leading-[1.62] text-ash text-pretty sm:text-[16.5px]">
        The notch under the jaw was meant for gloves. People use it for keys, sunglasses, a jacket
        loop, a lanyard, a spare bungee. One rider hangs their dog&apos;s lead on it.
      </p>
      <ul className="flex flex-col gap-3">
        {USES.map((use) => (
          <li key={use} className="flex items-center gap-3 text-[15px] text-bone">
            <Check className="size-[17px] shrink-0 text-acid" strokeWidth={2.4} />
            {use}
          </li>
        ))}
      </ul>
    </SplitFeature>
  )
}
