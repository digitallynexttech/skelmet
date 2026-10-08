/**
 * Builds the Piston Skull's pictures in the other two colourways.
 *
 *   node scripts/build-piston-colourways.mjs
 *
 * The orange public/product/piston-*.jpg (studio renders of the print file) are
 * the sources; only the colour changes (recolour-skull.mjs), so all three
 * finishes show the same skull in the same light.
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
const SHOTS = ["hero", "detail", "front", "mohawk"]
const FINISHES = [
  { colourway: "olive", suffix: "olive" },
  { colourway: "ghost", suffix: "ghost-grey" },
]

for (const shot of SHOTS) {
  for (const { colourway, suffix } of FINISHES) {
    const { data, info } = await sharp(path.join(DIR, `piston-${shot}.jpg`))
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    await recolourSkull(sharp, data, info.width, info.height, colourway, { studio: true })

    const name = `piston-${shot}-${suffix}.jpg`
    const file = path.join(DIR, name)
    await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } })
      .jpeg({ quality: 86, mozjpeg: true })
      .toFile(file)
    const kb = (fs.statSync(file).size / 1024).toFixed(0)
    console.log(`${name.padEnd(32)} ${info.width}x${info.height}  ${kb} KB`)
  }
}
