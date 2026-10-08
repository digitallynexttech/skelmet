/**
 * Builds the Piston Skull's card pictures (piston-card*.jpg): its front shot with
 * the skull's colour matched, colourway by colourway, to the Flame Skull's front
 * pictures (colourway-*-print.jpg), so the same filament reads the same on both.
 *
 *   node scripts/build-piston-cards.mjs
 *
 * Turned upright and cropped square so the skull fills the height as the Flame
 * Skull's does.
 *
 * Matched in CIE LCh over each skull: lightness by mean and spread, chroma by
 * scale, hue by turn. Only the skull moves: the weight fades with the source's
 * own chroma, so the black bracket and the grey backdrop keep theirs.
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
const SOURCE = "piston-front.jpg"
const FINISHES = [
  { target: "colourway-blaze-print.jpg", out: "piston-card.jpg" },
  { target: "colourway-olive-print.jpg", out: "piston-card-olive.jpg" },
  { target: "colourway-ghost-grey-print.jpg", out: "piston-card-ghost-grey.jpg" },
]
/** The Flame's orange picture: its print is where the other two are, so it marks all three. */
const FLAME_MASK = "colourway-blaze-print.jpg"

// -- sRGB <-> CIE Lab (D65).
const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
const gam = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)
const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 / 116) * t + 16 / 116)
const fi = (t) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27))
const W = [0.95047, 1, 1.08883]

function toLab(r, g, b) {
  const R = lin(r / 255),
    G = lin(g / 255),
    B = lin(b / 255)
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / W[0])
  const y = f(0.2126 * R + 0.7152 * G + 0.0722 * B)
  const z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / W[2])
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}

function toRgb(L, a, b) {
  const y = (L + 16) / 116
  const X = fi(y + a / 500) * W[0],
    Y = fi(y),
    Z = fi(y - b / 200) * W[2]
  const R = 3.2406 * X - 1.5372 * Y - 0.4986 * Z
  const G = -0.9689 * X + 1.8758 * Y + 0.0415 * Z
  const B = 0.0557 * X - 0.204 * Y + 1.057 * Z
  return [R, G, B].map((v) => Math.round(255 * Math.min(1, Math.max(0, gam(Math.max(0, v))))))
}

const raw = (file) =>
  sharp(path.join(DIR, file)).removeAlpha().raw().toBuffer({ resolveWithObject: true })

/** Deeply saturated orange, the print in shadow and light alike; not lit wood or skin. */
function printMask({ data, info }) {
  const mask = new Uint8Array(info.width * info.height)
  for (let p = 0; p < mask.length; p++) {
    const r = data[p * 3],
      g = data[p * 3 + 1],
      b = data[p * 3 + 2]
    const lo = Math.min(g, b)
    const h = r > Math.max(g, b) ? (60 * (g - b)) / (r - lo || 1) : -1
    mask[p] = r > 70 && (r - lo) / r > 0.75 && h >= 5 && h <= 45 ? 1 : 0
  }
  return mask
}

/** Lightness mean and spread, chroma mean, and mean hue (radians), over a mask. */
function stats({ data }, mask) {
  let n = 0,
    sL = 0,
    sL2 = 0,
    sC = 0,
    sa = 0,
    sb = 0
  for (let p = 0; p < mask.length; p++) {
    if (!mask[p]) continue
    const [L, a, b] = toLab(data[p * 3], data[p * 3 + 1], data[p * 3 + 2])
    n++
    sL += L
    sL2 += L * L
    sC += Math.hypot(a, b)
    sa += a
    sb += b
  }
  if (n < 1000) throw new Error(`Only ${n} pixels of print found`)
  const mL = sL / n
  return { L: mL, sdL: Math.sqrt(sL2 / n - mL * mL), C: sC / n, h: Math.atan2(sb, sa), n }
}

const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

// The shot leans 2.5° clockwise: the skull's outline mirrors best, and its long axis
// stands, turned back by that much.
const ROLL = -2.5
// Padded with its own backdrop, mirrored, so the turn never brings in a flat corner.
// The skull is found on a plain-padded copy: the mirror would echo the mohawk's tip.
const PAD = 160
const turned = async (extendWith) =>
  sharp(
    await sharp(path.join(DIR, SOURCE))
      .extend({ top: PAD, bottom: PAD, left: PAD, right: PAD, extendWith, background: "#000" })
      .png()
      .toBuffer(),
  )
    .rotate(ROLL, { background: "#000" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
const source = await turned("mirror")
const sourceMask = printMask(await turned("background"))
const from = stats(source, sourceMask)

// The skull's extent (rows and columns with real print in them), then a square
// that it fills to SKULL_SHARE of the height, the bracket below it.
const SKULL_SHARE = 0.76
const { width: SW, height: SH } = source.info
const rows = [],
  cols = []
for (let y = 0; y < SH; y++) {
  let n = 0
  for (let x = 0; x < SW; x++) n += sourceMask[y * SW + x]
  if (n >= 5) rows.push(y)
}
for (let x = 0; x < SW; x++) {
  let n = 0
  for (let y = 0; y < SH; y++) n += sourceMask[y * SW + x]
  if (n >= 5) cols.push(x)
}
const top = rows[0],
  bottom = rows.at(-1),
  cx = (cols[0] + cols.at(-1)) / 2
const side = Math.min(SW, SH, Math.round((bottom - top) / SKULL_SHARE))
const crop = {
  left: Math.round(Math.min(SW - side, Math.max(0, cx - side / 2))),
  top: Math.round(Math.min(SH - side, Math.max(0, top - side * 0.06))),
  width: side,
  height: side,
}
const flameMask = printMask(await raw(FLAME_MASK))

for (const { target, out } of FINISHES) {
  const to = stats(await raw(target), flameMask)
  const { data, info } = source
  const result = Buffer.from(data)
  for (let p = 0; p < info.width * info.height; p++) {
    const [L, a, b] = toLab(data[p * 3], data[p * 3 + 1], data[p * 3 + 2])
    const C = Math.hypot(a, b)
    // The skull's own chroma; the bracket and backdrop sit near 0.
    const weight = smooth(6, 20, C)
    if (weight === 0) continue
    const L2 = to.L + ((L - from.L) * to.sdL) / from.sdL
    const C2 = (C * to.C) / from.C
    const h2 = Math.atan2(b, a) + (to.h - from.h)
    const rgb = toRgb(L + (L2 - L) * weight, ...[Math.cos(h2), Math.sin(h2)].map((u) => u * C2))
    // Chroma blends through the weight too, so a faint edge fades to the original.
    for (let k = 0; k < 3; k++) {
      result[p * 3 + k] = Math.round(data[p * 3 + k] + (rgb[k] - data[p * 3 + k]) * weight)
    }
  }
  const file = path.join(DIR, out)
  await sharp(result, { raw: { width: info.width, height: info.height, channels: 3 } })
    .extract(crop)
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(file)
  const done = stats({ data: result }, sourceMask)
  console.log(
    `${out.padEnd(28)} L ${to.L.toFixed(0)}±${to.sdL.toFixed(0)} C ${to.C.toFixed(0)} ` +
      `(got L ${done.L.toFixed(0)}±${done.sdL.toFixed(0)} C ${done.C.toFixed(0)})  ` +
      `${side}x${side}  ${(fs.statSync(file).size / 1024).toFixed(0)} KB`,
  )
}
