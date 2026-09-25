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
 * Only `/<section>/<slug>` itself is a page. A name with a dot in it is a
 * file: the product photos and the 3D model are served from public/product,
 * at /product/<file>, and treating them as unknown products took every image
 * on the site down. Deeper paths are no page of these either. Both are left to
 * Next, which serves the file or answers 404 itself.
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
    // A malformed escape is no page either.
    return true
  }
  if (decoded.includes(".")) return false
  return !known.has(decoded)
}
