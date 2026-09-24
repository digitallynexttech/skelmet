import { CreditCard, ShieldCheck, Truck } from "lucide-react"

const ITEMS = [
  { Icon: Truck, tone: "text-ember", title: "Ships in 48 hours", body: "Free, pan-India, tracked" },
  { Icon: ShieldCheck, tone: "text-acid", title: "7-day returns", body: "We pay the pickup" },
  {
    Icon: CreditCard,
    tone: "text-violet",
    title: "UPI · Cards · Netbanking",
    body: "Secure checkout",
  },
]

/**
 * Stacked until md, then one row of three.
 *
 * It goes straight from one column to three rather than passing through two,
 * because three items across two columns orphans the third on a row of its own.
 *
 * The icon and its text centre as one unit from md up, where each cell has
 * width to spare; below that the cell is full-width and centring would fight
 * the left-aligned rhythm of every other section.
 *
 * Three columns are held back to md so the narrowest cell is ~180px of text -
 * enough for the longest line here to sit on one line at 12.5px.
 */
export function TrustStrip() {
  return (
    <div className="grid grid-cols-1 border-y border-white/[0.07] md:grid-cols-3">
      {ITEMS.map(({ Icon, tone, title, body }) => (
        <div
          key={title}
          className="flex items-center gap-4 border-b md:justify-center border-white/[0.07] px-5 py-6 last:border-b-0 sm:px-8 sm:py-7 md:border-r md:border-b-0 md:last:border-r-0 xl:px-10"
        >
          <Icon className={`size-6 shrink-0 ${tone}`} strokeWidth={1.6} />
          {/* min-w-0 is load-bearing: a grid item's min-width defaults to auto,
              so without it a cell whose text is wider than its share of the row
              pushes the track open and overlaps its neighbour instead of
              wrapping. That is what collapsed this strip on narrow screens. */}
          <div className="min-w-0">
            <div className="text-bone mb-0.5 text-[14.5px] font-bold">{title}</div>
            <div className="text-dim text-[12.5px]">{body}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
