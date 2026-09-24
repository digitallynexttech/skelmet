/**
 * Builds public/product/colourway-{olive,ghost}.jpg from the front-on shot.
 *
 *   node scripts/build-colourways.mjs
 *
 * The lineup cards are a colour comparison, so the only thing that should
 * differ between them is the colour. The olive and ghost plates were shot at
 * three-quarter while the blaze one is straight on, which made the row read as
 * three different products rather than one product in three finishes - and no
 * straight-on plate exists for the other two, so the angle cannot be cropped
 * back. Both are therefore derived from the blaze plate: identical framing,
 * lighting, shadow and layer texture, with the filament colour remapped.
 *
 * Hue and saturation are applied to every pixel rather than through the mask.
 * Both are continuous as chroma approaches zero - a grey pixel is grey at any
 * hue, and a scaled zero is still zero - so the backdrop passes through
 * untouched and the antialiased rim cannot hold an orange fringe. Only the
 * lightness change, which is not continuous that way, is ramped by the mask.
 *
 * The mask is chroma, as in build-hero-poster.mjs: the backdrop sits below 20
 * and the print above 60, with 0.2% of pixels between them, so the ramp only
 * ever covers the one-pixel edge.
 *
 * Every number comes off the swatch in the catalogue and the pixels of the
 * source plate - nothing here is eyeballed, so the photographs cannot drift
 * away from the dots rendered beside them.
 *
 * These are derived plates, not photographs of real olive and grey prints.
 * Replace them with real ones when the shots exist; the card, the crop and the
 * catalogue all stay as they are.
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

const SRC = path.join(ROOT, "assets/product-gen/01-front.png")
/** Match product-front.jpg exactly, so `object-cover` crops all three alike. */
const OUT_W = 1611
const OUT_H = 2000

/** Chroma below this is backdrop, above it is print; between, the rim. */
const MASK_LO = 20
const MASK_HI = 60

/** The catalogue swatch the source plate was printed in. */
const SRC_HEX = "#FF5A1F"

/**
 * hueKeep carries a fraction of the source pixel's own hue variation into the
 * result. The orange print swings a few degrees between its lit and shadowed
 * faces; dropping that entirely flattens the modelling, while keeping all of
 * it exaggerates the swing at the new saturation. Ghost keeps less, because a
 * near-grey shows hue noise far more readily than a mid-tone does.
 *
 * tone pins the result to the tone of the plate it replaces. Swatch times
 * lighting response alone landed both a little light - olive at 0.471 against
 * the old plate's 0.437 and ghost at 0.763 against 0.688, read as the median
 * of the brighter half of a box over the cranium - because a flat swatch
 * carries no sense of how much of a lit object is turned away from the key.
 * Only the angle was meant to change here, so the colour is held where it was.
 */
const TARGETS = [
  { out: "colourway-olive.jpg", hex: "#8A9A5B", hueKeep: 0.25, tone: 0.928 },
  { out: "colourway-ghost.jpg", hex: "#C8CED6", hueKeep: 0.15, tone: 0.902 },
]

const smoothstep = (lo, hi, v) => {
  const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo)))
  return t * t * (3 - 2 * t)
}

const rgb2hsl = (r, g, b) => {
  r /= 255
  g /= 255
  b /= 255
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  const l = (mx + mn) / 2
  if (mx === mn) return [0, 0, l]
  const d = mx - mn
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn)
  let h
  if (mx === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (mx === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [h * 60, s, l]
}

const hue2rgb = (p, q, t) => {
  if (t < 0) t += 1
  if (t > 1) t -= 1
  if (t < 1 / 6) return p + (q - p) * 6 * t
  if (t < 1 / 2) return q
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
  return p
}

const hsl2rgb = (h, s, l) => {
  h = (((h % 360) + 360) % 360) / 360
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ]
}

const hexHsl = (hex) => {
  const v = parseInt(hex.slice(1), 16)
  return rgb2hsl((v >> 16) & 255, (v >> 8) & 255, v & 255)
}

/**
 * Shortest signed distance from the source hue, in degrees.
 *
 * Hue is circular and this print straddles the wrap: its deepest shadows are
 * dark reds sitting at 355-359° rather than at -5 to -1. Subtracting plainly
 * made those read as +338° from a source at 20°, which even a 0.15 hueKeep
 * turned into +51° - the difference between a blue-grey and a lilac, and the
 * reason 14.5k pixels in the eye sockets and nose came out pink.
 */
const hueDelta = (h, from) => ((h - from + 540) % 360) - 180

const base = sharp(SRC).resize(OUT_W, OUT_H, { fit: "cover" })
const { data, info } = await base.raw().toBuffer({ resolveWithObject: true })
const { width: W, height: H, channels: C } = info

