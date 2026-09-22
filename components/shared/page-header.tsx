import { cn } from "@/lib/utils"

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn("flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between", className)}
    >
      <div>
        {eyebrow ? (
          <div className="text-ember mb-3 font-mono text-[11px] tracking-[0.22em] uppercase">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="font-display text-bone text-[34px] leading-[1.04] uppercase sm:text-[42px]">
          {title}
        </h1>
        {description ? (
          <p className="text-ash mt-2.5 max-w-[560px] text-[14.5px] leading-[1.6]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2.5">{actions}</div> : null}
    </div>
  )
}
