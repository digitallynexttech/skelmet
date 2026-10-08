/**
 * Client-safe catalogue registry (§4: `<feature>.ts`).
 *
 * Two skulls, each in the same three filament colourways, each colourway its
 * own SKU. A typed registry rather than a database read: the editorial half
 * lives here, and catalog.service.ts overlays the live price, stock and
 * status from the database.
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
  /**
   * The picker's swatch: the skull's own 3D model - the print file - rendered
   * in this filament, three-quarter front, on a transparent ground. The
   * colours are the real prints', from colourway-lineup.jpg.
   */
  swatch: string
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
  /** What the thing is, as the product information on its page declares it. */
  productType: string
  strapline: string
  /** Wire-shaped money: a string, exactly as the API would send it (§5). */
  price: string
  compareAtPrice: string
  /** 0 with `reviewCount` 0 for a product nobody has reviewed yet: the page shows no stars. */
  rating: number
  reviewCount: number
  unitsLeft: number
  colourways: Colourway[]
  /**
   * Each finish's own pictures, in the order the gallery shows them. A Record,
   * so a finish cannot be left without any: only the first picture used to
   * follow the swatch, and picking Militia Olive left four orange photographs
   * behind it.
   */
  gallery: Record<ColourwayId, GalleryImage[]>
  specs: Array<{ label: string; value: string; pending?: boolean }>
  inTheBox: string[]
}

/** One picture, in one finish, as the gallery shows it. */
export type GalleryImage = {
  src: string
  alt: string
  /** For a shot of the mount in use: what it is showing, over the image. */
  caption?: { title: string; body: string }
}

/**
 * A shot taken in all three finishes. The file per colourway is a Record, so
 * a finish cannot be left out. All three files share framing and dimensions,
 * so `object-cover` crops them identically and switching colourway does not
 * shift the image.
 */
type GalleryShot = Omit<GalleryImage, "src"> & { src: Record<ColourwayId, string> }

function inFinish(shot: GalleryShot, id: ColourwayId): GalleryImage {
  return { ...shot, src: shot.src[id] }
}

export const COLOURWAYS: Colourway[] = [
  {
    id: "blaze",
    name: "Blaze Orange",
    sku: "SKM-BLZ",
    hex: "#FF5A1F",
    swatch: "/product/swatch-3d-blaze.png",
    blurb: "Bright and hot, built to catch the eye.",
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
    swatch: "/product/swatch-3d-olive.png",
    blurb: "Bold in presence, subtle in colour.",
    image: "/product/colourway-olive-print.jpg",
    price: "3499",
    stock: 0,
    inStock: true,
  },
  {
    id: "ghost",
    name: "Ghost Grey",
    sku: "SKM-GHT",
    // The grey the filament prints as, measured off the lit face of the real
    // print in colourway-lineup.jpg: near neutral, a faint violet cast. It
    // was #C8CED6, which read as silver.
    hex: "#98979E",
    swatch: "/product/swatch-3d-ghost.png",
    blurb: "Calm, cold and still as stone.",
    image: "/product/colourway-ghost-grey-print.jpg",
    price: "3499",
    stock: 0,
    inStock: true,
  },
]

const FRONT: GalleryShot = {
  alt: "Flame skull mount, front elevation",
  src: {
    blaze: "/product/product-front.jpg",
    olive: "/product/colourway-olive-print.jpg",
    ghost: "/product/colourway-ghost-grey-print.jpg",
  },
}

// The owner's photographs, in Blaze Orange as taken (scripts/build-shop-shots.mjs).
// The olive and the grey are the same photographs with only the skull
// recoloured, against the real prints (GPT Image 2.5 on Higgsfield).
const FITTING: GalleryShot = {
  alt: "Fixing the mount to the wall with a screwdriver, the skull already on its arm",
  src: {
    blaze: "/product/gallery-fitting.jpg",
    olive: "/product/gallery-fitting-olive.jpg",
    ghost: "/product/gallery-fitting-ghost-grey.jpg",
  },
}

const PLACING_HELMET: GalleryShot = {
  alt: "Setting a black helmet onto the skull on its wall mount",
  src: {
    blaze: "/product/gallery-placing-helmet.jpg",
    olive: "/product/gallery-placing-helmet-olive.jpg",
    ghost: "/product/gallery-placing-helmet-ghost-grey.jpg",
  },
}

