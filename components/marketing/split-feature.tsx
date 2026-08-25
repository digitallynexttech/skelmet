import Image from "next/image"

import { cn } from "@/lib/utils"

/**
 * The half-and-half band used four times down the page. Copy always sits on a
 * solid panel beside the photograph, never on top of it, that is what keeps
 * the text legible at every width.
 */
export function SplitFeature({
  image,
  alt,
  reverse = false,
  children,
  minHeight = "min-h-[420px] lg:min-h-[560px]",
}: {
  image: string
  alt: string
  reverse?: boolean
  children: React.ReactNode
  minHeight?: string
}) {
  return (
    <section className="grid border-y border-white/[0.07] lg:grid-cols-2">
      <div
        className={cn(
          "relative min-h-[280px] sm:min-h-[380px]",
          minHeight,
          reverse ? "lg:order-1" : "lg:order-2",
        )}
      >
        <Image
          src={image}
          alt={alt}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
      </div>
      <div
        className={cn(
          "flex flex-col justify-center bg-carbon px-5 py-14 sm:px-8 sm:py-16 xl:px-14 xl:py-20",
          reverse ? "lg:order-2" : "lg:order-1",
        )}
      >
        {children}
      </div>
    </section>
  )
}
