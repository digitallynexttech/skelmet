import { defineCliConfig } from "sanity/cli"

import { dataset, projectId } from "./features/blog/sanity/env"

/** Which project `pnpm exec sanity ...` talks to: the one config/site.ts names. */
export default defineCliConfig({ api: { projectId, dataset } })
