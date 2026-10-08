import { CreditCard, ShieldCheck, Truck } from "lucide-react"

const ITEMS = [
  { Icon: Truck, tone: "text-ember", title: "Ships in 48 hours", body: "Pan-India, tracked" },
  { Icon: ShieldCheck, tone: "text-acid", title: "7-day returns", body: "We pay the pickup" },
  {
    Icon: CreditCard,
    tone: "text-violet",
    title: "UPI · Cards · Netbanking",
    body: "Secure checkout",
  },
]

/**
 * One column, then three from md. Never two (the third would sit alone), and not before md,
 * where the longest line would no longer fit on one line.
 */
export function TrustStrip() {
  return (
    <div className="grid grid-cols-1 border-y border-white/[0.07] md:grid-cols-3">
      {ITEMS.map(({ Icon, tone, title, body }) => (
        <div
          key={title}
          className="flex items-center gap-4 border-b border-white/[0.07] px-5 py-6 last:border-b-0 sm:px-8 sm:py-7 md:justify-center md:border-r md:border-b-0 md:last:border-r-0 xl:px-10"
        >
          <Icon className={`size-6 shrink-0 ${tone}`} strokeWidth={1.6} />
          {/* min-w-0 is load-bearing: without it wide text pushes the track open and
              overlaps the next cell instead of wrapping. */}
          <div className="min-w-0">
            <div className="text-bone mb-0.5 text-[14.5px] font-bold">{title}</div>
            <div className="text-dim text-[12.5px]">{body}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
