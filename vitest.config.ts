import path from "node:path"

import { defineConfig } from "vitest/config"

// `server-only` throws outside a Server Component, so tests get an empty stub.
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", ".next-*/**", ".claude/**"],
  },
  resolve: {
    alias: [
      {
        find: /^server-only$/,
        replacement: path.resolve(import.meta.dirname, "test/stubs/server-only.ts"),
      },
      { find: /^@\/(.*)$/, replacement: path.resolve(import.meta.dirname, "$1") },
    ],
  },
})
