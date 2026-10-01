import Image from "next/image"
import { Boxes, ShieldCheck, Wind, Wrench, type LucideIcon } from "lucide-react"

import { Section, SectionHeading } from "@/components/marketing/section"
import { SectionLabel } from "@/components/shared/section-label"
import { cn } from "@/lib/utils"

/**
 * Five reasons across a 4x3 grid, which fills exactly: the hero takes 2x2, two
 * tiles sit beside it, a wider one takes the rest of that row, and the
 * accessories band runs the full width underneath. Below `sm` every tile is
 * full width, so no photograph is squeezed into half a phone. The rows are tall
 * (320px) because the tiles are photographs: at 220px the words covered them.
 *
 * Every photograph shows the real mount: the skull and the bracket in them are
 * renders of the files the mounts are printed from, joined as they ship, laid
 * back over scenes generated around them. A new picture needs the same, or it
 * shows a mount nobody makes.
 */
export function Bento() {
  return (
    <Section>
      <SectionLabel numbered className="mb-3.5">
        Why it slaps
      </SectionLabel>
      <SectionHeading className="mb-10 sm:mb-12">Made for a reason</SectionHeading>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:grid-rows-[repeat(3,320px)]">
        <Reason
          hero
          title="Store in style"
          image="/product/why-store.jpg"
          alt="A SKELMET mount on a garage wall at night, a helmet on the skull and a jacket, gloves and keys on its hooks"
          sizes="(min-width: 1024px) 50vw, 100vw"
          focus="object-[72%_10%]"
          className="col-span-2 min-h-[380px] sm:min-h-[440px] lg:row-span-2 lg:min-h-0"
        >
          Bedroom, garage or living room: wherever you mount it, it catches eyes, commands attention
          and makes a statement.
        </Reason>

        <Reason
          title="Simple installation"
          icon={Wrench}
          iconClass="text-acid"
          image="/product/why-install.jpg"
          alt="A hand driving a screw into the hole at the foot of the mount's wall plate with a cordless drill"
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          focus="object-[56%_30%]"
          className="col-span-2 min-h-[340px] sm:col-span-1 sm:min-h-[360px] lg:min-h-0"
        >
          Mark, drill, plug, screw. Four steps with a drill and the fixings in the box.
        </Reason>

        <Reason
          title="Safeguard your equipment"
          icon={ShieldCheck}
          iconClass="text-violet"
          image="/product/why-safeguard.jpg"
          alt="A glossy black helmet on the skull mount, with a jacket, gloves and keys on its hooks, clear of the floor"
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          focus="object-[50%_10%]"
          className="col-span-2 min-h-[340px] sm:col-span-1 sm:min-h-[360px] lg:min-h-0"
        >
          Floors and shelves wear your helmet down over time with dust, scratches, and scuffs. A
          wall mount doesn&apos;t.
        </Reason>

        <Reason
          side
          title="Keep it clean"
          icon={Wind}
          iconClass="text-ember"
          image="/product/why-clean.jpg"
          alt="A helmet with its visor up airing on the mount beside an open window, a jacket, gloves and keys below it"
          sizes="(min-width: 1024px) 50vw, 100vw"
          focus="object-[88%_20%] sm:object-[100%_5%]"
          className="col-span-2 min-h-[360px] sm:min-h-[320px] lg:min-h-0"
        >
          Sweat builds up in padding if the helmet is left closed up. Mounting keeps the helmet
          open, so it dries faster and stays fresh.
        </Reason>

        <Reason
          side
          title="The accessories station"
          icon={Boxes}
          iconClass="text-magenta"
          image="/product/why-accessories.jpg"
          alt="Riding gloves and a key hanging from the hooks under the mount's arm"
          sizes="(min-width: 1280px) calc(100vw - 112px), (min-width: 640px) calc(100vw - 64px), calc(100vw - 40px)"
          focus="object-[84%_30%] sm:object-[100%_32%]"
          className="col-span-2 min-h-[360px] sm:min-h-[320px] lg:col-span-4 lg:min-h-0"
        >
          Hooks on the mount arm hold your riding gloves, riding jacket and keys. Let this be the
          one-stop for all your riding gear.
        </Reason>
      </div>
    </Section>
  )
}

/**
 * Shade under the words only: from the bottom, or (a `side` tile from `sm` up)
 * from the left. It ends well short of the mount, so the photograph stays clear.
 */
const SHADE_BOTTOM =
  "bg-[linear-gradient(0deg,rgb(7_6_10_/_0.94)_0%,rgb(7_6_10_/_0.78)_24%,rgb(7_6_10_/_0.3)_46%,rgb(7_6_10_/_0)_64%)]"
const SHADE_SIDE =
  "sm:bg-[linear-gradient(90deg,rgb(7_6_10_/_0.92)_0%,rgb(7_6_10_/_0.72)_30%,rgb(7_6_10_/_0.2)_52%,rgb(7_6_10_/_0)_66%)]"

function Reason({
  title,
  icon: Icon,
  iconClass,
  image,
  alt,
  sizes,
  focus,
  className,
  hero = false,
  side = false,
  children,
}: {
  title: string
  icon?: LucideIcon
  iconClass?: string
  image: string
  alt: string
  sizes: string
  /** Where the tile's crop keeps the mount, per breakpoint (`object-position` classes). */
  focus: string
  className: string
  hero?: boolean
  /** Words on the left from `sm` up, for the wide tiles; along the bottom below it. */
  side?: boolean
  children: React.ReactNode
}) {
  return (
    <article
      className={cn(
        "rounded-card relative overflow-hidden border",
        hero ? "border-blaze/30" : "border-white/[0.09]",
        className,
      )}
    >
      <Image src={image} alt={alt} fill sizes={sizes} className={cn("object-cover", focus)} />
      <div className={cn("absolute inset-0", SHADE_BOTTOM, side && SHADE_SIDE)} />
      <div
        className={cn(
          "absolute inset-x-0 bottom-0",
          hero ? "p-6 sm:p-8" : "p-5 sm:p-6",
          side &&
            "sm:inset-y-0 sm:right-auto sm:flex sm:w-[54%] sm:flex-col sm:justify-center sm:p-7 lg:w-[48%]",
        )}
      >
        <div className={cn("flex items-center gap-2.5", hero ? "mb-2.5" : "mb-2")}>
          {Icon ? (
            <Icon className={cn("size-[22px] shrink-0", iconClass)} strokeWidth={1.6} />
          ) : null}
          <h3
            className={cn(
              "font-display text-bone leading-[1.06] uppercase",
              hero ? "text-[28px] sm:text-[38px]" : "text-[20px] sm:text-[23px]",
            )}
          >
            {title}
          </h3>
        </div>
        <p
          className={cn(
            "text-[13px] leading-[1.54] text-[#c9c6d4] sm:text-[13.5px]",
            hero ? "max-w-[420px] sm:text-[14.5px]" : "max-w-[460px]",
          )}
        >
          {children}
        </p>
      </div>
    </article>
  )
}
