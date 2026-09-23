/**
 * Builds the skull-less plates the flying hero skull lands on, and the dock
 * table that says where each photo's skull sits.
 *
 *   node scripts/build-skull-plates.mjs
 *
 * On scroll, the 3D skull leaves the hero and docks onto the skull in a
 * photograph, sized and placed to cover it. Covering is not enough on its own:
 * the mesh follows the cursor and can be spun, and the moment it turns, the
 * photographed skull shows round its edges and there are two of them. So each
 * docking photo gets a plate — the same photo with the skull taken out — laid
 * over it and faded in as the mesh arrives. The mesh then reads as landing on
 * the empty bracket rather than doubling up on a picture of itself.
 *
 * Keying is chroma, as in build-hero-poster.mjs: the print is the only
 * saturated thing in either shot. The backdrop, the black bracket, the steel
 * screws, the grey anchors and the paper template all sit near chroma 0, so
 * they stay in the plate untouched.
 *
 * The hole is filled row by row from the backdrop either side of it (see
 * fillRows for why rows), then given the backdrop's own grain, measured from a
 * ring round the hole, so it does not read as a polished patch when the mesh
 * turns away from it.
 *
 * Output is a full-size webp that is transparent everywhere except the patch,
 * so the plate lines up with the photo under the same `object-cover` and costs
 * a few KB rather than a second copy of the photograph. Outside the hole the
 * patch is the photo's own pixels, so its feathered edge has nothing to show.
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

/**
 * The photos with a skull to dock on. `spill` is for a shot where the print
 * throws its colour onto the set: the lineup's orange skull glows on the dark
 * backdrop and the glossy floor, too faintly to key but plainly orange once
 * the skull is gone. See growSpill.
 */
const SOURCES = [
  { src: "/product/product-front.jpg" },
  { src: "/product/mount-assembled.jpg", spill: { key: 10, reach: 160 } },
  { src: "/product/colourway-lineup.jpg", spill: { key: 10, reach: 160 } },
]
const DOCKS = path.join(ROOT, "components/marketing/skull-docks.json")

/**
 * Chroma at which a pixel counts as print. The midpoint of the soft edge the
 * hero poster keys with (24-56), so the box found here is the one the poster
 * was trimmed to.
 */
const KEY = 40
/** Grows the hole past the key, to take the antialiased rim and the orange spill with it. */
const GROW = 7
/** Width of the plate's feathered edge beyond the hole, in source pixels. */
const FEATHER = 16
/** Luminance gap across a row of the hole past which one side is an object, not set. */
const CONTRAST = 18

/** Separable square max filter: a dilation by `r` in every direction. */
function dilate(mask, W, H, r) {
  const tmp = new Uint8Array(W * H)
  const out = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) {
    const row = y * W
    for (let x = 0; x < W; x++) {
      let v = 0
      for (let k = Math.max(0, x - r); k <= Math.min(W - 1, x + r) && !v; k++) v = mask[row + k]
      tmp[row + x] = v
    }
  }
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      let v = 0
      for (let k = Math.max(0, y - r); k <= Math.min(H - 1, y + r) && !v; k++) v = tmp[k * W + x]
      out[y * W + x] = v
    }
  }
  return out
}

/** Three passes of a separable box blur: close enough to a gaussian. */
function blur(src, W, H, r) {
  let a = Float32Array.from(src)
  let b = new Float32Array(W * H)
  const n = 2 * r + 1
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < H; y++) {
      const row = y * W
      let sum = 0
      for (let k = -r; k <= r; k++) sum += a[row + Math.min(W - 1, Math.max(0, k))]
      for (let x = 0; x < W; x++) {
        b[row + x] = sum / n
        sum += a[row + Math.min(W - 1, x + r + 1)] - a[row + Math.max(0, x - r)]
      }
    }
    ;[a, b] = [b, a]
    for (let x = 0; x < W; x++) {
      let sum = 0
      for (let k = -r; k <= r; k++) sum += a[Math.min(H - 1, Math.max(0, k)) * W + x]
      for (let y = 0; y < H; y++) {
        b[y * W + x] = sum / n
        sum += a[Math.min(H - 1, y + r + 1) * W + x] - a[Math.max(0, y - r) * W + x]
      }
    }
    ;[a, b] = [b, a]
  }
  return a
}

