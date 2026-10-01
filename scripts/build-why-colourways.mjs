/**
 * The "Why it slaps" photographs in the other two colourways, so the five
 * tiles do not show five orange skulls.
 *
 *   node scripts/build-why-colourways.mjs
 *
 * The orange photographs (public/product/why-*.jpg) stay the sources: their
 * skull is the real print file rendered and laid into the scene, so its shape
 * and light are already right, and only its colour changes here
 * (recolour-skull.mjs). Store in style stays Blaze Orange.
 *
 * The recoloured ones get names of their own, -olive and -ghost-grey: the
 * orange files are live and cached for 30 days as immutable.
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

const SHOTS = [
  { from: "why-install.jpg", to: "why-install-olive.jpg", colourway: "olive" },
  { from: "why-safeguard.jpg", to: "why-safeguard-ghost-grey.jpg", colourway: "ghost" },
  { from: "why-clean.jpg", to: "why-clean-olive.jpg", colourway: "olive" },
  { from: "why-accessories.jpg", to: "why-accessories-ghost-grey.jpg", colourway: "ghost" },
]

for (const shot of SHOTS) {
  const { data, info } = await sharp(path.join(DIR, shot.from))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  await recolourSkull(sharp, data, info.width, info.height, shot.colourway)

  const file = path.join(DIR, shot.to)
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } })
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(file)
  const kb = (fs.statSync(file).size / 1024).toFixed(0)
  console.log(`${shot.to.padEnd(32)} ${info.width}x${info.height}  ${kb} KB`)
}
