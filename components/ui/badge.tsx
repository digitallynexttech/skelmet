import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded font-mono text-[10px] tracking-[0.16em] uppercase",
  {
    variants: {
      variant: {
        solid: "bg-acid text-void font-bold px-2.5 py-1.5",
        blaze: "bg-blaze text-void font-bold px-2.5 py-1.5",
        outline: "border border-white/[0.16] text-bone px-2.5 py-1.5",
        acid: "border border-acid/30 text-acid px-2.5 py-1.5",
        ember: "border border-ember/35 text-ember px-2.5 py-1.5",
        violet: "border border-violet/40 text-violet px-2.5 py-1.5",
        magenta: "border border-magenta/40 text-magenta px-2.5 py-1.5",
        muted: "border border-white/[0.12] text-dim px-2.5 py-1.5",
      },
    },
    defaultVariants: { variant: "outline" },
  },
)

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { badgeVariants }
