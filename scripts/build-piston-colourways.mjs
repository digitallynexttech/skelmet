/**
 * Builds the Piston Skull's pictures in the other two colourways.
 *
 *   node scripts/build-piston-colourways.mjs [shot ...]
 *
 * The orange public/product/piston-*.jpg are the sources: the studio renders and
 * the owner's photos of the mount in use. Only the colour changes
 * (recolour-skull.mjs), so all three finishes show the same picture. Name shots
 * to build only those.
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
// studio: a plain backdrop, so pale highlights count as print. Off for photos in a
// room, where warm walls, wood and skin must keep their colour.
const SHOTS = [
  { shot: "hero", studio: true },
  { shot: "detail", studio: true },
  { shot: "front", studio: true },
  { shot: "mohawk", studio: true },
  // The shadowed wood slat under the mohawk passes for print; keep it as shot.
  {
    shot: "fitting",
    studio: false,
    keep: [
      [230, 220, 284, 560],
      [284, 305, 340, 560],
    ],
  },
  { shot: "placing-helmet", studio: false },
  { shot: "wall-gear", studio: false },
  { shot: "garage-bike", studio: false },
  { shot: "helmet-held", studio: false },
  { shot: "back", studio: false },
]
const FINISHES = [
  { colourway: "olive", suffix: "olive" },
  { colourway: "ghost", suffix: "ghost-grey" },
]
const only = process.argv.slice(2)

// In a room photo, warm-lit wood beside the skull can pass for print. Keep the
// recolour to the skull: the largest piece of deeply saturated orange (print is
// above 0.8 even in shadow, lit wood below it), holes filled, widened, soft-edged.
async function skullRegion(rgb, width, height) {
  const N = width * height
  const strict = new Uint8Array(N)
  for (let p = 0; p < N; p++) {
    const r = rgb[p * 3],
      g = rgb[p * 3 + 1],
      b = rgb[p * 3 + 2]
    const h = r > Math.max(g, b) ? (60 * (g - b)) / (r - Math.min(g, b) || 1) : -1
    strict[p] = r > 90 && (r - Math.min(g, b)) / r > 0.8 && h >= 5 && h <= 40 ? 1 : 0
  }
  const label = new Int32Array(N).fill(-1)
  let best = -1,
    bestSize = 0
  for (let s = 0, id = 0; s < N; s++) {
    if (!strict[s] || label[s] >= 0) continue
    let size = 0
    const stack = [s]
    label[s] = id
    while (stack.length) {
      const p = stack.pop(),
        x = p % width
      size++
      for (const n of [
        x + 1 < width ? p + 1 : -1,
        x > 0 ? p - 1 : -1,
        p + width < N ? p + width : -1,
        p - width,
      ])
        if (n >= 0 && strict[n] && label[n] < 0) {
          label[n] = id
          stack.push(n)
        }
    }
    if (size > bestSize) {
      bestSize = size
      best = id
    }
    id++
  }
  const keep = new Uint8Array(N)
  for (let p = 0; p < N; p++) keep[p] = label[p] === best ? 255 : 0
  // Holes it encloses (eyes, teeth in shadow) are skull too.
  const outside = new Uint8Array(N),
    queue = []
  const seed = (p) => {
    if (!keep[p] && !outside[p]) {
      outside[p] = 1
      queue.push(p)
    }
  }
  for (let x = 0; x < width; x++) {
    seed(x)
    seed((height - 1) * width + x)
  }
  for (let y = 0; y < height; y++) {
    seed(y * width)
    seed(y * width + width - 1)
  }
  while (queue.length) {
    const p = queue.pop(),
      x = p % width
    for (const n of [
      x + 1 < width ? p + 1 : -1,
      x > 0 ? p - 1 : -1,
      p + width < N ? p + width : -1,
      p - width,
    ])
      if (n >= 0) seed(n)
  }
  for (let p = 0; p < N; p++) if (!outside[p]) keep[p] = 255
  // Widen by 9 px (libvips erodes the dark, so erode() grows the white), then soften.
  const grown = await sharp(Buffer.from(keep), { raw: { width, height, channels: 1 } })
    .erode(9)
    .extractChannel(0)
    .raw()
    .toBuffer()
  return sharp(grown, { raw: { width, height, channels: 1 } })
    .blur(2)
    .extractChannel(0)
    .raw()
    .toBuffer()
}

for (const { shot, studio, keep } of SHOTS.filter((s) => !only.length || only.includes(s.shot))) {
  for (const { colourway, suffix } of FINISHES) {
    const { data, info } = await sharp(path.join(DIR, `piston-${shot}.jpg`))
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const original = studio ? null : Buffer.from(data)
    await recolourSkull(sharp, data, info.width, info.height, colourway, { studio })
    if (original) {
      const region = await skullRegion(original, info.width, info.height)
      for (const [x0, y0, x1, y1] of keep ?? [])
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) region[y * info.width + x] = 0
      for (let p = 0; p < info.width * info.height; p++) {
        const a = region[p] / 255
        for (let c = 0; c < 3; c++)
          data[p * 3 + c] = Math.round(
            original[p * 3 + c] + (data[p * 3 + c] - original[p * 3 + c]) * a,
          )
      }
    }

    const name = `piston-${shot}-${suffix}.jpg`
    const file = path.join(DIR, name)
    await sharp(data, { raw: { width: info.width, height: info.height, channels: 3 } })
      .jpeg({ quality: 86, mozjpeg: true })
      .toFile(file)
    const kb = (fs.statSync(file).size / 1024).toFixed(0)
    console.log(`${name.padEnd(32)} ${info.width}x${info.height}  ${kb} KB`)
  }
}
