/**
 * The Rider wall's four pictures of the mount in use, the owner's own, into
 * public/product/rider-*.jpg.
 *
 *   node scripts/build-rider-wall.mjs [source-dir]
 *
 * Real photographs where they can be: the rendered scenes that were here read
 * as made up. Each is cropped square for its tile, and the office shots are
 * toned a little down - a touch of contrast, five per cent less light - so a
 * white wall does not glare out of the dark page.
 *
 * Two are not straight photographs (both in rider-wall-edits/ beside them).
 * Every photograph had the same black helmet with an intercom, so IMG_0777
 * was reworked by Google's image model (Nano Banana Pro) into a cream retro
 * open-face helmet against a dark wall, in studio light. The skull there is
 * the model's redraw of the photographed one - checked against it: the same
 * flames, eye vent and teeth - because the photograph's skull, flat-lit, laid
 * back into that light came out patchy. The motorcycle wall is the owner's
 * picture as supplied. Both arrive finished, so they are cropped, not toned.
 *
 * Every skull was orange, so two are recoloured to the other colourways:
 * Militia Olive in the cream helmet, Ghost Grey on the dark door (see
 * recolourSkull).
 *
 * A changed picture needs a new file name: /product is cached for 30 days as
 * immutable.
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

const SRC_DIR = process.argv[2] ?? "D:/DN/DN_WEB/SKELMET/FILES_SKELMET/product-images"
const OUT_DIR = path.join(ROOT, "public/product")
/** Twice the widest tile (a quarter of a 1440px page), with room to spare. */
const MAX = 1400

/**
 * crop: left and top as fractions of the upright picture's width and height,
 * and the square's side as a fraction of its width.
 */
const SHOTS = [
  // IMG_0777, cropped [0, 0, 1] before the rework.
  {
    from: "rider-wall-edits/IMG_0777-cream-retro-helmet.png",
    to: "rider-cream-helmet.jpg",
    crop: [0, 0, 1],
    tone: false,
    colourway: "olive",
  },
  { from: "IMG_0788.JPG.jpeg", to: "rider-bare-skull.jpg", crop: [0.07, 0.12, 0.9] },
  {
    from: "rider-wall-edits/with-jacket-motorcycle.png",
    to: "rider-motorcycle-wall.jpg",
    crop: [0.055, 0.083, 0.755],
    tone: false,
  },
  { from: "6.jpeg", to: "rider-dark-door.jpg", crop: [0, 0.08, 1], colourway: "ghost" },
]

/**
 * The real prints, measured off colourway-lineup.jpg - the three side by side
 * under one light: each one's median luminance over the orange print's, and
 * its median colour with the brightness taken out (linear light). The olive
 * is a muted khaki there, greyer than the catalogue swatch; the grey matches
 * build-ghost-shots.mjs.
 */
const PRINTS = {
  olive: { overBlaze: 0.515, tint: [1.138, 1.001, 0.587] },
  ghost: { overBlaze: 0.948, tint: [0.991, 0.989, 1.126] },
}

const smoothstep = (lo, hi, v) => {
  const t = Math.min(1, Math.max(0, (v - lo) / (hi - lo)))
  return t * t * (3 - 2 * t)
}
const LINEAR = Float64Array.from({ length: 256 }, (_, v) => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
})
const toSrgb = (c) => {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055
  return Math.round(Math.min(1, Math.max(0, v)) * 255)
}
const luminance = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b
const hue = (r, g, b) => {
  const mx = Math.max(r, g, b)
  const d = mx - Math.min(r, g, b)
  if (d === 0) return 0
  const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return h * 60
}

/**
 * How much of a pixel is orange print, 0..1: red to amber, with almost no
 * blue, and saturated even in its grooves (about 0.9 and up) - where dark
 * brown leather sits at 0.6-0.8. Bright light washes the print towards peach,
 * so the bar drops for pixels lit that brightly; leather never gets there.
 */
const printWeight = (r, g, b) => {
  if (r < 28) return 0
  const h = hue(r, g, b)
  if (h > 42 && h < 350) return 0
  const lit = smoothstep(170, 235, r)
  const sat = (r - Math.min(g, b)) / r
  const satMin = 0.84 - 0.34 * lit
  const blueMax = 0.25 + 0.15 * lit
  const greenMax = 0.65 + 0.1 * lit
  return (
    smoothstep(25, 45, r - Math.min(g, b)) *
    smoothstep(satMin - 0.04, satMin + 0.04, sat) *
    (1 - smoothstep(blueMax - 0.05, blueMax + 0.05, b / r)) *
    (1 - smoothstep(greenMax - 0.05, greenMax + 0.05, g / r))
  )
}

/**
 * The orange skull in a picture, recoloured to another print, in place.
 *
 * Where: the largest piece of orange print, plus any piece a microphone boom
 * cuts off it (wholly within its width, below its top, orange rather than a
 * red strap tab), with the holes they enclose. Within a few pixels of that,
 * any warm pixel counts, which takes in highlights and the orange a JPEG
 * bleeds into the dark beside it.
 *
 * How: luminance times the print's share of the orange's, in the print's own
 * colour. The light and shade come through luminance alone. The orange cannot
 * lend its colour variation, as the grey script takes the olive's: it has
 * almost no blue, and dividing by that turned the shadows magenta.
 */
