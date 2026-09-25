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
  gallery: GalleryShot[]
  specs: Array<{ label: string; value: string; pending?: boolean }>
  inTheBox: string[]
}

/**
 * One gallery slot, in all three finishes.
 *
 * The file per colourway is a Record rather than an optional override, so a
 * finish cannot be left out: only the first slot used to follow the swatch,
 * and picking Militia Olive left four orange photographs behind it. A missing
 * finish is now a type error rather than something you find on the page.
 *
 * All three files share framing and dimensions, so `object-cover` crops them
 * identically and switching colourway does not shift the image.
 */
export type GalleryShot = {
  alt: string
  src: Record<ColourwayId, string>
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
    {
      alt: "Flame skull mount, front elevation",
      src: {
        blaze: "/product/product-front.jpg",
        olive: "/product/colourway-olive.jpg",
        ghost: "/product/colourway-ghost.jpg",
      },
    },
    {
      alt: "Side profile showing the mount arm",
      src: {
        blaze: "/product/product-profile.jpg",
        olive: "/product/product-profile-olive.jpg",
        ghost: "/product/product-profile-ghost.jpg",
      },
    },
    {
      alt: "A matte black helmet resting on the mount",
      src: {
        blaze: "/product/lifestyle-concrete.jpg",
        olive: "/product/lifestyle-concrete-olive.jpg",
        ghost: "/product/lifestyle-concrete-ghost.jpg",
      },
    },
    {
      alt: "Gloves hanging from the hooks on the mount",
      src: {
        blaze: "/product/lifestyle-gloves.jpg",
        olive: "/product/lifestyle-gloves-olive.jpg",
        ghost: "/product/lifestyle-gloves-ghost.jpg",
      },
    },
    {
      alt: "Macro detail of the carved flame relief",
      src: {
        blaze: "/product/detail-flame.jpg",
        olive: "/product/detail-flame-olive.jpg",
        ghost: "/product/detail-flame-ghost.jpg",
      },
    },
  ],
  specs: [
    { label: "Material", value: "PLA+ · matte" },
    { label: "Load rating", value: "10 kg" },
    { label: "Weight", value: "315 g" },
    { label: "Fixings", value: "3 × screws + wall anchors" },
    { label: "Fits", value: "Full-face, open-face and modular" },
  ],
  inTheBox: [
    "Skull mount, arm attached",
    "3 × screws + wall anchors",
    "SKELMET keychain",
    "Installation manual",
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
