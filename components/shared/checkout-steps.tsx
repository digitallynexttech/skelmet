import * as React from "react"

/**
 * Cart → Details → Payment.
 *
 * The cart is the drawer (features/cart/components/cart-drawer), so step one
 * is behind the buyer by the time they see this: checkout shows it at step
 * two.
 */
export function CheckoutSteps({ current, className }: { current: 1 | 2 | 3; className?: string }) {
  const steps = ["Cart", "Details", "Payment"] as const
  return (
    <div className={className}>
      <div className="flex items-center gap-2.5 sm:gap-4">
        {steps.map((label, i) => {
          const n = (i + 1) as 1 | 2 | 3
          const active = n === current
          return (
            <React.Fragment key={label}>
              {i > 0 ? <span className="h-px flex-1 bg-white/15 sm:w-11 sm:flex-none" /> : null}
              <div className="flex items-center gap-2.5">
                <span
                  className={
                    active
                      ? "bg-blaze text-void flex size-6.5 items-center justify-center rounded-full font-mono text-xs font-bold"
                      : "text-dim flex size-6.5 items-center justify-center rounded-full border border-white/20 font-mono text-xs"
                  }
                >
                  {n}
                </span>
                <span
                  className={
                    active
                      ? "text-bone hidden text-[13.5px] font-semibold tracking-[0.04em] uppercase sm:inline"
                      : "text-dim hidden text-[13.5px] tracking-[0.04em] uppercase sm:inline"
                  }
                >
                  {label}
                </span>
              </div>
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
