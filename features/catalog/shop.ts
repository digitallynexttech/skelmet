import {
  COLOURWAYS,
  type Colourway,
  type ColourwayId,
  type Product,
} from "@/features/catalog/catalog"

// /products: search, filters and sort, kept in the URL so a filtered list can be shared.

export const SHOP_SORTS = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "name", label: "Name: A to Z" },
] as const

export type ShopSort = (typeof SHOP_SORTS)[number]["value"]

export type ShopQuery = {
  q: string
  /** Any of these; none means every colour. Kept in the catalogue's order. */
  colours: ColourwayId[]
  inStock: boolean
  sort: ShopSort
}

export const NO_FILTERS: ShopQuery = { q: "", colours: [], inStock: false, sort: "featured" }

export const SEARCH_MAX = 80

/** Reads `?q=&colour=&colour=&stock=in&sort=`; anything unknown falls back to the default. */
export function parseShopQuery(search: string): ShopQuery {
  const params = new URLSearchParams(search)
  const asked = params.getAll("colour").flatMap((v) => v.split(","))
  const sort = params.get("sort")
  return {
    q: (params.get("q") ?? "").trim().slice(0, SEARCH_MAX),
    colours: COLOURWAYS.map((c) => c.id).filter((id) => asked.includes(id)),
    inStock: params.get("stock") === "in",
    sort: SHOP_SORTS.find((s) => s.value === sort)?.value ?? "featured",
  }
}

/** The query as a URL search string, defaults left out: "" for none. */
export function shopSearch(query: ShopQuery): string {
  const params = new URLSearchParams()
  const q = query.q.trim()
  if (q) params.set("q", q)
  for (const colour of query.colours) params.append("colour", colour)
  if (query.inStock) params.set("stock", "in")
  if (query.sort !== "featured") params.set("sort", query.sort)
  const search = params.toString()
  return search ? `?${search}` : ""
}

export function hasFilters(query: ShopQuery): boolean {
  return Boolean(query.q.trim() || query.colours.length || query.inStock)
}

/** The colour list with one switched on or off, in the catalogue's order. */
export function toggleColour(colours: ColourwayId[], id: ColourwayId): ColourwayId[] {
  const on = !colours.includes(id)
  return COLOURWAYS.map((c) => c.id).filter((c) => (c === id ? on : colours.includes(c)))
}

/** What a card needs of a product: all the page sends to the browser. */
export type ShopProduct = Pick<
  Product,
  | "slug"
  | "name"
  | "strapline"
  | "summary"
  | "productType"
  | "compareAtPrice"
  | "rating"
  | "reviewCount"
  | "colourways"
>

export const toShopProduct = (p: Product): ShopProduct => ({
  slug: p.slug,
  name: p.name,
  strapline: p.strapline,
  summary: p.summary,
  productType: p.productType,
  compareAtPrice: p.compareAtPrice,
  rating: p.rating,
  reviewCount: p.reviewCount,
  colourways: p.colourways,
})

/** A card: the product, and the colourway it opens on. */
export type ShopItem = { product: ShopProduct; colourway: Colourway }

/**
 * The cards for a query. A search word not in the product's own words narrows it to the
 * colourways it names ("piston olive"). Sold out goes last in every sort.
 */
export function shopResults(products: ShopProduct[], query: ShopQuery): ShopItem[] {
  const words = query.q.toLowerCase().split(/\s+/).filter(Boolean)

  const items: ShopItem[] = []
  for (const product of products) {
    let colourways = product.colourways
    if (query.colours.length) colourways = colourways.filter((c) => query.colours.includes(c.id))
    if (query.inStock) colourways = colourways.filter((c) => c.inStock)

    const about = [product.name, product.strapline, product.summary, product.productType]
      .join(" ")
      .toLowerCase()
    for (const word of words) {
      if (about.includes(word)) continue
      colourways = colourways.filter((c) => c.name.toLowerCase().includes(word))
    }

    const colourway = colourways.find((c) => c.inStock) ?? colourways[0]
    if (colourway) items.push({ product, colourway })
  }

  const price = (item: ShopItem) => Number(item.colourway.price)
  const order: Record<ShopSort, (a: ShopItem, b: ShopItem) => number> = {
    featured: () => 0,
    "price-asc": (a, b) => price(a) - price(b),
    "price-desc": (a, b) => price(b) - price(a),
    name: (a, b) => a.product.name.localeCompare(b.product.name),
  }
  // Array sort is stable, so ties keep the registry's order.
  return items.sort(
    (a, b) => Number(b.colourway.inStock) - Number(a.colourway.inStock) || order[query.sort](a, b),
  )
}
