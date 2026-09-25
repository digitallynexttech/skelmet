import * as React from "react"
import Link from "next/link"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2.5 rounded-full font-bold uppercase tracking-[0.05em] whitespace-nowrap transition-[transform,box-shadow,background-color,border-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] disabled:pointer-events-none disabled:opacity-45 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-r from-blaze to-ember text-void shadow-[0_14px_40px_rgb(255_90_31_/_0.34)] hover:shadow-[0_16px_48px_rgb(255_90_31_/_0.46)]",
        // Primary's gradient and glow in whatever colour an ancestor sets as
        // --tint and --tint-to: the lineup cards each dress it in their own
        // colourway.
        tint: "bg-gradient-to-r from-(--tint) to-(--tint-to) text-void shadow-[0_14px_40px_color-mix(in_oklab,var(--tint)_34%,transparent)] hover:shadow-[0_16px_48px_color-mix(in_oklab,var(--tint)_46%,transparent)]",
        accent: "bg-acid text-void hover:bg-[#e2ff6a]",
        violet: "bg-violet text-bone hover:bg-[#8f74ff]",
        light: "bg-bone text-void hover:bg-white",
        ghost:
          "border border-white/[0.18] text-bone hover:border-white/35 hover:bg-white/[0.04] font-semibold",
        quiet: "text-ash hover:text-bone font-semibold",
      },
      size: {
        lg: "h-[58px] px-[30px] text-[15px]",
        md: "h-[54px] px-7 text-sm",
        sm: "h-11 px-5 text-[12.5px]",
        xs: "h-10 px-4 text-[13px] tracking-[0.04em]",
      },
      full: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: { variant: "primary", size: "md", full: false },
  },
)

type BaseProps = VariantProps<typeof buttonVariants> & { className?: string }

export type ButtonProps = BaseProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined }

export type ButtonLinkProps = BaseProps &
  Omit<React.ComponentPropsWithoutRef<typeof Link>, "href"> & { href: string }

export function Button({ className, variant, size, full, ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size, full }), className)} {...props} />
}

export function ButtonLink({ className, variant, size, full, href, ...props }: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={cn(buttonVariants({ variant, size, full }), className)}
      {...props}
    />
  )
}

export { buttonVariants }
