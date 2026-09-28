import { CheckoutSteps } from "@/components/shared/checkout-steps"

/**
 * What checkout shows while it reads the cart from this device: the real
 * heading and blocks the size of the form and summary, so nothing below
 * them - the footer - jumps when the page arrives.
 */
export function CheckoutSkeleton() {
  return (
    <div aria-hidden className="pb-24">
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
  )
}