/**
 * The largest 4-connected blob in the mask. Drops the odd saturated speck in
 * the backdrop grain, which would otherwise stretch the skull's box — the
 * flatlay has one a hundred pixels right of the cranium.
 */
function largestBlob(mask, W, H) {
  const label = new Int32Array(W * H)
  const stack = new Int32Array(W * H)
  let best = 0
  let bestSize = 0
  let next = 0
  for (let i = 0; i < W * H; i++) {
    if (!mask[i] || label[i]) continue
    next += 1
    let top = 0
    let size = 0
    stack[top++] = i
    label[i] = next
    while (top) {
      const p = stack[--top]
      size += 1
      const x = p % W
      const neighbours = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]
      for (const q of neighbours) {
        if (q < 0 || q >= W * H || !mask[q] || label[q]) continue
        label[q] = next
        stack[top++] = q
      }
    }
    if (size > bestSize) {
      bestSize = size
      best = next
    }
  }
  const out = new Uint8Array(W * H)
  for (let i = 0; i < W * H; i++) out[i] = label[i] === best ? 1 : 0
  return out
}

/**
 * Grows the skull out into the colour it spills onto its surroundings, so
 * the hole takes the glow with it and the fill is sampled from clean set.
 *
 * Only warm pixels count — red clearly ahead of green — which is what keeps
 * it out of the olive print beside the orange one, whose red and green run
 * level. It is also held within `reach` of the skull, so a faint glow cannot
 * creep across the whole backdrop through the grain.
 */
function growSpill(skull, rgb, chroma, W, H, { key, reach }) {
  const within = dilate(skull, W, H, reach)
  const out = Uint8Array.from(skull)
  const stack = new Int32Array(W * H)
  let top = 0
  for (let i = 0; i < W * H; i++) if (skull[i]) stack[top++] = i
  const warm = (i) =>
    chroma[i] >= key && rgb[i * 3] > rgb[i * 3 + 1] * 1.15 && rgb[i * 3 + 1] >= rgb[i * 3 + 2]
  while (top) {
    const p = stack[--top]
    const x = p % W
    const neighbours = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]
    for (const q of neighbours) {
      if (q < 0 || q >= W * H || out[q] || !within[q] || !warm(q)) continue
      out[q] = 1
      stack[top++] = q
    }
  }
  return out
}

/**
 * Where the skull stands on a glossy floor, if it does. The lineup is shot on
 * one, and the floor mirrors the print: the reflection keys as print too,
 * joined to the chin at the contact line, and would drag the skull's box down
 * to the bottom of the frame.
 *
 * The contact line is the narrowest row in the blob's lower third, provided
 * everything below it is markedly less saturated than everything above — a
 * reflection is a dimmed copy, so it runs at under half the chroma of the
 * print. Returns that row, or `y1` when there is no floor. The plate still
 * takes the reflection out with the skull; only the dock box stops here.
 */
function floorLine(skull, chroma, W, y0, y1) {
  const width = []
  const sat = []
  for (let y = y0; y <= y1; y++) {
    let n = 0
    let c = 0
    for (let x = 0; x < W; x++) {
      if (!skull[y * W + x]) continue
      n += 1
      c += chroma[y * W + x]
    }
    width.push(n)
    sat.push(c)
  }
  const from = Math.floor(((y1 - y0) * 2) / 3)
  let waist = from
  for (let k = from; k < width.length; k++) if (width[k] < width[waist]) waist = k
  if (waist >= width.length - 1) return y1

  const mean = (a, b) => {
    let n = 0
    let c = 0
    for (let k = a; k < b; k++) {
      n += width[k]
      c += sat[k]
    }
    return n ? c / n : 0
  }
  const above = mean(0, waist)
  const below = mean(waist + 1, width.length)
  return below < above * 0.6 ? y0 + waist : y1
}

