/**
 * Builds every Ghost Grey photograph: the front plate and the four gallery
 * shots, from their Militia Olive and Blaze Orange twins.
 *
 *   node scripts/build-ghost-shots.mjs
 *
 * The first ghost set came back from an image model asked for a grey print,
 * and it painted one near white: next to the real filament the gallery was
 * selling a silver skull. The yardstick is colourway-lineup.jpg, the one shot
 * with the three real prints side by side under one light. There the grey is
 * almost neutral, with a faint violet cast, and across the skull its median
 * luminance is 0.948 of the orange print's.
 *
 * Each shot exists in orange and olive, pixel for pixel the same scene: 95-100%
 * of the olive print lands on orange print in its twin. So each grey takes:
 *
 * - its shape from the olive twin. Olive is the one colour in these scenes
 *   nothing else shares - the print sits at hue 50-80°, the walls, gloves, keys
 *   and orange spill at 0-30°, the concrete at 210-230° - so a hue window
 *   finds the skull with no mask to draw by hand.
 * - its tones from the orange twin: the olive print's luminance is remapped,
 *   quantile for quantile, onto the orange print's, times 0.948. The olive
 *   keeps every layer line and flame edge; the orange - the colour the scene
 *   was made in, and the one the lineup measures against - sets how bright the
 *   grey is under that scene's light.
 * - its colour from the catalogue swatch, in linear light, keeping part of how
 *   far each pixel strays from the olive print's own median colour in that
 *   shot - the light and shade across the skull. Not from the olive swatch:
 *   each generated scene printed its olive a little off it, and measured
 *   against the swatch that offset came through as a khaki or lavender cast.
 *
 * The files are named -ghost-grey, not -ghost: the near-white set went out
 * under the old names with a week of browser cache, and a new name is the
 * only thing that reaches a visitor who has already seen it.
 *
 * Pass --mask to also write each shot's mask beside it, for checking the hue
 * window against a new set.
 */
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
// fileURLToPath, not pathname: the URL form percent-encodes spaces in the path.
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
const WRITE_MASK = process.argv.includes("--mask")

/** Each grey, and the olive and orange twins it is made from. */
const SHOTS = [
  { olive: "colourway-olive.jpg", blaze: "product-front.jpg", out: "colourway-ghost-grey.jpg" },
  { olive: "mount-side-olive.jpg", blaze: "mount-side.jpg", out: "mount-side-ghost-grey.jpg" },
  {
    olive: "lifestyle-concrete-olive.jpg",
    blaze: "lifestyle-concrete.jpg",
    out: "lifestyle-concrete-ghost-grey.jpg",
  },
  {
    olive: "lifestyle-gloves-olive.jpg",
    blaze: "lifestyle-gloves.jpg",
    out: "lifestyle-gloves-ghost-grey.jpg",
  },
  {
    olive: "detail-flame-olive.jpg",
    blaze: "detail-flame.jpg",
    out: "detail-flame-ghost-grey.jpg",
  },
]

/** Grey print over orange print, median luminance, in colourway-lineup.jpg. */
const GREY_OVER_BLAZE = 0.948

/** Read off the catalogue, so a new swatch is one edit and a re-run. */
const catalogue = fs.readFileSync(path.join(ROOT, "features/catalog/catalog.ts"), "utf8")
const swatch = (id) => {
  const found = catalogue.match(new RegExp(`id: "${id}",[\\s\\S]*?hex: "(#[0-9A-Fa-f]{6})"`))
  if (!found) throw new Error(`No swatch for ${id} in catalog.ts`)
  return found[1]
}
const TO = swatch("ghost")

/** Hue window, in degrees: whole between the inner pair, gone past the outer. */
const HUE = [35, 45, 95, 110]
/** Chroma (0-255) over which a pixel goes from set to print; below it is grey anyway. */
const CHROMA = [6, 18]
/**
 * How much of a pixel's departure from the print's median colour carries into
 * the grey: the warm key against the cooler shadow side. All of it would tint
 * the grey as strongly as it tints the olive; none of it flattens the skull to
 * one colour under two lights.
 */
const KEEP = 0.5
/** Below this luminance the ratio behind KEEP is noise, so it fades out. */
const DARK = [0.004, 0.02]
/** Quantiles in the tone map. The print runs to a million pixels; this is plenty. */
const STEPS = 256

