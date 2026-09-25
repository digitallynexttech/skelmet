/**
 * Builds the app icons from the skull mark.
 *
 *   node scripts/build-app-icons.mjs [path-to-brand-folder]
 *
 * Source is the standalone mark, `Skelmet - Branding (3).png` - orange cranium
 * over a near-black jaw, on transparency. Every ink is repainted the mark's own
 * orange on the way through, so the icon is one colour.
 *
 * A two-tone mark cannot survive a browser tab. Left as drawn, the near-black
 * jaw vanished against dark chrome and only the orange dome showed; repainted
 * white, it vanished against light chrome instead. Orange reads on both. The
 * skull still reads as a skull because its features - the eye sockets, the
 * slit through the cranium, the gaps around the teeth - are cut out of the
 * shape as transparency, not drawn in the second ink.
 *
 * Outputs, all picked up by the App Router file conventions:
 *   app/favicon.ico     16 + 32 + 48, PNG-in-ICO, transparent
 *   app/icon.png        512, transparent
 *   app/apple-icon.png  180, on void - iOS composites the icon onto its own
 *                       background and a transparent one goes black on the home
 *                       screen. Void rather than white because it is the site's
 *                       own ground, and orange holds on it.
 *
 * Hand-rolled ICO container because there is no image dependency in the project
 * beyond the one Next already ships, and this runs once per brand drop.
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
if (!sharpDir) throw new Error("sharp not found in the pnpm store - run pnpm install")
const sharp = require(path.join(store, sharpDir, "node_modules/sharp"))

const BRAND = process.argv[2] ?? "D:/DN/DN_WEB/SKELMET/FILES_SKELMET/logo"
const SOURCE = path.join(BRAND, "Skelmet - Branding (3).png")
const APP = path.join(ROOT, "app")

/** The mark's own orange, read off the source rather than the site palette. */
const ORANGE = [241, 93, 34]

/** Breathing room around the mark, as a share of the square. */
const PADDING = 0.06
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 }
/** --color-void. */
const APPLE_BACKGROUND = { r: 7, g: 6, b: 10, alpha: 1 }

/**
 * Repaint every pixel the mark's orange, keeping its alpha.
 *
 * Every pixel, not just the dark ones: where the cranium meets the jaw the
 * antialiasing blends the two inks, and recolouring only the pixels nearest
 * black would leave a brownish seam along that line. Alpha is straight, not
 * premultiplied, so the edges stay exactly as soft as they were drawn.
 */
async function allOrange() {
  const { data, info } = await sharp(SOURCE)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  for (let i = 0; i < data.length; i += 4) {
    data[i] = ORANGE[0]
    data[i + 1] = ORANGE[1]
    data[i + 2] = ORANGE[2]
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer()
}

/** Trim to the artwork, then centre it in a transparent square. */
async function square(size, artwork) {
  const trimmed = await sharp(artwork).trim().toBuffer()
  const inner = Math.round(size * (1 - PADDING * 2))
  const fitted = await sharp(trimmed)
    .resize(inner, inner, { fit: "contain", background: TRANSPARENT })
    .toBuffer()

  return sharp({
    create: { width: size, height: size, channels: 4, background: TRANSPARENT },
  })
    .composite([{ input: fitted, gravity: "centre" }])
    .png({ compressionLevel: 9 })
    .toBuffer()
}

/**
 * Wraps PNGs in an ICO container: a 6-byte header, one 16-byte directory entry
 * per image, then the payloads. A dimension byte of 0 means 256 in this format,
 * which is why it is masked rather than written straight.
 */
function ico(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // 1 = icon
  header.writeUInt16LE(images.length, 4)

  const directory = Buffer.alloc(images.length * 16)
  let offset = header.length + directory.length

  images.forEach(({ size, data }, i) => {
    const at = i * 16
    directory[at] = size & 0xff
    directory[at + 1] = size & 0xff
    directory[at + 2] = 0 // palette size
    directory[at + 3] = 0 // reserved
    directory.writeUInt16LE(1, at + 4) // colour planes
    directory.writeUInt16LE(32, at + 6) // bits per pixel
    directory.writeUInt32LE(data.length, at + 8)
    directory.writeUInt32LE(offset, at + 12)
    offset += data.length
  })

  return Buffer.concat([header, directory, ...images.map((i) => i.data)])
}

if (!fs.existsSync(SOURCE)) throw new Error(`Mark not found at ${SOURCE}`)

const artwork = await allOrange()

const rendered = await Promise.all(
  [16, 32, 48].map(async (size) => ({ size, data: await square(size, artwork) })),
)

fs.writeFileSync(path.join(APP, "favicon.ico"), ico(rendered))
fs.writeFileSync(path.join(APP, "icon.png"), await square(512, artwork))
fs.writeFileSync(
  path.join(APP, "apple-icon.png"),
  await sharp(await square(180, artwork))
    .flatten({ background: APPLE_BACKGROUND })
    .png()
    .toBuffer(),
)

console.log("wrote:")
for (const file of ["favicon.ico", "icon.png", "apple-icon.png"]) {
  console.log(
    `  ${file.padEnd(18)} ${(fs.statSync(path.join(APP, file)).size / 1024).toFixed(1)} KB`,
  )
}