/**
 * Row fill: each row of the hole is a straight blend from the backdrop just
 * left of it to the backdrop just right of it, then the rows are smoothed into
 * each other so edge noise cannot streak.
 *
 * Rows, because both backdrops are banded horizontally — a studio sweep with
 * its lit horizon, and a flat surface under a soft top light. A fill that also
 * reaches up and down (a pyramid or a harmonic fill) drags the bright horizon
 * band into the dark wall above it and leaves a grey column where the skull
 * was; a row fill keeps every band where it is, and carries the bracket plate
 * straight across behind the jaw.
 */
function fillRows(rgb, hole, W, H) {
  const out = Float32Array.from(rgb)
  /** Known pixels averaged either side of a span, to steady the endpoints. */
  const SAMPLE = 6
  const mean = (y, from, to) => {
    const acc = [0, 0, 0]
    let n = 0
    for (let x = Math.max(0, from); x <= Math.min(W - 1, to); x++) {
      const i = y * W + x
      if (hole[i]) continue
      acc[0] += rgb[i * 3]
      acc[1] += rgb[i * 3 + 1]
      acc[2] += rgb[i * 3 + 2]
      n += 1
    }
    return n ? acc.map((v) => v / n) : null
  }

  for (let y = 0; y < H; y++) {
    let x = 0
    while (x < W) {
      if (!hole[y * W + x]) {
        x += 1
        continue
      }
      const start = x
      while (x < W && hole[y * W + x]) x += 1
      const end = x - 1
      const left = mean(y, start - SAMPLE, start - 1)
      const right = mean(y, end + 1, end + SAMPLE)
      let l = left ?? right
      let r = right ?? left
      if (!l || !r) continue
      // A span with backdrop on one side and something lit on the other —
      // the mount's arm running up into the skull — is backdrop: whatever the
      // skull hid of that object is gone. Blending the two smears a bright
      // bar across the hole, so the darker side fills it alone.
      const lumL = 0.299 * l[0] + 0.587 * l[1] + 0.114 * l[2]
      const lumR = 0.299 * r[0] + 0.587 * r[1] + 0.114 * r[2]
      if (Math.abs(lumL - lumR) > CONTRAST) {
        if (lumL < lumR) r = l
        else l = r
      }
      for (let k = start; k <= end; k++) {
        const t = (k - start + 1) / (end - start + 2)
        const i = y * W + k
        for (let ch = 0; ch < 3; ch++) out[i * 3 + ch] = l[ch] * (1 - t) + r[ch] * t
      }
    }
  }

  // Vertical smoothing inside the hole only; known pixels are never touched.
  const R = 5
  const smooth = Float32Array.from(out)
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < H; y++) {
      const i = y * W + x
      if (!hole[i]) continue
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      for (let k = Math.max(0, y - R); k <= Math.min(H - 1, y + R); k++) {
        const j = k * W + x
        r += out[j * 3]
        g += out[j * 3 + 1]
        b += out[j * 3 + 2]
        n += 1
      }
      smooth[i * 3] = r / n
      smooth[i * 3 + 1] = g / n
      smooth[i * 3 + 2] = b / n
    }
  }
  return smooth
}

/** Deterministic noise, so a rebuild produces the same file. */
function gaussian(seed) {
  let s = seed >>> 0
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand())
}

const docks = {}

