/**
 * Where the hero skull's two files live: the model, and the poster of it.
 *
 * Both are named by their contents - skull-<hash>.glb - and the names are
 * kept in components/marketing/skull-assets.json, which the site reads. nginx
 * tells browsers and Cloudflare to keep everything under /product for thirty
 * days without asking again, which is only true of a file whose name changes
 * when it does. The model rebuilt from the print file went out as skull.glb,
 * the name the model before it had: everyone who had already seen the old one
 * went on seeing it, and Cloudflare went on serving the old poster. A new
 * name is a file nobody has yet.
 *
 * So the build scripts never write into public/product themselves: they hand
 * the bytes to publishAsset(), which names the file, removes the version it
 * replaces and records the new name.
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
