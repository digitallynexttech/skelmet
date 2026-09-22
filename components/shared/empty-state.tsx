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
        "rounded-card bg-carbon/50 flex flex-col items-center border border-dashed border-white/[0.12] px-6 py-16 text-center",
        className,
      )}
    >
      <h2 className="font-display text-bone mb-2.5 text-[24px] leading-[1.08] uppercase">
        {title}
      </h2>
      {description ? (
        <p className="text-ash mb-6 max-w-[380px] text-[14.5px] leading-[1.6]">{description}</p>
      ) : null}
      {action}
    </div>
  )
}
