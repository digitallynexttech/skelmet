// Client-safe catalogue: two skulls, three colourways each, one SKU per colourway. The editorial
// half lives here; catalog.service.ts overlays live price, stock and status from the database.

export type ColourwayId = "blaze" | "olive" | "ghost"

export type Colourway = {
  id: ColourwayId
  name: string
  sku: string
  /** Swatch token: matches the filament, not the UI palette. */
  hex: string
  /** The print file rendered in this filament, on a transparent ground. */
  swatch: string
  blurb: string
  image: string
  /** Wire-shaped money. A fallback: the live per-variant price is overlaid from the database. */
  price: string
  /** Units on hand, overlaid the same way. */
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
  /** Wire-shaped money: a string. */
  price: string
  compareAtPrice: string
  /** 0 with `reviewCount` 0 for a product nobody has reviewed yet: the page shows no stars. */
  rating: number
  reviewCount: number
  unitsLeft: number
  colourways: Colourway[]
  /** Each finish's own pictures, in gallery order. A Record, so no finish is left without any. */
  gallery: Record<ColourwayId, GalleryImage[]>
  specs: Array<{ label: string; value: string; pending?: boolean }>
  inTheBox: string[]
  sections: ProductSections
}

/** A picture as a section shows it. */
export type Picture = {
  src: string
  alt: string
  /** Where a crop keeps it, as CSS object-position, when the centre would cut the skull. */
  position?: string
}

/** FAQ answers that differ for one skull, by question. null leaves the question out. */
export type FaqAnswers = Record<string, string | null>

/** What the product page's sections show of this skull. Home and about show the Flame Skull's. */
export type ProductSections = {
  /** "More than a mount": one picture per card, in the cards' order. */
  inUse: [Picture, Picture, Picture]
  /** "The build": the picture beside the specs, and what it says above them. */
  build: { picture: Picture; body: string }
  /** "The finish": the close-up, and what it says about the print. */
  finish: { picture: Picture; body: string }
  /** "Install": the mount going up on a wall. */
  install: Picture
  /** "The alternatives": what it looks like, in the comparison's last row. */
  looksLike: string
  /** Beside the questions. */
  faq: Picture
  /** Where the questions' answers are not true of this skull, or not yet known. */
  faqAnswers?: FaqAnswers
}

/** One picture, in one finish, as the gallery shows it. */
export type GalleryImage = {
  src: string
  alt: string
  /** For a shot of the mount in use: what it is showing, over the image. */
  caption?: { title: string; body: string }
}

// One shot in all three finishes. The files share framing and size, so switching does not shift it.
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
    // The grey the real print shows: near neutral, a faint violet cast.
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

// The owner's photographs in Blaze Orange; olive and grey recolour only the skull.
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
  // Matches the box picture in The build section (anatomy.tsx).
  inTheBox: [
    "Skull mount, arm attached",
    "3 × screws + wall plugs",
    "Drilling template",
    "Thank-you card",
    "Mystery box",
  ],
  sections: {
    // One in each colourway.
    inUse: [
      {
        src: "/product/gallery-wall-gear-ghost-grey.jpg",
        alt: "A helmet on a Ghost Grey mount, a jacket, gloves and keys on its hooks",
      },
      {
        src: "/product/gallery-garage-night.jpg",
        alt: "The mount in a garage at night, a white open-face helmet on the skull",
      },
      {
        src: "/product/rider-cream-helmet.jpg",
        alt: "A Militia Olive mount wearing a cream open-face helmet, gloves and a jacket below",
      },
    ],
    build: {
      picture: {
        src: "/product/box-contents.jpg",
        alt: "What comes in the box: the flame skull on its arm in one piece, a paper drilling guide marking the three holes, three screws and wall plugs, a thank-you card and a mystery box",
      },
      body: "The mount arm fixes to the wall with 3 screws. The skull is shaped to fit into any helmet type and size. The whole mount supports up to 10 kg.",
    },
    finish: {
      picture: {
        src: "/product/detail-flame.jpg",
        alt: "Macro detail of the carved flame relief and 3D-print layer lines",
      },
      body: "We don't sand the print smooth and pretend it was moulded. The fine horizontal ridges catch the light, the flame valleys go properly deep, and the whole thing reads as made rather than manufactured.",
    },
    // Shipped in one piece, so it goes up whole.
    install: {
      src: "/product/why-install-olive.jpg",
      alt: "Screwing a Militia Olive SKELMET mount to a wall through the foot of its plate, the skull already fixed to its arm",
    },
    looksLike: "A flaming skull",
    faq: {
      src: "/product/gallery-bare-skull-ghost-grey.jpg",
      alt: "The SKELMET mount in Ghost Grey on its black arm, gloves hanging from the hook",
    },
  },
}

