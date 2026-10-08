import fs from "node:fs"

import { defineConfig } from "prisma/config"

// Prisma 7 no longer reads .env itself.
if (fs.existsSync(".env")) process.loadEnvFile(".env")

// Prisma 7 keeps the seed command and datasource URL here, not in package.json.
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
