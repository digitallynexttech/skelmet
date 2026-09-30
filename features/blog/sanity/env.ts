// Relative, not "@/": the Sanity CLI reads this file too (through
// sanity.config.ts at the repo root), and it does not know the path alias.
import { siteConfig } from "../../../config/site"

/**
 * Which Sanity project the blog reads and the Studio edits.
 *
 * Nothing here may throw at import time: this is reached from the sitemap and
 * the request proxy as well as /blog, and a throw there would take those down
 * with it. Callers check `sanityConfigured` and carry on without posts.
 */
export const { projectId, dataset, apiVersion } = siteConfig.sanity

/** False until config/site.ts names a project. */
export const sanityConfigured = projectId !== ""

/** Where the Studio is mounted: app/studio/[[...tool]]. */
export const STUDIO_PATH = "/studio"
