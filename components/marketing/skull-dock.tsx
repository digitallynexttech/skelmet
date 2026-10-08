import Image from "next/image"

import DOCKS from "@/components/marketing/skull-docks.json"

/**
 * Marks a skull photo as a stop on the hero skull's route and lays its skull-less
 * plate over it. Put it beside the `fill` image with the same `src` and `sizes`
 * so the two line up to the pixel. The render loop fades the plate in through
 * `--skull-dock` as the mesh lands. Plates and skull boxes: scripts/build-skull-plates.mjs.
 */
export function SkullDock({
  src,
  sizes,
  turn,
  phone,
  hideOwnSkull,
}: {
  src: string
  sizes: string
  /** Radians the photographed skull is turned from facing the camera, negative to face left. */
  turn?: number
  /** Keep this stop on phones, where the route ends at the last such stop. */
  phone?: boolean
  /** Keep the plate up the whole time the 3D skull is live, not only while landing. */
  hideOwnSkull?: boolean
}) {
  const dock = (DOCKS as Record<string, { plate: string } | undefined>)[src]
  if (!dock) return null

  return (
    <div
      data-skull-dock={src}
      data-skull-turn={turn}
      data-skull-phone={phone ? "" : undefined}
      data-skull-hide-own={hideOwnSkull ? "" : undefined}
      className="pointer-events-none absolute inset-0"
    >
      <Image
        src={dock.plate}
        alt=""
        fill
        sizes={sizes}
        // Lazy even with hideOwnSkull: below the fold, and shown only once the skull lands.
        className="object-cover"
        style={{ opacity: "var(--skull-dock, 0)" }}
      />
    </div>
  )
}