// ── the Piston Skull ────────────────────────────────────────

// The Flame Skull's filament, name and colour, with this skull's SKU and pictures.
function pistonFinish(
  id: ColourwayId,
  sku: string,
  files: { image: string; swatch: string },
): Colourway {
  const { name, hex, blurb } = COLOURWAYS.find((c) => c.id === id)!
  // Sold out unless the database says otherwise: a page built without its rows must not sell it.
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

// Renders of the print files made photographic; olive and grey are the orange recoloured.
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
  // Owner's price. Live price and stock come from the variant rows.
  price: "3499",
  compareAtPrice: "4999",
  // No reviews yet, so no stars.
  rating: 0,
  reviewCount: 0,
  unitsLeft: 0,
  colourways: PISTON_COLOURWAYS,
  gallery: {
    blaze: PISTON_SHOTS.map((shot) => inFinish(shot, "blaze")),
    olive: PISTON_SHOTS.map((shot) => inFinish(shot, "olive")),
    ghost: PISTON_SHOTS.map((shot) => inFinish(shot, "ghost")),
  },
  // Weight, load rating (its own bracket) and helmet fit wait for the owner to confirm.
  specs: [
    { label: "Material", value: "PLA+ · matte" },
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
  // Studio shots until pictures of it in use are made.
  sections: {
    inUse: [
      {
        src: "/product/piston-hero-ghost-grey.jpg",
        alt: "A Ghost Grey piston skull mount on the wall, three-quarter view",
      },
      {
        src: "/product/piston-front.jpg",
        alt: "A Blaze Orange piston skull mount on the wall, face on",
      },
      {
        src: "/product/piston-detail-olive.jpg",
        alt: "A Militia Olive piston skull, close on its face and the piston in its teeth",
      },
    ],
    build: {
      picture: {
        src: "/product/piston-mohawk.jpg",
        alt: "The piston skull on its black arm, from above, the mohawk running back over its head",
        position: "50% 80%",
      },
      body: "The mount arm fixes to the wall with 3 screws. The skull rides on its post, tipped forward and facing out from the wall.",
    },
    finish: {
      picture: {
        src: "/product/piston-detail.jpg",
        alt: "Close up of the piston skull's face, the piston's rings and the print's layer lines",
      },
      body: "We don't sand the print smooth and pretend it was moulded. The fine ridges of every layer catch the light, the mohawk's spikes and the piston's rings stay crisp, and the whole thing reads as made rather than manufactured.",
    },
    install: {
      src: "/product/piston-hero-olive.jpg",
      alt: "A Militia Olive piston skull mount fixed to the wall",
    },
    looksLike: "A mohawk skull, piston in its teeth",
    faq: {
      src: "/product/piston-mohawk-ghost-grey.jpg",
      alt: "The Piston Skull Helmet Mount in Ghost Grey, from above",
    },
    // Helmet fit and load are the owner's to confirm: until then the page claims neither.
    faqAnswers: {
      "Will the SKELMET mount hold a full-face helmet?": null,
      "Can the SKELMET mount hold my jacket and gloves as well as my helmet?":
        "Yes. The arm has hooks under the skull, so your gloves, jacket and keys hang right below your helmet.",
      "Can I put up the SKELMET mount without drilling?":
        "We do not recommend it. The mount is made to be screwed into the wall with the three screws and wall plugs in the box. Adhesive strips and hooks are not made for a helmet's weight, and the mount could come down. The paper guide in the box marks exactly where to drill.",
    },
  },
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
