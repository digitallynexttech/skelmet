/**
 * Client-safe catalogue registry (§4: `<feature>.ts`).
 *
 * SKELMET is a single-SKU store with three filament colourways, so the
 * catalogue is a typed registry rather than a database read. When a second
 * product lands, move this behind `catalog.service.ts` + `/api/products`,
 * the components below already take their data as props.
 *
 * [TO CONFIRM] values are real business facts nobody should guess: fill them
 * in before launch rather than shipping the brackets.
 */

export type ColourwayId = "blaze" | "olive" | "ghost"

export type Colourway = {
  id: ColourwayId
  name: string
  sku: string
  /** Swatch token: matches the filament, not the UI palette. */
  hex: string
  blurb: string
  image: string
  /**
   * Wire-shaped money (§5). The registry value is a fallback; the live one is
   * overlaid from the variant row by the catalogue service, because price is
   * per variant in the database and an admin can change it without a deploy.
   */
  price: string
  /** Units on hand for this variant. Same overlay, same reason. */
  stock: number
  inStock: boolean
  bestSeller?: boolean
}

export type Product = {
  slug: string
  name: string
  strapline: string
  /** Wire-shaped money: a string, exactly as the API would send it (§5). */
  price: string
  compareAtPrice: string
  rating: number
  reviewCount: number
  unitsLeft: number
  colourways: Colourway[]
  gallery: Array<{ src: string; alt: string }>
  specs: Array<{ label: string; value: string; pending?: boolean }>
  inTheBox: string[]
}

export const COLOURWAYS: Colourway[] = [
  {
    id: "blaze",
    name: "Blaze Orange",
    sku: "SKM-BLZ",
    hex: "#FF5A1F",
    blurb: "Bright and Hot, Built to catch eyes",
    image: "/product/product-front.jpg",
    price: "3499",
    stock: 0,
    inStock: true,
    bestSeller: true,
  },
  {
    id: "olive",
    name: "Militia Olive",
    sku: "SKM-OLV",
    hex: "#8A9A5B",
    blurb: "Bold in Presence, Subtle in Colour",
    image: "/product/colourway-olive.jpg",
    price: "3499",
    stock: 0,
    inStock: true,
  },
  {
    id: "ghost",
    name: "Ghost Grey",
    sku: "SKM-GHT",
    hex: "#C8CED6",
    blurb: "Calm. Cold. Still as stone.",
    image: "/product/colourway-ghost.jpg",
    price: "3499",
    stock: 0,
    inStock: true,
  },
]

export const FLAME_SKULL_MOUNT: Product = {
  slug: "flame-skull-mount",
  name: "Flame Skull Helmet Mount",
  strapline: "It earned every scratch. Give it a wall, not the floor.",
  price: "3499",
  compareAtPrice: "4999",
  rating: 4.9,
  reviewCount: 312,
  unitsLeft: 12,
  colourways: COLOURWAYS,
  gallery: [
    { src: "/product/product-front.jpg", alt: "Blaze Orange flame skull mount, front elevation" },
    { src: "/product/product-profile.jpg", alt: "Side profile showing the cantilever bracket" },
    { src: "/product/lifestyle-concrete.jpg", alt: "A matte black helmet resting on the mount" },
    { src: "/product/lifestyle-gloves.jpg", alt: "Gloves hanging from the hook under the jaw" },
    { src: "/product/detail-flame.jpg", alt: "Macro detail of the carved flame relief" },
  ],
  specs: [
    { label: "Material", value: "PLA+ · matte" },
    { label: "Dimensions", value: "[H × W × D mm]", pending: true },
    { label: "Load rating", value: "[X kg]", pending: true },
    { label: "Weight", value: "[X g]", pending: true },
    { label: "Fixings", value: "[4 × screw spec]", pending: true },
    { label: "Fits", value: "Full-face, open-face and modular" },
  ],
  inTheBox: [
    "Skull mount",
    "Black steel bracket",
    "4 × screws + wall anchors",
    "Paper drill template",
  ],
}

export const PRODUCTS: Product[] = [FLAME_SKULL_MOUNT]

export function getProduct(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug)
}

export function getColourway(id: string): Colourway | undefined {
  return COLOURWAYS.find((c) => c.id === id)
}

/** Falls back to the first colourway rather than throwing on a bad query param. */
export function resolveColourway(id: string | undefined): Colourway {
  const found = id ? getColourway(id) : undefined
  return found ?? COLOURWAYS[0]!
}