const HANGING_JACKET: GalleryShot = {
  alt: "Hanging a riding jacket and gloves on the hook under a helmet on the mount",
  src: {
    blaze: "/product/gallery-hanging-jacket.jpg",
    olive: "/product/gallery-hanging-jacket-olive.jpg",
    ghost: "/product/gallery-hanging-jacket-ghost-grey.jpg",
  },
}

const GEAR_LABELS: GalleryShot = {
  alt: "A helmet on the mount, gloves and a jacket on its hooks, labelled: keeps the helmet organised, prevents scratches and damage, improves airflow so it dries faster, holds gloves, extra hook for jackets and gear",
  src: {
    blaze: "/product/gallery-gear-labels.jpg",
    olive: "/product/gallery-gear-labels-olive.jpg",
    ghost: "/product/gallery-gear-labels-ghost-grey.jpg",
  },
}

const GARAGE_BIKE: GalleryShot = {
  alt: "A helmet on the mount on a lit garage wall, a sports bike parked below it",
  src: {
    blaze: "/product/gallery-garage-bike.jpg",
    olive: "/product/gallery-garage-bike-olive.jpg",
    ghost: "/product/gallery-garage-bike-ghost-grey.jpg",
  },
}

const INSTALL: GalleryShot = {
  alt: "Screwing the mount to the wall through the foot of its plate",
  caption: {
    title: "Up in four steps",
    body: "Mark, drill, plug, screw. The template, screws and wall plugs are in the box.",
  },
  src: {
    blaze: "/product/gallery-install.jpg",
    olive: "/product/gallery-install-olive.jpg",
    ghost: "/product/gallery-install-ghost-grey.jpg",
  },
}

const FLAME_DETAIL: GalleryShot = {
  alt: "Macro detail of the carved flame relief",
  src: {
    blaze: "/product/detail-flame.jpg",
    olive: "/product/detail-flame-olive.jpg",
    ghost: "/product/detail-flame-ghost-grey.jpg",
  },
}

/** The gallery's order, the same in every finish. */
const SHOTS = [
  FITTING,
  PLACING_HELMET,
  HANGING_JACKET,
  GEAR_LABELS,
  GARAGE_BIKE,
  INSTALL,
  FLAME_DETAIL,
  FRONT,
]

export const FLAME_SKULL_MOUNT: Product = {
  slug: "flame-skull-mount",
  name: "Flame Skull Helmet Mount",
  productType: "Wall-mounted helmet holder (flame skull mount)",
  strapline: "It earned every scratch. Give it a wall, not the floor.",
  price: "3499",
  compareAtPrice: "4999",
  rating: 4.9,
  reviewCount: 312,
  unitsLeft: 12,
  colourways: COLOURWAYS,
  gallery: {
    blaze: SHOTS.map((shot) => inFinish(shot, "blaze")),
    olive: SHOTS.map((shot) => inFinish(shot, "olive")),
    ghost: SHOTS.map((shot) => inFinish(shot, "ghost")),
  },
  specs: [
    { label: "Material", value: "PLA+ · matte" },
    { label: "Load rating", value: "10 kg" },
    { label: "Weight", value: "315 g" },
    { label: "Fixings", value: "3 × screws + wall plugs" },
    { label: "Fits", value: "Full-face, open-face and modular" },
  ],
  // As The build section shows it (anatomy.tsx): no keychain - the mystery
  // box took its place - and the paper template is the installation guide.
  inTheBox: [
    "Skull mount, arm attached",
    "3 × screws + wall plugs",
    "Drilling template",
    "Thank-you card",
    "Mystery box",
  ],
}

// ── the Piston Skull ────────────────────────────────────────

/**
 * The same filament, name and swatch colour as the Flame Skull's, with this
 * skull's own SKU and pictures.
 */
function pistonFinish(
  id: ColourwayId,
  sku: string,
  files: { image: string; swatch: string },
): Colourway {
  const { name, hex, blurb } = COLOURWAYS.find((c) => c.id === id)!
  // Sold out until the database says otherwise: it launches as a draft, and a
  // page built without its rows must not offer what checkout would refuse.
  return { id, name, hex, blurb, sku, ...files, price: "3499", stock: 0, inStock: false }
}

