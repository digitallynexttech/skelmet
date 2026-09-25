/**
 * Encodes the recoloured gallery shots into public/product/.
 *
 *   node scripts/build-colourway-shots.mjs <source-dir>
 *
 * The gallery used to swap only its first slot when you picked a colourway:
 * choosing Militia Olive left four orange photographs behind it. These are the
 * missing four, in each of the two other finishes.
 *
 * Unlike build-colourways.mjs, which remaps the blaze plate's pixels through a
 * chroma mask, these came back from an image model asked to change the filament
 * colour and hold everything else. That is why they are encoded here rather
 * than generated here: the script's job is only to match the originals'
 * dimensions and file size so the gallery's object-cover crop lands the same
 * way on all three finishes.
 *
 * Quality 82 and chroma subsampling off: these carry fine print layer lines,
 * which 4:2:0 smears and which are the entire point of the macro shot.
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

const SRC_DIR = process.argv[2]
if (!SRC_DIR) throw new Error("usage: node scripts/build-colourway-shots.mjs <source-dir>")

const OUT_DIR = path.join(ROOT, "public/product")

/** Each output matches the blaze original it sits beside in the gallery. */
const SHOTS = [
  { from: "profile-olive.png", to: "mount-side-olive.jpg", like: "mount-side.jpg" },
  { from: "profile-ghost.png", to: "mount-side-ghost.jpg", like: "mount-side.jpg" },
  { from: "concrete-olive.png", to: "lifestyle-concrete-olive.jpg", like: "lifestyle-concrete.jpg" },
  { from: "concrete-ghost.png", to: "lifestyle-concrete-ghost.jpg", like: "lifestyle-concrete.jpg" },
  { from: "gloves-olive.png", to: "lifestyle-gloves-olive.jpg", like: "lifestyle-gloves.jpg" },
  { from: "gloves-ghost.png", to: "lifestyle-gloves-ghost.jpg", like: "lifestyle-gloves.jpg" },
  { from: "flame-olive.png", to: "detail-flame-olive.jpg", like: "detail-flame.jpg" },
  { from: "flame-ghost.png", to: "detail-flame-ghost.jpg", like: "detail-flame.jpg" },
]

for (const shot of SHOTS) {
  const src = path.join(SRC_DIR, shot.from)
  if (!fs.existsSync(src)) throw new Error(`missing source: ${src}`)

  // Take the target size from the blaze original rather than hardcoding it,
  // so the three finishes crop identically under object-cover.
  const ref = await sharp(path.join(OUT_DIR, shot.like)).metadata()

  const out = path.join(OUT_DIR, shot.to)
  await sharp(src)
    .resize(ref.width, ref.height, { fit: "cover", position: "centre" })
    .jpeg({ quality: 82, chromaSubsampling: "4:4:4", mozjpeg: true })
    .toFile(out)

  const kb = (fs.statSync(out).size / 1024).toFixed(0)
  console.log(`  ${shot.to.padEnd(32)} ${ref.width}x${ref.height}  ${kb} KB`)
}
