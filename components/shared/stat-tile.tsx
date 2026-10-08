import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export function StatTile({
  label,
  hint,
  icon: Icon,
  tone,
  children,
}: {
  label: string
  /** What the figure includes, under it. */
  hint?: React.ReactNode
  icon?: LucideIcon
  /** Text colour class for the icon. */
  tone?: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-carbon rounded-md border border-white/[0.09] px-5 py-4">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <span className="text-ash text-[13px] font-semibold">{label}</span>
        {Icon ? <Icon className={cn("size-4 shrink-0", tone)} strokeWidth={1.9} /> : null}
      </div>
      <div className="text-bone text-[22px] leading-none font-semibold">{children}</div>
      {hint ? <div className="text-dim mt-2 text-[12px]">{hint}</div> : null}
    </div>
  )
}
