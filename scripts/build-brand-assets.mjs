/**
 * Builds public/brand/* from the delivered brand sheets.
 *
 *   node scripts/build-brand-assets.mjs [path-to-brand-folder]
 *
 * The sheets are drawn for white paper: the wordmark is near-black, which sits
 * at roughly 1.1:1 against --color-void and disappears. Two of them also carry
 * a colour swatch strip along the bottom. So each one is cropped above the
 * strip, trimmed to the artwork, and has its dark ink repainted as bone - the
 * standard reversed variant. The orange is left exactly as delivered, so the
 * logo keeps the brand hue rather than the site token (they differ slightly:
 * #F15D22 against --color-blaze #FF5A1F).
 *
 * Hand-rolled PNG codec because the project has no image dependency and this
 * runs once per brand drop, not per build.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { deflateSync, inflateSync } from "node:zlib"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const SRC = process.argv[2] ?? "D:/DN/DN_WEB/SKELMET/FILES_SKELMET/logo"
const OUT = resolve(ROOT, "public/brand")

const ORANGE = [241, 93, 34]
const INK = [35, 31, 32]
const INK_ALT = [17, 18, 18]
const BONE = [247, 244, 237] // --color-bone

// ---------- decode ----------
function decode(file) {
  const b = readFileSync(file)
  const w = b.readUInt32BE(16)
  const h = b.readUInt32BE(20)
  if (b[24] !== 8 || b[25] !== 6 || b[28] !== 0)
    throw new Error(`${file}: expected 8-bit RGBA, non-interlaced`)

  let off = 8
  const idat = []
  while (off < b.length - 8) {
    const len = b.readUInt32BE(off)
    const type = b.toString("ascii", off + 4, off + 8)
    if (type === "IDAT") idat.push(b.subarray(off + 8, off + 8 + len))
    if (type === "IEND") break
    off += 12 + len
  }

  const raw = inflateSync(Buffer.concat(idat))
  const bpp = 4
  const stride = w * bpp
  const px = Buffer.alloc(h * stride)
  let p = 0
  for (let y = 0; y < h; y++) {
    const ft = raw[p++]
    const line = raw.subarray(p, p + stride)
    p += stride
    const cur = px.subarray(y * stride, (y + 1) * stride)
    const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride)
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0
      const bb = prev[x]
      const c = x >= bpp ? prev[x - bpp] : 0
      let v = line[x]
      if (ft === 1) v += a
      else if (ft === 2) v += bb
      else if (ft === 3) v += (a + bb) >> 1
      else if (ft === 4) {
        const pp = a + bb - c
        const pa = Math.abs(pp - a)
        const pb = Math.abs(pp - bb)
        const pc = Math.abs(pp - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? bb : c
      }
      cur[x] = v & 0xff
    }
  }
  return { w, h, px }
}

// ---------- encode ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()

function crc32(buf) {
  let c = -1
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, "ascii"), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encode({ w, h, px }) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const stride = w * 4
  // Filter 0 on every scanline: the artwork is flat colour, so deflate gets
  // all the win it needs from run-length repetition alone.
  const rows = Buffer.alloc(h * (stride + 1))
  for (let y = 0; y < h; y++) {
    rows[y * (stride + 1)] = 0
    px.copy(rows, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

// ---------- operations ----------
const rowCoverage = (img, y) => {
  let hit = 0
  for (let x = 0; x < img.w; x++) if (img.px[(y * img.w + x) * 4 + 3] !== 0) hit++
  return hit / img.w
}

/**
 * Where to cut the swatch strip off a brand sheet.
 *
 * Finding the strip itself is easy - it is the run of rows at the bottom that
 * is opaque edge to edge. Cutting there is not enough: its antialiased top
 * edge survives as a hairline, and being full width it then dictates the
 * bounding box. So keep walking up to the fully transparent gap that separates
 * the strip from the artwork, and cut there instead.
 */
function stripTop(img) {
  const { h } = img
  let top = h
  for (let y = h - 1; y >= 0; y--) {
    let opaque = 0
    for (let x = 0; x < img.w; x++) if (img.px[(y * img.w + x) * 4 + 3] > 250) opaque++
    if (opaque / img.w > 0.97) top = y
    else if (top < h) break
  }
  if (top === h) return h
  while (top > 0 && rowCoverage(img, top - 1) > 0) top--
  return top
}

/** Tight bounding box of anything not fully transparent. */
function alphaBox(img, maxY) {
  const { w, px } = img
  let x0 = w
  let y0 = maxY
  let x1 = -1
  let y1 = -1
  for (let y = 0; y < maxY; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] === 0) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  return { x0, y0, x1, y1 }
}

function crop(img, { x0, y0, x1, y1 }) {
  const w = x1 - x0 + 1
  const h = y1 - y0 + 1
  const px = Buffer.alloc(w * h * 4)
  for (let y = 0; y < h; y++) {
    img.px.copy(px, y * w * 4, ((y + y0) * img.w + x0) * 4, ((y + y0) * img.w + x1 + 1) * 4)
  }
  return { w, h, px }
}

const dist = (px, i, c) => (px[i] - c[0]) ** 2 + (px[i + 1] - c[1]) ** 2 + (px[i + 2] - c[2]) ** 2

/**
 * Repaint the dark ink as bone. Alpha is straight, not premultiplied, so
 * antialiased edge pixels carry the full ink RGB at a partial alpha -
 * swapping RGB and leaving alpha alone keeps every edge clean.
 */
function reverse(img) {
  const px = Buffer.from(img.px)
  let repainted = 0
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue
    const toInk = Math.min(dist(px, i, INK), dist(px, i, INK_ALT))
    if (toInk < dist(px, i, ORANGE)) {
      px[i] = BONE[0]
      px[i + 1] = BONE[1]
      px[i + 2] = BONE[2]
      repainted++
    }
  }
  return { img: { ...img, px }, repainted }
}

// ---------- run ----------
mkdirSync(OUT, { recursive: true })

for (const [srcName, outName] of [
  ["Skelmet - Branding (4).png", "skelmet-lockup.png"],
  ["Skelmet - Branding (3).png", "skelmet-mark.png"],
  // Single-colour, for laying over a solid brand panel where the two-tone
  // lockup would lose its orange skull into the background.
  ["Skelmet - Branding (2).png", "skelmet-lockup-mono.png"],
]) {
  const img = decode(resolve(SRC, srcName))
  const cut = stripTop(img)
  const box = alphaBox(img, cut)
  const cropped = crop(img, box)
  const { img: reversed, repainted } = reverse(cropped)
  const out = encode(reversed)
  writeFileSync(`${OUT}/${outName}`, out)
  console.log(
    `${srcName} -> ${outName}\n` +
      `  source ${img.w}x${img.h}, swatch strip from y=${cut === img.h ? "none" : cut}\n` +
      `  trimmed to ${cropped.w}x${cropped.h}, repainted ${repainted} px as bone\n` +
      `  ${(out.length / 1024).toFixed(1)} KB`,
  )
}
