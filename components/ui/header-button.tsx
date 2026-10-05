import * as React from "react"
import Link from "next/link"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Every button in the admin: a page's header (Export, More actions, Create
 * order), a table row's actions, a form's Save. Small and square-cornered,
 * unlike the storefront's pill Button, so the admin reads as a tool rather
 * than a shop window.
 */
export const headerButton = cva(
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-sm px-3 text-[13px] font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        secondary:
          "text-bone border border-white/[0.14] bg-white/[0.04] hover:border-white/25 hover:bg-white/[0.08] aria-expanded:border-white/25 aria-expanded:bg-white/[0.08]",
        primary: "bg-blaze text-void hover:bg-ember px-3.5",
        danger: "border-magenta/40 text-magenta hover:bg-magenta/[0.08] border bg-transparent",
        // Text only, for a row's lesser actions: Archive beside Renew.
        quiet: "text-ash hover:text-bone px-2.5 hover:bg-white/[0.05]",
      },
    },
    defaultVariants: { variant: "secondary" },
  },
)

type Variant = VariantProps<typeof headerButton>

export function HeaderButton({
  variant,
  className,
  type = "button",
  ...props
}: Variant & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={cn(headerButton({ variant }), className)} {...props} />
}

export function HeaderLink({
  variant,
  className,
  ...props
}: Variant & React.ComponentPropsWithoutRef<typeof Link>) {
  return <Link className={cn(headerButton({ variant }), className)} {...props} />
}
