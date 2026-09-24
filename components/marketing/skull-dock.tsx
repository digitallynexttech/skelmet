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
 * photographed skull out from under the mesh as the mesh covers it - and back
 * in as it leaves. On the poster path nothing ever sets it, so the photo shows
 * exactly as it always has.
 *
 * `turn` is for a photo that shows the skull from an angle: how far it is
 * turned from facing the camera, in radians, negative to face left. The mesh
 * lands turned the same way, and is sized by its silhouette at that angle.
 *
 * `phone` keeps this stop on the route on phones, where the route ends at the
 * last such stop and every other dock is skipped (see skull-journey).
 *
 * `hideOwnSkull` keeps the plate up the whole time the 3D skull is live, not
 * only while it is landing, so the photographed skull is never seen - not
 * waiting for the mesh, and not left behind when it flies on. Loaded eagerly,
 * so it is in place before the card scrolls in rather than a beat after.
 *
 * Plates and the skull boxes the route docks to come from
 * scripts/build-skull-plates.mjs.
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
  turn?: number
  phone?: boolean
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
        loading={hideOwnSkull ? "eager" : undefined}
        className="object-cover"
        style={{ opacity: "var(--skull-dock, 0)" }}
      />
    </div>
  )
}
