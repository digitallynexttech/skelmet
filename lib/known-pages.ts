import { PRODUCTS } from "@/features/catalog/catalog"
import { POLICIES } from "@/features/policies/policies"

/** The pages that take a slug, and the slugs each one has. */
const KNOWN_SLUGS = new Map<string, Set<string>>([
  ["product", new Set(PRODUCTS.map((p) => p.slug))],
  ["policies", new Set(POLICIES.map((p) => p.slug))],
])

/**
 * A product or policy URL that does not exist, for proxy.ts to answer 404
 * before it renders.
 *
 * Those pages cannot do this themselves. notFound() there answers HTTP 200,
 * because the marketing loading boundary has already sent the shell, and they
 * keep unknown slugs open (see their `revalidate`) so a change in the console
 * can rebuild them. Every such render would also be kept in the page cache,
 * so random slugs could fill the disk.
 *
 * Only `/<section>/<slug>` itself is a page. A name ending in a static file's
 * extension is a file: the product photos and the 3D model are served from
 * public/product, at /product/<file>, and treating them as unknown products
 * took every image on the site down. Deeper paths are no page of these
 * either. Both are left to Next, which serves the file or answers 404 itself.
 *
 * Any dot at all used to count as a file, so /product/x.y - and any number of
 * made-up names like it - skipped this check, rendered, and was kept in the
 * page cache. Only the extensions a real static file here could have pass.
 */
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
    // A malformed escape is no page either.
    return true
  }
  if (isStaticFile(decoded)) return false
  return !known.has(decoded)
}