export const PISTON_COLOURWAYS: Colourway[] = [
  pistonFinish("blaze", "SKM-PST-BLZ", {
    image: "/product/piston-hero.jpg",
    swatch: "/product/swatch-3d-piston-blaze.png",
  }),
  pistonFinish("olive", "SKM-PST-OLV", {
    image: "/product/piston-hero-olive.jpg",
    swatch: "/product/swatch-3d-piston-olive.png",
  }),
  pistonFinish("ghost", "SKM-PST-GHT", {
    image: "/product/piston-hero-ghost-grey.jpg",
    swatch: "/product/swatch-3d-piston-ghost.png",
  }),
]

/**
 * Its pictures start as renders of the two print files, skull-design-2.stl on
 * its own bracket (Helmet Hanger 75mm final center hook.stl), seated as the
 * owner's photos of the real mount show it: the post into the underside
 * behind the jaw, the skull tipped forward. An image model then gave each the
 * look of a studio photograph, and each kept the render's outline (97-99 %
 * overlap). The other finishes are the orange ones recoloured
 * (scripts/build-piston-colourways.mjs), so all three show the same skull.
 */
const pistonShot = (name: string, alt: string, caption?: GalleryShot["caption"]): GalleryShot => ({
  alt,
  ...(caption ? { caption } : {}),
  src: {
    blaze: `/product/piston-${name}.jpg`,
    olive: `/product/piston-${name}-olive.jpg`,
    ghost: `/product/piston-${name}-ghost-grey.jpg`,
  },
})

const PISTON_SHOTS = [
  pistonShot("hero", "Piston skull mount on the wall, three-quarter view"),
  pistonShot("detail", "Close up of the face and the piston clenched in its teeth"),
  pistonShot("front", "Piston skull mount, front view"),
  pistonShot("mohawk", "From above: the mohawk running back over the skull"),
]

export const PISTON_SKULL_MOUNT: Product = {
  slug: "piston-skull-mount",
  name: "Piston Skull Helmet Mount",
  productType: "Wall-mounted helmet holder (piston skull mount)",
  strapline: "Mohawk up, piston in its teeth. A wall for the lid that earned it.",
  // The owner's price (2026-10-08). Live price and stock come from the variant rows.
  price: "3499",
  compareAtPrice: "4999",
  // New: nobody has reviewed it yet, so the page shows no stars.
  rating: 0,
  reviewCount: 0,
  unitsLeft: 0,
  colourways: PISTON_COLOURWAYS,
  gallery: {
    blaze: PISTON_SHOTS.map((shot) => inFinish(shot, "blaze")),
    olive: PISTON_SHOTS.map((shot) => inFinish(shot, "olive")),
    ghost: PISTON_SHOTS.map((shot) => inFinish(shot, "ghost")),
  },
  // Measured off the print file. Its weight and which helmets it fits are the
  // owner's to confirm before they go here.
  specs: [
    { label: "Material", value: "PLA+ · matte" },
    { label: "Load rating", value: "10 kg" },
    { label: "Skull", value: "15 × 28 × 21 cm" },
    { label: "Fixings", value: "3 × screws + wall plugs" },
  ],
  inTheBox: [
    "Skull mount, arm attached",
    "3 × screws + wall plugs",
    "Drilling template",
    "Thank-you card",
    "Mystery box",
  ],
}

export const PRODUCTS: Product[] = [FLAME_SKULL_MOUNT, PISTON_SKULL_MOUNT]

export function getProduct(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug)
}

/** A colourway of a product: the Flame Skull's unless another is named. */
export function getColourway(
  id: string,
  product: Product = FLAME_SKULL_MOUNT,
): Colourway | undefined {
  return product.colourways.find((c) => c.id === id)
}

/** Falls back to the first colourway rather than throwing on a bad query param. */
export function resolveColourway(
  id: string | undefined,
  product: Product = FLAME_SKULL_MOUNT,
): Colourway {
  const found = id ? getColourway(id, product) : undefined
  return found ?? product.colourways[0]!
}
