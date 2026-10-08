"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { Check, LayoutGrid, List, Search, SlidersHorizontal, X } from "lucide-react"

import { Stars } from "@/components/shared/stars"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { COLOURWAYS, TINT_TO, type Colourway, type ColourwayId } from "@/features/catalog/catalog"
import { CardBuy } from "@/features/catalog/components/card-buy"
import { SwatchPicker } from "@/features/catalog/components/swatch-picker"
import {
  NO_FILTERS,
  SEARCH_MAX,
  SHOP_SORTS,
  hasFilters,
  parseShopQuery,
  shopResults,
  shopSearch,
  toggleColour,
  type ShopProduct,
  type ShopQuery,
} from "@/features/catalog/shop"
import { discountPercent, formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"

type View = "grid" | "list"
type Update = (patch: Partial<ShopQuery>) => void

/** /products: filters down the side (a panel on phones), sort and view above the cards. */
export function ShopView({ products }: { products: ShopProduct[] }) {
  const [query, setQuery] = React.useState<ShopQuery>(NO_FILTERS)
  const [view, setView] = React.useState<View>("grid")
  const [filtersOpen, setFiltersOpen] = React.useState(false)

  // Read after mount, as the product page reads ?colour=: useSearchParams() would make the
  // prerendered page open on its Suspense fallback.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(parseShopQuery(window.location.search))
  }, [])

  const update: Update = (patch) => {
    const next = { ...query, ...patch }
    setQuery(next)
    const { pathname, hash } = window.location
    window.history.replaceState(null, "", `${pathname}${shopSearch(next)}${hash}`)
  }
  const clear = () => update({ ...NO_FILTERS, sort: query.sort })

  const results = shopResults(products, query)
  const active = (query.q.trim() ? 1 : 0) + query.colours.length + (query.inStock ? 1 : 0)
  const filters = <Filters products={products} query={query} update={update} onClear={clear} />

  return (
    <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10 xl:gap-14">
      <aside aria-label="Filters" className="hidden lg:block">
        <div className="sticky top-28">{filters}</div>
      </aside>

      <div className="min-w-0">
        <div className="mb-6 flex items-center justify-between gap-2 border-y border-white/[0.07] py-3 sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
              aria-controls="shop-filters"
              className="text-bone flex h-10 shrink-0 items-center gap-2 rounded-full border border-white/[0.14] px-3.5 font-mono text-[11px] tracking-[0.14em] uppercase transition-colors hover:border-white/30 lg:hidden"
            >
              <SlidersHorizontal className="size-4" strokeWidth={2} />
              Filters
              {active ? (
                <span className="bg-blaze text-void rounded-full px-1.5 text-[10px] font-bold">
                  {active}
                </span>
              ) : null}
            </button>
            <span className="text-dim hidden shrink-0 font-mono text-[11px] tracking-[0.14em] uppercase sm:inline">
              Sort by
            </span>
            <Select
              size="sm"
              label="Sort by"
              value={query.sort}
              options={[...SHOP_SORTS]}
              onChange={(sort) => update({ sort })}
              className="min-w-0 flex-1 sm:max-w-[210px]"
            />
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span
              aria-live="polite"
              className="text-dim sr-only font-mono text-[11px] tracking-[0.14em] uppercase sm:not-sr-only"
            >
              {results.length} {results.length === 1 ? "mount" : "mounts"}
            </span>
            <div role="group" aria-label="View as" className="flex items-center gap-0.5">
              {(["grid", "list"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  aria-label={v === "grid" ? "Grid" : "List"}
                  onClick={() => setView(v)}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg transition-colors",
                    view === v ? "text-bone bg-white/[0.08]" : "text-dim hover:text-bone",
                  )}
                >
                  {v === "grid" ? (
                    <LayoutGrid className="size-[18px]" strokeWidth={1.8} />
                  ) : (
                    <List className="size-[18px]" strokeWidth={1.8} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filtersOpen ? (
          <div
            id="shop-filters"
            className="rounded-tile bg-carbon mb-6 border border-white/[0.07] p-5 lg:hidden"
          >
            {filters}
          </div>
        ) : null}

        {results.length === 0 ? (
          <div className="rounded-tile bg-carbon flex flex-col items-center border border-white/[0.07] px-6 py-16 text-center">
            <p className="font-display text-bone mb-3 text-[30px] leading-[1.0] uppercase">
              No mounts match
            </p>
            <p className="text-ash mb-6 max-w-[340px] text-[15px] leading-[1.6]">
              Try another word or colour, or see everything we make.
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={clear}>
              Show all mounts
            </Button>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-5 lg:grid-cols-3 xl:grid-cols-4">
            {results.map(({ product, colourway }) => (
              // Keyed by the colour shown, so a new filter resets the card's own pick.
              <GridCard
                key={`${product.slug}-${colourway.id}`}
                product={product}
                initial={colourway.id}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {results.map(({ product, colourway }) => (
              <ListCard
                key={`${product.slug}-${colourway.id}`}
                product={product}
                initial={colourway.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Filters({
  products,
  query,
  update,
  onClear,
}: {
  products: ShopProduct[]
  query: ShopQuery
  update: Update
  onClear: () => void
}) {
  // What each option would show with the other filters as they are.
  const count = (patch: Partial<ShopQuery>) => shopResults(products, { ...query, ...patch }).length

  return (
    <div className="flex flex-col gap-7">
      <div className="flex min-h-6 items-center justify-between gap-3">
        <h2 className="text-bone font-mono text-[12px] font-bold tracking-[0.18em] uppercase">
          Filters
        </h2>
        {hasFilters(query) ? (
          <button
            type="button"
            onClick={onClear}
            className="text-blaze hover:text-ember font-mono text-[11px] tracking-[0.14em] uppercase transition-colors"
          >
            Clear all
          </button>
        ) : null}
      </div>

      <label className="relative block">
        <span className="sr-only">Search mounts</span>
        <Search
          className="text-dim pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2"
          strokeWidth={2}
        />
        <Input
          type="search"
          enterKeyHint="search"
          value={query.q}
          maxLength={SEARCH_MAX}
          onChange={(e) => update({ q: e.target.value })}
          placeholder="Search"
          className="h-11 pr-10 pl-10 text-[14px] [&::-webkit-search-cancel-button]:appearance-none"
        />
        {query.q ? (
          <button
            type="button"
            onClick={() => update({ q: "" })}
            aria-label="Clear search"
            className="text-dim hover:text-bone absolute top-1/2 right-2.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-full transition-colors"
          >
            <X className="size-4" strokeWidth={2.2} />
          </button>
        ) : null}
      </label>

      <FilterGroup title="Colour">
        {COLOURWAYS.map((c) => (
          <CheckRow
            key={c.id}
            checked={query.colours.includes(c.id)}
            onChange={() => update({ colours: toggleColour(query.colours, c.id) })}
            count={count({ colours: [c.id] })}
          >
            <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: c.hex }} />
            {c.name}
          </CheckRow>
        ))}
      </FilterGroup>

      <FilterGroup title="Availability">
        <CheckRow
          checked={query.inStock}
          onChange={() => update({ inStock: !query.inStock })}
          count={count({ inStock: true })}
        >
          In stock
        </CheckRow>
      </FilterGroup>
    </div>
  )
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-0.5">
      <legend className="text-dim mb-2.5 font-mono text-[11px] tracking-[0.18em] uppercase">
        {title}
      </legend>
      {children}
    </fieldset>
  )
}

function CheckRow({
  checked,
  onChange,
  count,
  children,
}: {
  checked: boolean
  onChange: () => void
  count: number
  children: React.ReactNode
}) {
  return (
    <label className="text-ash hover:text-bone flex cursor-pointer items-center gap-3 py-1.5 text-[14px] transition-colors">
      <input type="checkbox" checked={checked} onChange={onChange} className="peer sr-only" />
      <span
        aria-hidden
        className="peer-checked:border-blaze peer-checked:bg-blaze text-void peer-focus-visible:ring-blaze/50 flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border border-white/25 transition-colors peer-focus-visible:ring-2"
      >
        {checked ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </span>
      <span className={cn("flex min-w-0 flex-1 items-center gap-2", checked && "text-bone")}>
        {children}
      </span>
      <span className="text-dim font-mono text-[11.5px]">{count}</span>
    </label>
  )
}

/** One card's colour pick, starting on the colour the filters asked for. */
function usePick(product: ShopProduct, initial: ColourwayId) {
  const [picked, setPicked] = React.useState(initial)
  const colourway = product.colourways.find((c) => c.id === picked) ?? product.colourways[0]!
  // The buy button's gradient, in the picked colour.
  const tint = {
    "--tint": colourway.hex,
    "--tint-to": TINT_TO[colourway.id],
  } as React.CSSProperties
  return { colourway, setPicked, tint }
}

function CardBadge({ product, colourway }: { product: ShopProduct; colourway: Colourway }) {
  if (!colourway.inStock) {
    return (
      <Badge
        variant="muted"
        className="bg-void/80 absolute top-3 left-3 px-2 py-1 text-[10px] backdrop-blur-sm"
      >
        Sold out
      </Badge>
    )
  }
  if (product.colourways[0]?.bestSeller) {
    return (
      <Badge variant="solid" className="absolute top-3 left-3 px-2 py-1 text-[10px]">
        The original
      </Badge>
    )
  }
  return null
}

function Price({ product, colourway }: { product: ShopProduct; colourway: Colourway }) {
  const off = discountPercent(product.compareAtPrice, colourway.price)
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className="text-bone font-mono text-[15px] font-bold">
        {formatMoney(colourway.price)}
      </span>
      {off > 0 ? (
        <>
          <span className="text-dim font-mono text-[12px] line-through">
            {formatMoney(product.compareAtPrice)}
          </span>
          <span className="text-acid font-mono text-[11px] tracking-[0.08em]">{off}% OFF</span>
        </>
      ) : null}
    </div>
  )
}

function Rating({ product }: { product: ShopProduct }) {
  if (product.reviewCount === 0) return null
  return (
    <div className="mt-1.5 flex items-center gap-2">
      <Stars rating={product.rating} className="text-[12px]" />
      <span className="text-dim text-[12px]">{product.reviewCount} reviews</span>
    </div>
  )
}

function GridCard({ product, initial }: { product: ShopProduct; initial: ColourwayId }) {
  const { colourway, setPicked, tint } = usePick(product, initial)
  return (
    <article style={tint} className="group relative flex flex-col">
      <Link
        href={`/product/${product.slug}?colour=${colourway.id}`}
        aria-label={`View the ${product.name} in ${colourway.name}`}
        className="rounded-tile focus-visible:ring-blaze/70 absolute inset-0 z-10 focus-visible:ring-2 focus-visible:outline-none"
      />
      <div className="rounded-tile bg-carbon relative aspect-square overflow-hidden border border-white/[0.07] transition-colors group-hover:border-white/[0.18]">
        <Image
          src={colourway.image}
          alt={`${product.name} in ${colourway.name}`}
          fill
          sizes="(min-width: 1280px) 22vw, (min-width: 1024px) 26vw, 46vw"
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
        <CardBadge product={product} colourway={colourway} />
        {/* With a mouse: over the photo, on hover or focus. */}
        <div className="absolute inset-x-3 bottom-3 z-20 hidden translate-y-2 opacity-0 transition duration-300 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100 [@media(hover:hover)]:block">
          <CardBuy productSlug={product.slug} colourway={colourway} full />
        </div>
      </div>
      <div className="flex flex-1 flex-col pt-3.5">
        <span className="text-dim mb-1 font-mono text-[10.5px] tracking-[0.18em] uppercase">
          {colourway.name}
        </span>
        <h2 className="font-display text-bone mb-1.5 text-[17px] leading-[1.1] tracking-[0.03em] uppercase sm:text-[19px]">
          {product.name}
        </h2>
        <Price product={product} colourway={colourway} />
        <Rating product={product} />
        {/* At the foot, so the dots line up across a row whatever is above them. */}
        <div className="mt-auto flex flex-col gap-3.5 pt-3.5">
          <SwatchPicker
            colourways={product.colourways}
            picked={colourway.id}
            onPick={setPicked}
            named={false}
          />
          {/* Touch: always there, under the details. */}
          <div className="[@media(hover:hover)]:hidden">
            <CardBuy productSlug={product.slug} colourway={colourway} full />
          </div>
        </div>
      </div>
    </article>
  )
}

function ListCard({ product, initial }: { product: ShopProduct; initial: ColourwayId }) {
  const { colourway, setPicked, tint } = usePick(product, initial)
  return (
    <article
      style={tint}
      className="group rounded-tile bg-carbon relative flex gap-4 border border-white/[0.07] p-3 transition-colors hover:border-white/[0.18] sm:gap-6 sm:p-4"
    >
      <Link
        href={`/product/${product.slug}?colour=${colourway.id}`}
        aria-label={`View the ${product.name} in ${colourway.name}`}
        className="rounded-tile focus-visible:ring-blaze/70 absolute inset-0 z-10 focus-visible:ring-2 focus-visible:outline-none"
      />
      <div className="relative aspect-square w-[120px] shrink-0 overflow-hidden rounded-xl sm:w-[200px]">
        <Image
          src={colourway.image}
          alt={`${product.name} in ${colourway.name}`}
          fill
          sizes="(min-width: 640px) 200px, 120px"
          className="object-cover"
        />
        <CardBadge product={product} colourway={colourway} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col sm:py-1">
        <span className="text-dim mb-1 font-mono text-[10.5px] tracking-[0.18em] uppercase">
          {colourway.name}
        </span>
        <h2 className="font-display text-bone mb-1.5 text-[18px] leading-[1.1] tracking-[0.03em] uppercase sm:text-[24px]">
          {product.name}
        </h2>
        <p className="text-ash mb-2 hidden max-w-[520px] text-[14px] leading-[1.55] sm:block">
          {product.summary}
        </p>
        <Price product={product} colourway={colourway} />
        <Rating product={product} />
        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
          <SwatchPicker
            colourways={product.colourways}
            picked={colourway.id}
            onPick={setPicked}
            named={false}
          />
          <CardBuy productSlug={product.slug} colourway={colourway} />
        </div>
      </div>
    </article>
  )
}
