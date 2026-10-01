/**
 * The product gallery's use-case shots, each in all three colourways, and
 * the colourway picker's skull swatches.
 *
 *   node scripts/build-gallery-shots.mjs [owner-photo-dir]
 *
 * Every shot shows the real mount - the skull on its arm, the plate on the
 * wall - in use: helmet and riding gear hung on it, a garage at night, the
 * owner's own photograph of the bare skull with gloves on its hook, and
 * screwing it up. They are the scenes the home page already uses (their
 * provenance is in bento.tsx and build-rider-wall.mjs), cropped square for
 * the gallery. The orange is the scene as made; the olive and the grey are
 * recoloured from it (recolour-skull.mjs), so all three finishes share
 * framing pixel for pixel and switching colourway does not shift the image.
 *
 * The swatches are the three real prints, cut out of colourway-lineup.jpg.
 */
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

import { recolourSkull } from "./recolour-skull.mjs"

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
const PHOTOS = process.argv[2] ?? "D:/DN/DN_WEB/SKELMET/FILES_SKELMET/product-images"
const MAX = 1400

/**
 * crop: left and top as fractions of the upright picture's width and height,
 * and the square's side as a fraction of its width. tone: the office
 * photographs' light toning, as on the Rider wall.
 */
const SHOTS = [
  { from: path.join(DIR, "why-safeguard.jpg"), crop: [0.1, 0, 0.747], name: "gallery-wall-gear" },
  {
    from: path.join(DIR, "why-store-white-helmet.jpg"),
    crop: [0.1, 0, 0.7465],
    name: "gallery-garage-night",
  },
  {
    from: path.join(PHOTOS, "IMG_0788.JPG.jpeg"),
    crop: [0.07, 0.12, 0.9],
    tone: true,
    name: "gallery-bare-skull",
  },
  { from: path.join(DIR, "why-install.jpg"), crop: [0.18, 0, 0.747], name: "gallery-install" },
]

const FINISHES = [
  { suffix: "", colourway: null },
  { suffix: "-olive", colourway: "olive" },
  { suffix: "-ghost-grey", colourway: "ghost" },
]

for (const shot of SHOTS) {
  if (!fs.existsSync(shot.from)) throw new Error(`missing source: ${shot.from}`)
  // Upright first: phone photographs carry their orientation in EXIF.
  const { data, info } = await sharp(shot.from).rotate().toBuffer({ resolveWithObject: true })
  const [fx, fy, fside] = shot.crop
  const side = Math.round(fside * info.width)
  const left = Math.round(fx * info.width)
  const top = Math.min(Math.round(fy * info.height), info.height - side)
  const out = Math.min(side, MAX)

  let square = sharp(data)
    .extract({ left, top, width: side, height: side })
    .resize(out, out, { kernel: "lanczos3" })
  if (shot.tone) square = square.linear(1.05, -10).modulate({ brightness: 0.95, saturation: 1.04 })
  const orange = await square.removeAlpha().raw().toBuffer()

  for (const finish of FINISHES) {
    const rgb = Buffer.from(orange)
    if (finish.colourway) await recolourSkull(sharp, rgb, out, out, finish.colourway)
    const file = path.join(DIR, `${shot.name}${finish.suffix}.jpg`)
    await sharp(rgb, { raw: { width: out, height: out, channels: 3 } })
      .sharpen({ sigma: 0.5 })
      .jpeg({ quality: 84, mozjpeg: true })
      .toFile(file)
    const kb = (fs.statSync(file).size / 1024).toFixed(0)
    console.log(`${path.basename(file).padEnd(36)} ${out}x${out}  ${kb} KB`)
  }
}

/** Each print's face in colourway-lineup.jpg: centre x as a fraction of the width. */
const SWATCHES = [
  { id: "blaze", cx: 0.19 },
  { id: "olive", cx: 0.5 },
  { id: "ghost", cx: 0.81 },
]
const lineup = path.join(DIR, "colourway-lineup.jpg")
const { width: LW, height: LH } = await sharp(lineup).metadata()
for (const s of SWATCHES) {
  const size = Math.round(LW * 0.25)
  const file = path.join(DIR, `swatch-${s.id}.jpg`)
  await sharp(lineup)
    .extract({
      left: Math.round(s.cx * LW - size / 2),
      top: Math.round(LH * 0.45 - size / 2),
      width: size,
      height: size,
    })
    .resize(192, 192, { kernel: "lanczos3" })
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(file)
  console.log(`${path.basename(file).padEnd(36)} 192x192`)
}
