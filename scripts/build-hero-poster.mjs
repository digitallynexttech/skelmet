/**
 * Builds public/product/hero-skull-cutout.webp from the front-on product shot.
 *
 *   node scripts/build-hero-poster.mjs
 *
 * The hero stage needs a poster that occludes the headline the way the 3D mesh
 * does — by its silhouette, not by its bounding box. A plate on black cannot do
 * that: `mix-blend-mode: screen` brightens the type showing through instead of
 * covering it, and an opaque rectangle punches a flat hole in the bloom behind
 * the section. So the skull is keyed out to real alpha.
 *
 * Keying on chroma rather than luminance, because the backdrop is a lit grey
 * sweep, not black — luminance would eat the skull's own shadows along with it.
 * The separation is absolute: the backdrop sits at chroma 0-15 and the skull at
 * 64-223, with not a single pixel in between, so the only judgement here is how
 * soft to make the edge.
 *
 * Also drops the black wall plate at the bottom, which is neutral and therefore
 * keys away on its own — the mesh does not include it either.
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

const SRC = path.join(ROOT, "public/product/product-front.jpg")
const OUT = path.join(ROOT, "public/product/hero-skull-cutout.webp")

/** Chroma below this is backdrop, above it is skull; between, a soft edge. */
const KEY_LO = 24
const KEY_HI = 56

const smoothstep = (lo, hi, v) => {
  const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo)))
  return t * t * (3 - 2 * t)
}

const { data, info } = await sharp(SRC).raw().toBuffer({ resolveWithObject: true })
const { width: W, height: H, channels: C } = info

const rgba = Buffer.alloc(W * H * 4)
for (let p = 0, q = 0; p < data.length; p += C, q += 4) {
  const r = data[p]
  const g = data[p + 1]
  const b = data[p + 2]
  const chroma = Math.max(r, g, b) - Math.min(r, g, b)
  rgba[q] = r
  rgba[q + 1] = g
  rgba[q + 2] = b
  rgba[q + 3] = Math.round(smoothstep(KEY_LO, KEY_HI, chroma) * 255)
}

// Trim to the silhouette so the stage can size the skull itself rather than
// inheriting whatever margin the photographer left.
let x0 = W
let y0 = H
let x1 = -1
let y1 = -1
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    // A threshold, not zero: the key leaves a dusting of near-transparent
    // pixels in the backdrop grain that would defeat the trim.
    if (rgba[(y * W + x) * 4 + 3] < 8) continue
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
}

const cw = x1 - x0 + 1
const ch = y1 - y0 + 1
const cropped = Buffer.alloc(cw * ch * 4)
for (let y = 0; y < ch; y++) {
  rgba.copy(cropped, y * cw * 4, ((y + y0) * W + x0) * 4, ((y + y0) * W + x1 + 1) * 4)
}

const out = await sharp(cropped, { raw: { width: cw, height: ch, channels: 4 } })
  .webp({ quality: 86, alphaQuality: 100, effort: 6 })
  .toBuffer()

fs.writeFileSync(OUT, out)

console.log(`source   ${W}x${H}`)
console.log(`trimmed  ${cw}x${ch}  (aspect ${(cw / ch).toFixed(3)})`)
console.log(`written  ${path.relative(ROOT, OUT)}  ${(out.length / 1024).toFixed(1)} KB`)
