/**
 * Where the hero skull's two files live: the model and its poster.
 *
 * /product is cached for 30 days as immutable, so both are named by their
 * contents (skull-<hash>.glb) and the names kept in
 * components/marketing/skull-assets.json, which the site reads. Build scripts
 * never write them into public/product directly: publishAsset() names the file,
 * removes the one it replaces and records the new name.
 */
import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

// fileURLToPath, not pathname: the URL form percent-encodes spaces in the path.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const PRODUCT = path.join(ROOT, "public/product")
const MANIFEST = path.join(ROOT, "components/marketing/skull-assets.json")

/** The start of the file's SHA-256: what its name carries. */
export const hashOf = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 10)

/** { model, poster }: the URLs the site asks for. */
export function readAssets() {
  return JSON.parse(fs.readFileSync(MANIFEST, "utf8"))
}

/** The file on disk behind one of those URLs. */
export function assetFile(url) {
  return path.join(ROOT, "public", url)
}

/**
 * Saves `bytes` as public/product/<stem>-<hash><ext>, removes the versions
 * of it that went before, and records its URL under `key`. Returns the path.
 */
export function publishAsset(key, stem, ext, bytes) {
  const name = `${stem}-${hashOf(bytes)}${ext}`
  const earlier = new RegExp(`^${stem}-[0-9a-f]{10}\\${ext}$`)
  for (const file of fs.readdirSync(PRODUCT)) {
    if (file !== name && earlier.test(file)) fs.rmSync(path.join(PRODUCT, file))
  }
  const file = path.join(PRODUCT, name)
  fs.writeFileSync(file, bytes)

  const assets = readAssets()
  assets[key] = `/product/${name}`
  fs.writeFileSync(MANIFEST, `${JSON.stringify(assets, null, 2)}\n`)
  return file
}
