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

/**
 * What the product page's sections show of this skull: their pictures, and
 * the lines that are about this one rather than any SKELMET mount. The home
 * and about pages show the Flame Skull's.
 */
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
  sections: {
    // The real skull and arm, one in each colourway
    // (scripts/build-gallery-shots.mjs, build-rider-wall.mjs).
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
    // Shipped in one piece, so it goes up whole, screwed through the foot of
    // its plate: the print files rendered into the scene, in Militia Olive
    // (build-why-colourways.mjs).
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
  // Measured off the print file. Its weight, its load rating (its bracket is
  // not the Flame Skull's) and which helmets it fits are the owner's to
  // confirm before they go here.
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
  // Its studio shots for now: the pictures of it in use (on a wall with a
  // helmet and gear, in its box, going up) are still to be made, as the
  // Flame Skull's were.
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
    // Which helmets it takes and what it holds are the owner's to confirm
    // (2026-10-08): until then its page claims neither.
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
