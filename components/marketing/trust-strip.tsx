import { CreditCard, Package, ShieldCheck, Truck } from "lucide-react"

const ITEMS = [
  { Icon: Truck, tone: "text-ember", title: "Ships in 48 hours", body: "Free, pan-India, tracked" },
  { Icon: ShieldCheck, tone: "text-acid", title: "7-day returns", body: "We pay the pickup" },
  { Icon: CreditCard, tone: "text-violet", title: "UPI · Cards · COD", body: "Secure checkout" },
  { Icon: Package, tone: "text-magenta", title: "Printed to order", body: "Small batches only" },
]

export function TrustStrip() {
  return (
    <div className="grid grid-cols-1 border-b border-white/[0.07] sm:grid-cols-2 lg:grid-cols-4">
      {ITEMS.map(({ Icon, tone, title, body }) => (
        <div
          key={title}
          className="flex items-center gap-4 border-b border-white/[0.07] px-5 py-6 last:border-b-0 sm:px-8 sm:py-7 lg:border-r lg:border-b-0 lg:last:border-r-0 xl:px-10"
        >
          <Icon className={`size-6 shrink-0 ${tone}`} strokeWidth={1.6} />
          <div>
            <div className="mb-0.5 text-[14.5px] font-bold text-bone">{title}</div>
            <div className="text-[12.5px] text-dim">{body}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