for (const { src, spill } of SOURCES) {
  const file = path.join(ROOT, "public", src)
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true })
  const { width: W, height: H, channels: C } = info

  const rgb = new Float32Array(W * H * 3)
  const chroma = new Uint8Array(W * H)
  const print = new Uint8Array(W * H)
  for (let i = 0, p = 0; i < W * H; i++, p += C) {
    const r = data[p]
    const g = data[p + 1]
    const b = data[p + 2]
    rgb[i * 3] = r
    rgb[i * 3 + 1] = g
    rgb[i * 3 + 2] = b
    chroma[i] = Math.max(r, g, b) - Math.min(r, g, b)
    print[i] = chroma[i] >= KEY ? 1 : 0
  }

  const skull = largestBlob(print, W, H)
  let x0 = W
  let y0 = H
  let x1 = -1
  let y1 = -1
  for (let i = 0; i < W * H; i++) {
    if (!skull[i]) continue
    const x = i % W
    const y = (i / W) | 0
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }

  // The box ends at the floor; the skull's width is taken above it only, so
  // a reflection spreading wider than the chin cannot widen it either.
  const floor = floorLine(skull, chroma, W, y0, y1)
  const cut = floor < y1
  if (cut) {
    y1 = floor
    x0 = W
    x1 = -1
    for (let y = y0; y <= y1; y++) {
      for (let x = 0; x < W; x++) {
        if (!skull[y * W + x]) continue
        if (x < x0) x0 = x
        if (x > x1) x1 = x
      }
    }
  }

  const hole = dilate(spill ? growSpill(skull, rgb, chroma, W, H, spill) : skull, W, H, GROW)
  const filled = fillRows(rgb, hole, W, H)

  // Grain: the high-pass of the backdrop in a ring just outside the hole.
  const ring = dilate(hole, W, H, 40)
  const lum = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) {
    lum[i] = 0.299 * rgb[i * 3] + 0.587 * rgb[i * 3 + 1] + 0.114 * rgb[i * 3 + 2]
  }
  const smooth = blur(lum, W, H, 3)
  let sum = 0
  let count = 0
  for (let i = 0; i < W * H; i++) {
    if (!ring[i] || hole[i]) continue
    const d = lum[i] - smooth[i]
    sum += d * d
    count += 1
  }
  const grain = Math.sqrt(sum / Math.max(1, count))
  const noise = gaussian(W * 31 + H)

  // Opaque over the hole, feathering out over the photo's own pixels.
  const edge = blur(dilate(hole, W, H, FEATHER / 2), W, H, FEATHER / 4)

  const out = Buffer.alloc(W * H * 4)
  for (let i = 0; i < W * H; i++) {
    const a = Math.min(1, edge[i] * 1.6)
    if (a <= 0.002) continue
    const n = hole[i] ? noise() * grain : 0
    for (let ch = 0; ch < 3; ch++) {
      out[i * 4 + ch] = Math.max(0, Math.min(255, Math.round(filled[i * 3 + ch] + n)))
    }
    out[i * 4 + 3] = Math.round(a * 255)
  }

  const plate = src.replace(/\.jpg$/, "-plate.webp")
  const bytes = await sharp(out, { raw: { width: W, height: H, channels: 4 } })
    .webp({ quality: 88, alphaQuality: 90, effort: 6 })
    .toBuffer()
  fs.writeFileSync(path.join(ROOT, "public", plate), bytes)

  docks[src] = { plate, width: W, height: H, skull: [x0, y0, x1 + 1, y1 + 1] }

  console.log(`${src}  ${W}x${H}`)
  console.log(`  skull    ${x0},${y0} → ${x1 + 1},${y1 + 1}  (${x1 - x0 + 1}x${y1 - y0 + 1})`)
  if (cut) console.log(`  floor    reflection cut at row ${floor}`)
  console.log(`  grain    σ ${grain.toFixed(2)}`)
  console.log(`  written  public${plate}  ${(bytes.length / 1024).toFixed(1)} KB`)
}

// Number arrays on one line, as Prettier writes them, so a rebuild stays clean.
const json = JSON.stringify(docks, null, 2).replace(
  /\[\s+([\d,\s]+?)\s+\]/g,
  (_, list) => `[${list.split(/,\s*/).join(", ")}]`,
)
fs.writeFileSync(DOCKS, json + "\n")
console.log(`written  ${path.relative(ROOT, DOCKS)}`)
