// Relative, not "@/": the Sanity CLI reads this file too and does not know the path alias.
import { siteConfig } from "../../../lib/config/site"

// Must not throw at import: the sitemap and the proxy import it. Callers check `sanityConfigured`.
export const { projectId, dataset, apiVersion } = siteConfig.sanity

/** False until lib/config/site.ts names a project. */
export const sanityConfigured = projectId !== ""

/** Where the Studio is mounted: app/studio/[[...tool]]. */
export const STUDIO_PATH = "/studio"
