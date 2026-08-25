import { cn } from "@/lib/utils"

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-card border border-dashed border-white/[0.12] bg-carbon/50 px-6 py-16 text-center",
        className,
      )}
    >
      <h2 className="mb-2.5 font-display text-[24px] leading-[1.08] text-bone uppercase">{title}</h2>
      {description ? (
        <p className="mb-6 max-w-[380px] text-[14.5px] leading-[1.6] text-ash">{description}</p>
      ) : null}
      {action}
    </div>
  )
}
