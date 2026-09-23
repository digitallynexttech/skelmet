import path from "node:path"

import { defineConfig } from "vitest/config"

/**
 * Node environment by default (§6): what is worth testing here is services and
 * schemas, not rendering. `server-only` is aliased to an empty module because
 * importing it outside a React Server Component throws by design, which would
 * fail every service test before a line of it ran.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "e2e/**"],
  },
  resolve: {
    alias: [
      { find: /^server-only$/, replacement: path.resolve(import.meta.dirname, "test/stubs/server-only.ts") },
      { find: /^@\/(.*)$/, replacement: path.resolve(import.meta.dirname, "$1") },
    ],
  },
})
