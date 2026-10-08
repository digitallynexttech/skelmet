import { defineCliConfig } from "sanity/cli"

import { dataset, projectId } from "./features/blog/sanity/env"

/** `pnpm exec sanity` talks to the project lib/config/site.ts names. */
export default defineCliConfig({ api: { projectId, dataset } })
