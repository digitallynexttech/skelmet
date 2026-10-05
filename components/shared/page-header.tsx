import Link from "next/link"
import { ChevronRight, type LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The head of every admin page, as Shopify's are: the section's icon and a
 * short title on the left, the page's buttons on the right (HeaderButton).
 * A page inside a section names its parent first, as a link back: Orders >
 * Abandoned carts. No paragraph of explanation under it - the page's
 * metadata describes it - but a detail page can carry a line of its own facts
 * (a code's terms, a customer's email) as `subtitle`.
 */
export function PageHeader({
  icon: Icon,
  title,
  parent,
  tags,
  subtitle,
  actions,
  className,
}: {
  icon?: LucideIcon
  title: React.ReactNode
  /** The section this page sits in, linked. */
  parent?: { label: string; href: string }
  /** Status pills after the title, as on an order's page. */
  tags?: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-bone flex min-w-0 items-center gap-2.5 text-[20px] leading-tight font-semibold">
          {Icon ? <Icon className="text-ash size-5 shrink-0" strokeWidth={1.9} /> : null}
          {parent ? (
            <>
              <Link
                href={parent.href}
                className="text-ash hover:text-bone shrink-0 transition-colors"
              >
                {parent.label}
              </Link>
              <ChevronRight className="text-dim size-4 shrink-0" strokeWidth={2} />
            </>
          ) : null}
          <span className="min-w-0 truncate">{title}</span>
        </h1>
        {tags ? <div className="flex flex-wrap items-center gap-2">{tags}</div> : null}
        {actions ? (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{actions}</div>
        ) : null}
      </div>
      {subtitle ? (
        <p className={cn("text-dim text-[13px] leading-[1.55]", Icon && "pl-[30px]")}>{subtitle}</p>
      ) : null}
    </div>
  )
}
