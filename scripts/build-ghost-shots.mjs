/**
 * Builds the Ghost Grey gallery shots from the Militia Olive ones.
 *
 *   node scripts/build-ghost-shots.mjs
 *
 * The first ghost set came back from an image model asked for a grey print,
 * and it painted one near white: next to the real filament, a mid grey with a
 * cool cast, the gallery was selling a silver skull. These replace it by
 * recolouring the olive set, which already has every scene, framing and light
 * the gallery needs - only the filament changes.
 *
 * Olive, not blaze, because olive is the one colour in these scenes nothing
 * else shares. The print sits at hue 50-80°; the walls, the gloves, the keys
 * and the orange spill all sit at 0-30° and the concrete at 210-230°, so a hue
 * window finds the skull with no mask to draw by hand.
 *
 * The recolour is done in linear light. Each pixel keeps its luminance, scaled
 * by how much brighter the grey swatch is than the olive one, so the shading,
 * the flame relief and the layer lines all come through at full resolution.
 * Its colour becomes the grey swatch's, keeping part of how far the pixel
 * strayed from the olive swatch - the light's own colour, so a grey skull in
 * a sunset still picks up the sunset. Swatches come from the catalogue, so
 * the photographs cannot drift from the dots rendered beside them.
 *
 * Pass --mask to also write each shot's mask beside it, for checking the
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
const SHOTS = ["mount-side", "lifestyle-concrete", "lifestyle-gloves", "detail-flame"]
const WRITE_MASK = process.argv.includes("--mask")

/** Read off the catalogue, so a new swatch is one edit and a re-run. */
const catalogue = fs.readFileSync(path.join(ROOT, "features/catalog/catalog.ts"), "utf8")
const swatch = (id) => {
  const found = catalogue.match(new RegExp(`id: "${id}",[\\s\\S]*?hex: "(#[0-9A-Fa-f]{6})"`))
  if (!found) throw new Error(`No swatch for ${id} in catalog.ts`)
  return found[1]
}
const FROM = swatch("olive")
const TO = swatch("ghost")

/** Hue window, in degrees: whole between the inner pair, gone past the outer. */
const HUE = [35, 45, 95, 110]
/** Chroma (0-255) over which a pixel goes from set to print; below it is grey anyway. */
const CHROMA = [6, 18]
/**
 * How much of a pixel's departure from the olive swatch's colour carries into
 * the grey. That departure is mostly the light: warm in the sunset, cool in
 * the concrete shot. All of it would tint the grey as strongly as it tints the
 * olive; none of it pastes a flat grey into a lit scene.
 */
const KEEP = 0.4
/** Below this luminance the ratio behind KEEP is noise, so it fades out. */
const DARK = [0.004, 0.02]

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

const from = hexLinear(FROM)
const to = hexLinear(TO)
const fromY = luminance(...from)
const toY = luminance(...to)
/** Luminance per unit, channel by channel: each swatch's colour with its brightness taken out. */
const fromTint = from.map((c) => c / fromY)
const toTint = to.map((c) => c / toY)
const GAIN = toY / fromY

console.log(`${FROM} -> ${TO}  luminance x${GAIN.toFixed(3)}  keep ${KEEP}`)

for (const shot of SHOTS) {
  const src = path.join(DIR, `${shot}-olive.jpg`)
  const out = path.join(DIR, `${shot}-ghost.jpg`)
  const { data, info } = await sharp(src).raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H, channels: C } = info

  const rgb = Buffer.alloc(W * H * 3)
  const mask = WRITE_MASK ? Buffer.alloc(W * H) : null
  let print = 0

  for (let p = 0, q = 0, k = 0; p < data.length; p += C, q += 3, k++) {
    const r8 = data[p]
    const g8 = data[p + 1]
    const b8 = data[p + 2]
    const chroma = Math.max(r8, g8, b8) - Math.min(r8, g8, b8)
    const h = hue(r8, g8, b8)
    const m =
      smoothstep(CHROMA[0], CHROMA[1], chroma) *
      smoothstep(HUE[0], HUE[1], h) *
      (1 - smoothstep(HUE[2], HUE[3], h))
    if (mask) mask[k] = Math.round(m * 255)

    if (m === 0) {
      rgb[q] = r8
      rgb[q + 1] = g8
      rgb[q + 2] = b8
      continue
    }
    if (m > 0.5) print++

    const lin = [LINEAR[r8], LINEAR[g8], LINEAR[b8]]
    const y = luminance(...lin)
    const keep = KEEP * smoothstep(DARK[0], DARK[1], y)
    // The grey's colour, bent by the part of this pixel's colour the olive
    // swatch does not explain, then brought back to unit luminance.
    const tint = toTint.map((t, c) => t * (y > 0 ? lin[c] / y / fromTint[c] : 1) ** keep)
    const norm = luminance(...tint)
    const outY = y * GAIN
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
  await sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
    .jpeg({ quality: 82, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toFile(out)
  if (mask) {
    await sharp(mask, { raw: { width: W, height: H, channels: 1 } })
      .png()
      .toFile(path.join(DIR, `${shot}-ghost.mask.png`))
  }

  const kb = (fs.statSync(out).size / 1024).toFixed(0)
  const share = ((print / (W * H)) * 100).toFixed(1)
  console.log(`  ${path.basename(out).padEnd(30)} ${W}x${H}  ${kb} KB  print ${share}%`)
}
