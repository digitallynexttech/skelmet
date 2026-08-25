import { cn } from "@/lib/utils"

/** Consistent gutters: 20px phone → 32px tablet → 56px desktop. */
export function Section({
  children,
  className,
  id,
  bleed = false,
}: {
  children: React.ReactNode
  className?: string
  id?: string
  bleed?: boolean
}) {
  return (
    <section
      id={id}
      className={cn(
        "relative",
        bleed ? "" : "px-5 py-16 sm:px-8 sm:py-20 xl:px-14 xl:py-24",
        className,
      )}
    >
      {children}
    </section>
  )
}

export function SectionHeading({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <h2
      className={cn(
        "font-display text-[40px] leading-[1.0] text-bone uppercase sm:text-[52px] xl:text-[68px]",
        className,
      )}
    >
      {children}
    </h2>
  )
}
