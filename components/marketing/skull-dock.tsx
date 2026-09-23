import Image from "next/image"

import DOCKS from "@/components/marketing/skull-docks.json"

/**
 * Marks a photograph of the skull as a stop on the hero skull's route, and
 * lays the photo's skull-less plate over it.
 *
 * Drop it inside the photo's positioned box, beside the `fill` image, with the
 * same `src` and `sizes`: it fills the same box, and next/image gives the plate
 * the same srcset widths, so under the same `object-cover` the two line up to
 * the pixel. It renders nothing for a photo that has no plate.
 *
 * The plate starts invisible. As the flying skull closes on this photo the
 * render loop raises `--skull-dock` on this element toward 1, fading the
 * photographed skull out from under the mesh as the mesh covers it — and back
 * in as it leaves. On the poster path nothing ever sets it, so the photo shows
 * exactly as it always has.
 *
 * Plates and the skull boxes the route docks to come from
 * scripts/build-skull-plates.mjs.
 */
export function SkullDock({ src, sizes }: { src: string; sizes: string }) {
  const dock = (DOCKS as Record<string, { plate: string } | undefined>)[src]
  if (!dock) return null

  return (
    <div data-skull-dock={src} className="pointer-events-none absolute inset-0">
      <Image
        src={dock.plate}
        alt=""
        fill
        sizes={sizes}
        className="object-cover"
        style={{ opacity: "var(--skull-dock, 0)" }}
      />
    </div>
  )
}