// The print's own hue and lightness, read off the pixels above the mask rather
// than assumed, so everything below stays correct if the plate is re-shot.
// Lightness is trimmed at both ends: the extremes are a handful of pixels deep
// in the eye sockets and on the specular ridges, and anchoring to them would
// spend most of the output range on outliers.
const hues = []
const lights = []
for (let p = 0; p < data.length; p += C) {
  const r = data[p]
  const g = data[p + 1]
  const b = data[p + 2]
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  if (mx - mn < MASK_HI) continue
  lights.push((mx + mn) / 2 / 255)
  hues.push(rgb2hsl(r, g, b)[0])
}
lights.sort((a, b) => a - b)
const at = (q) => lights[Math.min(lights.length - 1, Math.floor(lights.length * q))]
const L_LO = at(0.01)
const L_HI = at(0.999)
const L_MED = at(0.5)

// Circular mean, for the same wrap reason as hueDelta.
const SRC_HUE =
  ((Math.atan2(
    hues.reduce((a, h) => a + Math.sin((h * Math.PI) / 180), 0),
    hues.reduce((a, h) => a + Math.cos((h * Math.PI) / 180), 0),
  ) *
    180) /
    Math.PI +
    360) %
  360

const [, srcSwatchSat, srcSwatchL] = hexHsl(SRC_HEX)

/**
 * How this lighting renders a material against its flat swatch. The plate is a
 * dark studio shot, so the print sits below its own swatch; applying the same
 * factor to the other two keeps all three under one light, rather than pasting
 * flat swatch values onto a lit object and getting a print that reads as white.
 */
const RESPONSE = L_MED / srcSwatchL

console.log(
  `source print: ${lights.length}px  hue ${SRC_HUE.toFixed(1)}°  ` +
    `lightness ${L_LO.toFixed(3)}..${L_HI.toFixed(3)} median ${L_MED.toFixed(3)}  ` +
    `response x${RESPONSE.toFixed(3)}`,
)

for (const t of TARGETS) {
  const [hue, sat, swatchL] = hexHsl(t.hex)
  const satScale = sat / srcSwatchSat
  const wantMed = swatchL * RESPONSE * t.tone

  // Down is a plain scale: it cannot clip and it leaves the modelling intact.
  // Up needs a curve, because the print's top 5% runs from 0.67 to 0.88 - a
  // tail too long to lift linearly into the headroom above a raised median
  // without flattening the highlights to paper white. So the range is
  // normalised, bent by a gamma solved to put the median on target, and
  // stretched between a floor and a ceiling. Nothing can clip, because the
  // normalised input is clamped before the exponent.
  let light
  let note
  if (wantMed <= L_MED) {
    const k = wantMed / L_MED
    light = (l) => l * k
    note = `scale x${k.toFixed(3)}`
  } else {
    const floor = L_LO + (1 - L_LO) * 0.28
    const top = 0.97
    const norm = (l) => Math.min(1, Math.max(0, (l - L_LO) / (L_HI - L_LO)))
    const gamma = Math.log((wantMed - floor) / (top - floor)) / Math.log(norm(L_MED))
    light = (l) => floor + (top - floor) * norm(l) ** gamma
    note = `curve floor ${floor.toFixed(3)} gamma ${gamma.toFixed(3)}`
  }

  const rgb = Buffer.alloc(W * H * 3)
  let clipped = 0
  let masked = 0

  for (let p = 0, q = 0; p < data.length; p += C, q += 3) {
    const r = data[p]
    const g = data[p + 1]
    const b = data[p + 2]
    const m = smoothstep(MASK_LO, MASK_HI, Math.max(r, g, b) - Math.min(r, g, b))
    if (m > 0) masked++

    const [h, s, l] = rgb2hsl(r, g, b)
    const nh = hue + hueDelta(h, SRC_HUE) * t.hueKeep
    const ns = s * satScale
    const want = light(l)
    if (want > 1 || want < 0) clipped++
    const nl = l + m * (Math.min(1, Math.max(0, want)) - l)

    const [nr, ng, nb] = hsl2rgb(nh, ns, nl)
    rgb[q] = nr
    rgb[q + 1] = ng
    rgb[q + 2] = nb
  }

  const out = path.join(ROOT, "public/product", t.out)
  await sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
    .jpeg({ quality: 84, mozjpeg: true })
    .toFile(out)

  console.log(
    `${t.out}  ${W}x${H}  ${(fs.statSync(out).size / 1024).toFixed(0)}KB  ` +
      `${t.hex} hue ${hue.toFixed(0)}° sat x${satScale.toFixed(3)}  ` +
      `median ${L_MED.toFixed(3)}->${wantMed.toFixed(3)} ${note}  ` +
      `print ${((masked / (W * H)) * 100).toFixed(1)}%  clipped ${clipped}`,
  )
}
