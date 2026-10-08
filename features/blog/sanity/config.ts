import { defineConfig } from "sanity"
import { structureTool } from "sanity/structure"

import { dataset, projectId, STUDIO_PATH } from "./env"
import { schemaTypes } from "./schemas"

// Mounted at /studio, and read by the Sanity CLI through the root sanity.config.ts.
export default defineConfig({
  name: "skelmet",
  title: "SKELMET Blog",
  basePath: STUDIO_PATH,
  projectId,
  dataset,
  schema: { types: schemaTypes },
  plugins: [structureTool()],
})
