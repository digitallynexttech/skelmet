/**
 * Builds the Rider wall's four pictures of the mount in use (the owner's own)
 * into public/product/rider-*.jpg.
 *
 *   node scripts/build-rider-wall.mjs [source-dir]
 *
 * Each is cropped square for its tile. Straight photographs are toned a little
 * down so a white wall does not glare on the dark page; the two finished edits
 * in rider-wall-edits/ are only cropped. Two skulls are recoloured to the other
 * colourways (recolour-skull.mjs).
 *
 * A changed picture needs a new file name: /product is cached for 30 days as
 * immutable.
 */
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"

import { recolourSkull } from "./recolour-skull.mjs"

const require = createRequire(import.meta.url)
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.slice(1)), "..")

// sharp ships with Next but is not hoisted, so resolve it out of the store.
const store = path.join(ROOT, "node_modules/.pnpm")
const sharpDir = fs
  .readdirSync(store)
  .filter((d) => d.startsWith("sharp@"))
  .sort()
  .pop()
if (!sharpDir) throw new Error("sharp not found in the pnpm store")
const sharp = require(path.join(store, sharpDir, "node_modules/sharp"))

const SRC_DIR = process.argv[2] ?? "D:/DN/DN_WEB/SKELMET/FILES_SKELMET/product-images"
const OUT_DIR = path.join(ROOT, "public/product")
/** Twice the widest tile (a quarter of a 1440px page), with room to spare. */
const MAX = 1400

/**
 * crop: left and top as fractions of the upright picture's width and height,
 * and the square's side as a fraction of its width.
 */
const SHOTS = [
  // IMG_0777, cropped [0, 0, 1] before the rework.
  {
    from: "rider-wall-edits/IMG_0777-cream-retro-helmet.png",
    to: "rider-cream-helmet.jpg",
    crop: [0, 0, 1],
    tone: false,
    colourway: "olive",
  },
  { from: "IMG_0788.JPG.jpeg", to: "rider-bare-skull.jpg", crop: [0.07, 0.12, 0.9] },
  {
    from: "rider-wall-edits/with-jacket-motorcycle.png",
    to: "rider-motorcycle-wall.jpg",
    crop: [0.055, 0.083, 0.755],
    tone: false,
  },
  { from: "6.jpeg", to: "rider-dark-door.jpg", crop: [0, 0.08, 1], colourway: "ghost" },
]

for (const shot of SHOTS) {
  const src = path.join(SRC_DIR, shot.from)
  if (!fs.existsSync(src)) throw new Error(`missing source: ${src}`)

  // Upright first: phone photographs carry their orientation in EXIF.
  const { data, info } = await sharp(src).rotate().toBuffer({ resolveWithObject: true })
  const [fx, fy, fside] = shot.crop
  const side = Math.round(fside * info.width)
  const left = Math.round(fx * info.width)
  const top = Math.min(Math.round(fy * info.height), info.height - side)
  const out = Math.min(side, MAX)

  const rgb = await sharp(data)
    .extract({ left, top, width: side, height: side })
    .resize(out, out, { kernel: "lanczos3" })
    .removeAlpha()
    .raw()
    .toBuffer()
  if (shot.colourway) await recolourSkull(sharp, rgb, out, out, shot.colourway)

  let image = sharp(rgb, { raw: { width: out, height: out, channels: 3 } })
  if (shot.tone !== false) {
    image = image.linear(1.05, -10).modulate({ brightness: 0.95, saturation: 1.04 })
  }
  const file = path.join(OUT_DIR, shot.to)
  await image.sharpen({ sigma: 0.5 }).jpeg({ quality: 84, mozjpeg: true }).toFile(file)
  console.log(`${shot.to}  ${out}x${out}  ${(fs.statSync(file).size / 1024).toFixed(0)} KB`)
}
