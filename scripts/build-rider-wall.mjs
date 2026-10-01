/**
 * The Rider wall's four pictures of the mount in use, the owner's own, into
 * public/product/rider-*.jpg.
 *
 *   node scripts/build-rider-wall.mjs [source-dir]
 *
 * Real photographs, on purpose: the rendered scenes that were here read as
 * made up. Each is cropped square for its tile, and the office shots are
 * toned a little down - a touch of contrast, five per cent less light - so a
 * white wall does not glare out of the dark page.
 *
 * Not every helmet is as it was shot: every photograph had the same black
 * one. In IMG_0777 it is repainted olive green (rider-wall-edits/ beside the
 * photographs). An image model repainted the shell only, and everything else
 * - the skull, the mount, the straps, the gloves, the wall - was put back
 * from the photograph pixel for pixel, so the product is never the model's.
 * The motorcycle wall is the owner's picture as supplied, already finished,
 * so it is cropped and not toned.
 *
 * A changed picture needs a new file name: /product is cached for 30 days as
 * immutable.
 */
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"

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
  // IMG_0777, cropped [0, 0, 1] before the repaint.
  {
    from: "rider-wall-edits/IMG_0777-olive-helmet.png",
    to: "rider-olive-helmet.jpg",
    crop: [0, 0, 1],
  },
  { from: "IMG_0788.JPG.jpeg", to: "rider-bare-skull.jpg", crop: [0.07, 0.12, 0.9] },
  {
    from: "rider-wall-edits/with-jacket-motorcycle.png",
    to: "rider-motorcycle-wall.jpg",
    crop: [0.055, 0.083, 0.755],
    tone: false,
  },
  { from: "6.jpeg", to: "rider-dark-door.jpg", crop: [0, 0.08, 1] },
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

  let image = sharp(data)
    .extract({ left, top, width: side, height: side })
    .resize(out, out, { kernel: "lanczos3" })
  if (shot.tone !== false) {
    image = image.linear(1.05, -10).modulate({ brightness: 0.95, saturation: 1.04 })
  }
  const file = path.join(OUT_DIR, shot.to)
  await image.sharpen({ sigma: 0.5 }).jpeg({ quality: 84, mozjpeg: true }).toFile(file)
  console.log(`${shot.to}  ${out}x${out}  ${(fs.statSync(file).size / 1024).toFixed(0)} KB`)
}
