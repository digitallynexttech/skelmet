/**
 * Blaze Orange's own gallery shots, from the photographs in public/shop.
 *
 *   node scripts/build-shop-shots.mjs [photo-dir]
 *
 * The photographs are 4:5 and taken in Blaze Orange only, so unlike
 * build-gallery-shots.mjs there is nothing to recolour. Each is cut square
 * for the gallery, keeping the edge that carries the point of the picture:
 * the skull and the labels at the top, the bike's wheels at the bottom.
 * Same size and encoding as the other gallery shots.
 */
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

// sharp ships with Next but is not hoisted, so resolve it out of the store.
const store = path.join(ROOT, "node_modules/.pnpm")
const sharpDir = fs
  .readdirSync(store)
  .filter((d) => d.startsWith("sharp@"))
  .sort()
  .pop()
if (!sharpDir) throw new Error("sharp not found in the pnpm store")
const sharp = require(path.join(store, sharpDir, "node_modules/sharp"))

const DIR = path.join(ROOT, "public/product")
const PHOTOS = process.argv[2] ?? path.join(ROOT, "public/shop")
const MAX = 1400

/** keep: the part of the picture the square is cut from - its top, its middle or its bottom. */
const SHOTS = [
  { from: "mount.png", to: "gallery-fitting.jpg", keep: "top" },
  { from: "helmet.png", to: "gallery-placing-helmet.jpg", keep: "centre" },
  { from: "helmet_jacket.png", to: "gallery-hanging-jacket.jpg", keep: "centre" },
  { from: "helmet_jacket_info.png", to: "gallery-gear-labels.jpg", keep: "top" },
  { from: "bike_helmet.png", to: "gallery-garage-bike.jpg", keep: "bottom" },
]

for (const shot of SHOTS) {
  const source = path.join(PHOTOS, shot.from)
  const { width, height } = await sharp(source).metadata()
  const side = Math.min(width, height)
  const top = { top: 0, centre: Math.round((height - side) / 2), bottom: height - side }[shot.keep]
  const file = path.join(DIR, shot.to)
  await sharp(source)
    .extract({ left: Math.round((width - side) / 2), top, width: side, height: side })
    .resize(MAX, MAX, { kernel: "lanczos3" })
    .flatten({ background: "#0e0d13" })
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(file)
  console.log(`${shot.to}: ${Math.round(fs.statSync(file).size / 1024)} KB`)
}
