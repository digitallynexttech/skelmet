import fs from "node:fs"

import { defineConfig } from "prisma/config"

// Prisma 7 stopped reading .env by itself, and the CLI runs outside Next, so
// nothing else loads it either. Node 24 can do this without a dependency.
if (fs.existsSync(".env")) process.loadEnvFile(".env")

/**
 * Prisma 7 keeps the seed command and the datasource URL here, not in
 * package.json (§6).
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
