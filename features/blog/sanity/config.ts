import { defineConfig } from "sanity"
import { structureTool } from "sanity/structure"

import { dataset, projectId, STUDIO_PATH } from "./env"
import { schemaTypes } from "./schemas"

/**
 * The Studio: where posts are written. Mounted in this app at /studio
 * (app/studio/[[...tool]]), and read by the Sanity CLI through
 * sanity.config.ts at the repo root.
 */
export default defineConfig({
  name: "skelmet",
  title: "SKELMET Blog",
  basePath: STUDIO_PATH,
  projectId,
  dataset,
  schema: { types: schemaTypes },
  plugins: [structureTool()],
})
