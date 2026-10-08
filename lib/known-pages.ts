import { PRODUCTS } from "@/features/catalog/catalog"
import { POLICIES } from "@/features/policies/policies"

const KNOWN_SLUGS = new Map<string, Set<string>>([
  ["product", new Set(PRODUCTS.map((p) => p.slug))],
  ["policies", new Set(POLICIES.map((p) => p.slug))],
])

// Files under /product (photos, the 3D model) are left to Next. Only real
// extensions pass, or made-up names like /product/x.y would fill the page cache.
const STATIC_FILE = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "avif",
  "gif",
  "svg",
  "ico",
  "glb",
  "gltf",
  "mp4",
  "webm",
  "txt",
  "xml",
  "json",
  "woff",
  "woff2",
  "css",
  "js",
  "map",
  "pdf",
])

function isStaticFile(name: string): boolean {
  const dot = name.lastIndexOf(".")
  return dot > 0 && STATIC_FILE.has(name.slice(dot + 1).toLowerCase())
}

/**
 * An unknown product or policy slug, for proxy.ts to 404: the pages answer 200
 * from notFound() and keep unknown slugs open, so each would be cached.
 */
export function isUnknownPage(pathname: string): boolean {
  const parts = pathname.split("/")
  if (parts.length !== 3) return false
  const [, section, slug] = parts
  const known = section ? KNOWN_SLUGS.get(section) : undefined
  if (!known || !slug) return false

  let decoded = slug
  try {
    decoded = decodeURIComponent(slug)
  } catch {
    return true
  }
  if (isStaticFile(decoded)) return false
  return !known.has(decoded)
}