const smoothstep = (lo, hi, v) => {
  const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo)))
  return t * t * (3 - 2 * t)
}
const toLinear = (v) => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const toSrgb = (c) => {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055
  return Math.round(Math.min(1, Math.max(0, v)) * 255)
}
const LINEAR = Float64Array.from({ length: 256 }, (_, v) => toLinear(v))
const luminance = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b
const hexLinear = (hex) => {
  const v = parseInt(hex.slice(1), 16)
  return [LINEAR[(v >> 16) & 255], LINEAR[(v >> 8) & 255], LINEAR[v & 255]]
}
const hue = (r, g, b) => {
  const mx = Math.max(r, g, b)
  const d = mx - Math.min(r, g, b)
  if (d === 0) return 0
  let h
  if (mx === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (mx === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return h * 60
}
/** How much of a pixel is olive print, 0..1. */
const printWeight = (r, g, b) => {
  const h = hue(r, g, b)
  return (
    smoothstep(CHROMA[0], CHROMA[1], Math.max(r, g, b) - Math.min(r, g, b)) *
    smoothstep(HUE[0], HUE[1], h) *
    (1 - smoothstep(HUE[2], HUE[3], h))
  )
}
/** Orange print in the twin: saturated, and red to amber. */
const isBlaze = (r, g, b) => {
  const h = hue(r, g, b)
  return Math.max(r, g, b) - Math.min(r, g, b) > 40 && (h < 40 || h > 340)
}
const quantiles = (values) => {
  values.sort((a, b) => a - b)
  return Float64Array.from(
    { length: STEPS + 1 },
    (_, i) => values[Math.min(values.length - 1, Math.floor((i / STEPS) * values.length))],
  )
}

const to = hexLinear(TO)
/** The swatch's colour with its brightness taken out: luminance per unit, channel by channel. */
const toTint = to.map((c) => c / luminance(...to))

console.log(`-> ${TO}  x${GREY_OVER_BLAZE} of blaze  keep ${KEEP}`)

for (const shot of SHOTS) {
  const olive = await sharp(path.join(DIR, shot.olive)).raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H, channels: C } = olive.info
  const data = olive.data
  const twin = await sharp(path.join(DIR, shot.blaze))
    .resize(W, H, { fit: "cover" })
    .removeAlpha()
    .raw()
    .toBuffer()

  // The two prints' luminance, over the pixels that are print in both, and
  // the olive print's median colour with its brightness taken out.
  const oliveY = []
  const blazeY = []
  const oliveTint = [[], [], []]
  for (let p = 0, t = 0; p < data.length; p += C, t += 3) {
    if (printWeight(data[p], data[p + 1], data[p + 2]) < 0.5) continue
    if (!isBlaze(twin[t], twin[t + 1], twin[t + 2])) continue
    const lin = [LINEAR[data[p]], LINEAR[data[p + 1]], LINEAR[data[p + 2]]]
    const y = luminance(...lin)
    oliveY.push(y)
    blazeY.push(luminance(LINEAR[twin[t]], LINEAR[twin[t + 1]], LINEAR[twin[t + 2]]))
    for (let c = 0; c < 3; c++) oliveTint[c].push(lin[c] / y)
  }
  const fromTint = oliveTint.map((values) => quantiles(values)[STEPS >> 1])
  const oq = quantiles(oliveY)
  const bq = quantiles(blazeY).map((y) => y * GREY_OVER_BLAZE)
  /** The olive print's luminance, carried to where the grey print's sits. */
  const tone = (y) => {
    if (y <= oq[0]) return oq[0] > 0 ? (y / oq[0]) * bq[0] : bq[0]
    if (y >= oq[STEPS])
      return bq[STEPS] + ((y - oq[STEPS]) * (1 - bq[STEPS])) / (1 - oq[STEPS] || 1)
    let lo = 0
    let hi = STEPS
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (oq[mid] <= y) lo = mid
      else hi = mid
    }
    const span = oq[hi] - oq[lo]
    return bq[lo] + (span > 0 ? ((y - oq[lo]) / span) * (bq[hi] - bq[lo]) : 0)
  }

  const rgb = Buffer.alloc(W * H * 3)
  const mask = WRITE_MASK ? Buffer.alloc(W * H) : null

  for (let p = 0, q = 0, k = 0; p < data.length; p += C, q += 3, k++) {
    const r8 = data[p]
    const g8 = data[p + 1]
    const b8 = data[p + 2]
    const m = printWeight(r8, g8, b8)
    if (mask) mask[k] = Math.round(m * 255)

    if (m === 0) {
      rgb[q] = r8
      rgb[q + 1] = g8
      rgb[q + 2] = b8
      continue
    }

    const lin = [LINEAR[r8], LINEAR[g8], LINEAR[b8]]
    const y = luminance(...lin)
    const keep = KEEP * smoothstep(DARK[0], DARK[1], y)
    // The grey's colour, bent by how far this pixel strays from the olive
    // print's median colour, then brought back to unit luminance.
    const tint = toTint.map((t, c) => t * (y > 0 ? lin[c] / y / fromTint[c] : 1) ** keep)
    const norm = luminance(...tint)
    const outY = Math.min(1, tone(y))
    let o = tint.map((t) => (outY * t) / norm)
    // A highlight too bright for its colour gives up colour, not brightness.
    const peak = Math.max(...o)
    if (peak > 1 && outY < 1) o = o.map((c) => outY + ((c - outY) * (1 - outY)) / (peak - outY))

    for (let c = 0; c < 3; c++) {
      const v = toSrgb(o[c])
      const was = data[p + c]
      rgb[q + c] = Math.round(was + (v - was) * m)
    }
  }

  // Match the olive original's encoding, so the three finishes crop, weigh
  // and sharpen alike (see build-colourway-shots.mjs).
  const out = path.join(DIR, shot.out)
  await sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
    .jpeg({ quality: 82, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toFile(out)
  if (mask) {
    await sharp(mask, { raw: { width: W, height: H, channels: 1 } })
      .png()
      .toFile(out.replace(/\.jpg$/, ".mask.png"))
  }

  const kb = (fs.statSync(out).size / 1024).toFixed(0)
  const share = ((oliveY.length / (W * H)) * 100).toFixed(1)
  const median = (qs) => qs[STEPS >> 1].toFixed(3)
  console.log(
    `  ${shot.out.padEnd(34)} ${W}x${H}  ${kb} KB  print ${share}%  ` +
      `median Y olive ${median(oq)} -> ${median(bq)}`,
  )
}
