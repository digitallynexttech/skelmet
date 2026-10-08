import { ArrowRight } from "lucide-react"

import { CheckoutSteps } from "@/components/shared/checkout-steps"
import { ButtonLink } from "@/components/ui/button"

/** Checkout with an empty cart and no Buy-now line. */
export function NothingToCheckOut({ heading = true }: { heading?: boolean }) {
  const Title = heading ? "h1" : "div"
  return (
    <div className="flex flex-col items-center px-5 py-24 text-center">
      <Title className="font-display text-bone mb-4 text-[40px] leading-[1.0] uppercase sm:text-[56px]">
        Nothing to check out
      </Title>
      <p className="text-ash mb-8 max-w-[380px] text-[15.5px] leading-[1.6]">
        Add a mount to your cart first and this page will have something to do.
      </p>
      <ButtonLink href="/products" variant="primary" size="lg">
        Shop the mounts
        <ArrowRight className="size-4" strokeWidth={2.4} />
      </ButtonLink>
    </div>
  )
}

/**
 * Shown while the cart is read: blocks the size of the real page, or the empty
 * state (CSS switch on data-when-cart in globals.css), so the footer does not jump.
 */
export function CheckoutSkeleton() {
  return (
    <div aria-hidden>
      <div data-when-cart="empty">
        <NothingToCheckOut heading={false} />
      </div>
      <div data-when-cart="full" className="pb-24">
        <div className="bg-carbon h-[52px] border-b border-white/[0.07] lg:hidden" />
        <div className="flex flex-col gap-6 px-5 pt-9 sm:px-8 lg:flex-row lg:items-end lg:justify-between xl:px-14">
          <div>
            <div className="text-ember mb-3.5 font-mono text-[11.5px] tracking-[0.22em] uppercase">
              Step 02 of 03
            </div>
            <div className="font-display text-bone text-[42px] leading-[1.0] uppercase sm:text-[56px] xl:text-[66px]">
              Where&apos;s it going?
            </div>
          </div>
          <CheckoutSteps current={2} />
        </div>
        <div className="grid gap-10 px-5 pt-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-12 xl:px-14">
          <div className="flex flex-col gap-3.5">
            <div className="rounded-tile bg-carbon h-[300px] border border-white/[0.09] sm:h-[210px]" />
            <div className="rounded-tile bg-carbon h-[640px] border border-white/[0.09] sm:h-[460px]" />
            <div className="rounded-tile bg-carbon h-[170px] border border-white/[0.09]" />
          </div>
          <div className="rounded-tile bg-carbon hidden h-[560px] border border-white/10 lg:block" />
        </div>
      </div>
    </div>
  )
}