async function recolourSkull(rgb, size, colourway) {
  const N = size * size
  const weight = new Float32Array(N)
  for (let p = 0; p < N; p++) weight[p] = printWeight(rgb[p * 3], rgb[p * 3 + 1], rgb[p * 3 + 2])

  const neighbours = (p) => {
    const x = p % size
    const y = (p / size) | 0
    return [
      x + 1 < size ? p + 1 : -1,
      x > 0 ? p - 1 : -1,
      y + 1 < size ? p + size : -1,
      y > 0 ? p - size : -1,
    ]
  }

  // The pieces of print.
  const label = new Int32Array(N).fill(-1)
  const pieces = []
  for (let seed = 0; seed < N; seed++) {
    if (weight[seed] < 0.5 || label[seed] >= 0) continue
    const piece = { id: pieces.length, size: 0, hue: 0, box: [size, size, 0, 0] }
    const queue = [seed]
    label[seed] = piece.id
    while (queue.length) {
      const p = queue.pop()
      const x = p % size
      const y = (p / size) | 0
      const h = hue(rgb[p * 3], rgb[p * 3 + 1], rgb[p * 3 + 2])
      piece.size++
      piece.hue += h > 180 ? h - 360 : h
      piece.box = [
        Math.min(piece.box[0], x),
        Math.min(piece.box[1], y),
        Math.max(piece.box[2], x),
        Math.max(piece.box[3], y),
      ]
      for (const n of neighbours(p)) {
        if (n >= 0 && weight[n] >= 0.5 && label[n] < 0) {
          label[n] = piece.id
          queue.push(n)
        }
      }
    }
    piece.hue /= piece.size
    pieces.push(piece)
  }
  if (pieces.length === 0) throw new Error("no orange skull found")
  const main = pieces.reduce((a, b) => (b.size > a.size ? b : a))
  const [x0, y0, x1, y1] = main.box
  const slack = (x1 - x0) * 0.03
  const kept = new Set(
    pieces
      .filter(
        (p) =>
          p === main ||
          (p.size > main.size * 0.005 &&
            p.hue > 8 &&
            p.box[0] >= x0 - slack &&
            p.box[2] <= x1 + slack &&
            p.box[1] >= y0 &&
            p.box[1] <= y1 + (y1 - y0) * 0.08),
      )
      .map((p) => p.id),
  )
  const skull = new Uint8Array(N)
  for (let p = 0; p < N; p++) skull[p] = kept.has(label[p]) ? 1 : 0

  // Holes the skull encloses (deep sockets, grooves) are skull too.
  const outside = new Uint8Array(N)
  const queue = []
  for (let i = 0; i < size; i++) {
    for (const p of [i, (size - 1) * size + i, i * size, i * size + size - 1]) {
      if (!skull[p] && !outside[p]) {
        outside[p] = 1
        queue.push(p)
      }
    }
  }
  while (queue.length) {
    for (const n of neighbours(queue.pop())) {
      if (n >= 0 && !skull[n] && !outside[n]) {
        outside[n] = 1
        queue.push(n)
      }
    }
  }
  for (let p = 0; p < N; p++) if (!outside[p]) skull[p] = 1
  const near = await sharp(Buffer.from(skull.map((v) => v * 255)), {
    raw: { width: size, height: size, channels: 1 },
  })
    .blur(4)
    .extractChannel(0)
    .raw()
    .toBuffer()

  const print = PRINTS[colourway]
  const tintY = luminance(...print.tint)
  for (let p = 0; p < N; p++) {
    const r8 = rgb[p * 3]
    const g8 = rgb[p * 3 + 1]
    const b8 = rgb[p * 3 + 2]
    const h = hue(r8, g8, b8)
    const warm = (h < 48 || h > 345) && r8 > 20 ? smoothstep(8, 24, r8 - Math.min(g8, b8)) : 0
    const m = Math.max(weight[p], warm) * Math.min(1, near[p] / 96)
    if (m <= 0) continue

    const y = luminance(LINEAR[r8], LINEAR[g8], LINEAR[b8])
    const outY = Math.min(1, y * print.overBlaze)
    let o = print.tint.map((t) => (outY * t) / tintY)
    // A highlight too bright for its colour gives up colour, not brightness.
    const peak = Math.max(...o)
    if (peak > 1 && outY < 1) o = o.map((c) => outY + ((c - outY) * (1 - outY)) / (peak - outY))
    for (let c = 0; c < 3; c++) {
      const was = rgb[p * 3 + c]
      rgb[p * 3 + c] = Math.round(was + (toSrgb(o[c]) - was) * m)
    }
  }
}

for (const shot of SHOTS) {
  const src = path.join(SRC_DIR, shot.from)
  if (!fs.existsSync(src)) throw new Error(`missing source: ${src}`)

  // Upright first: phone photographs carry their orientation in EXIF.
  const { data, info } = await sharp(src).rotate().toBuffer({ resolveWithObject: true })
  const [fx, fy, fside] = shot.crop
  const side = Math.round(fside * info.width)
  const left = Math.round(fx * info.width)
  const top = Math.min(Math.round(fy * info.height), info.height - side)
  const out = Math.min(side, MAX)

  const rgb = await sharp(data)
    .extract({ left, top, width: side, height: side })
    .resize(out, out, { kernel: "lanczos3" })
    .removeAlpha()
    .raw()
    .toBuffer()
  if (shot.colourway) await recolourSkull(rgb, out, shot.colourway)

  let image = sharp(rgb, { raw: { width: out, height: out, channels: 3 } })
  if (shot.tone !== false) {
    image = image.linear(1.05, -10).modulate({ brightness: 0.95, saturation: 1.04 })
  }
  const file = path.join(OUT_DIR, shot.to)
  await image.sharpen({ sigma: 0.5 }).jpeg({ quality: 84, mozjpeg: true }).toFile(file)
  console.log(`${shot.to}  ${out}x${out}  ${(fs.statSync(file).size / 1024).toFixed(0)} KB`)
}
