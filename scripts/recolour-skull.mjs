/**
 * Recolours the orange skull in a picture to another colourway, in place.
 * Shared by build-rider-wall.mjs and build-why-colourways.mjs.
 *
 * Where: the largest piece of orange print, plus any piece something in
 * front cuts off it - a microphone boom - (wholly within its width, below
 * its top, orange rather than a red strap tab), with the holes they enclose.
 * Within a few pixels of that, any warm, saturated pixel counts, which takes
 * in highlights and the orange a JPEG bleeds into the dark beside it.
 *
 * How: luminance times the print's share of the orange's, in the print's own
 * colour. The light and shade come through luminance alone. The orange cannot
 * lend its colour variation, as build-ghost-shots.mjs takes the olive's: it
 * has almost no blue, and dividing by that turned the shadows magenta.
 */

/**
 * The real prints, measured off colourway-lineup.jpg - the three side by side
 * under one light: each one's median luminance over the orange print's, and
 * its median colour with the brightness taken out (linear light). The olive
 * is a muted khaki there, greyer than the catalogue swatch; the grey matches
 * build-ghost-shots.mjs.
 */
export const PRINTS = {
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
export function printWeight(r, g, b) {
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
 * A studio key light washes the print's highlights to a pale peach, too pale
 * for printWeight, which has leather and skin to keep out. A studio shot has
 * neither - only the print, a black bracket and a grey backdrop - so there any
 * bright, warm pixel is the print.
 */
function highlightWeight(r, g, b) {
  const h = hue(r, g, b)
  if (h > 48 && h < 345) return 0
  return smoothstep(120, 160, r) * smoothstep(14, 30, r - Math.min(g, b))
}

/**
 * @param sharp the sharp module (the scripts resolve it out of the pnpm store)
 * @param rgb raw 8-bit RGB, recoloured in place
 * @param colourway "olive" or "ghost"
 * @param options.studio the picture is a studio shot: count its pale highlights as print too
 */
export async function recolourSkull(sharp, rgb, width, height, colourway, options = {}) {
  const print = PRINTS[colourway]
  if (!print) throw new Error(`no print measured for ${colourway}`)
  const N = width * height
  const weight = new Float32Array(N)
  for (let p = 0; p < N; p++) {
    const r = rgb[p * 3]
    const g = rgb[p * 3 + 1]
    const b = rgb[p * 3 + 2]
    weight[p] = options.studio
      ? Math.max(printWeight(r, g, b), highlightWeight(r, g, b))
      : printWeight(r, g, b)
  }

  const neighbours = (p) => {
    const x = p % width
    const y = (p / width) | 0
    return [
      x + 1 < width ? p + 1 : -1,
      x > 0 ? p - 1 : -1,
      y + 1 < height ? p + width : -1,
      y > 0 ? p - width : -1,
    ]
  }

  // The pieces of print.
  const label = new Int32Array(N).fill(-1)
  const pieces = []
  for (let seed = 0; seed < N; seed++) {
    if (weight[seed] < 0.5 || label[seed] >= 0) continue
    const piece = { id: pieces.length, size: 0, hue: 0, box: [width, height, 0, 0] }
    const queue = [seed]
    label[seed] = piece.id
    while (queue.length) {
      const p = queue.pop()
      const x = p % width
      const y = (p / width) | 0
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
  const seedOutside = (p) => {
    if (!skull[p] && !outside[p]) {
      outside[p] = 1
      queue.push(p)
    }
  }
  for (let x = 0; x < width; x++) {
    seedOutside(x)
    seedOutside((height - 1) * width + x)
  }
  for (let y = 0; y < height; y++) {
    seedOutside(y * width)
    seedOutside(y * width + width - 1)
  }
  while (queue.length) {
    for (const n of neighbours(queue.pop())) if (n >= 0) seedOutside(n)
  }
  for (let p = 0; p < N; p++) if (!outside[p]) skull[p] = 1
  const near = await sharp(Buffer.from(skull.map((v) => v * 255)), {
    raw: { width, height, channels: 1 },
  })
    .blur(4)
    .extractChannel(0)
    .raw()
    .toBuffer()

  const tintY = luminance(...print.tint)
  for (let p = 0; p < N; p++) {
    const r8 = rgb[p * 3]
    const g8 = rgb[p * 3 + 1]
    const b8 = rgb[p * 3 + 2]
    const h = hue(r8, g8, b8)
    // Warm and saturated: a pale beige wall beside the skull is warm too, but not this.
    const chroma = r8 - Math.min(g8, b8)
    const warm =
      (h < 48 || h > 345) && r8 > 20
        ? smoothstep(8, 24, chroma) * smoothstep(0.35, 0.5, chroma / r8)
        : 0
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
