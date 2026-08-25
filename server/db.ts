// NOTE: no `import "server-only"` here, tsx maintenance scripts import this
// file directly, which is the one documented exception (§6).
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

/**
 * Prisma 7 requires a driver adapter at construction, so building without
 * DATABASE_URL would throw at module load. The client is therefore created
 * lazily on first property access: routes that guard with `hasDatabase()`
 * never touch it, and the build stays green before Postgres exists.
 */
function createClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and point it at your Postgres instance.",
    )
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    // Secrets are deny-by-default in the omit, opted back in only where
    // verified (§6). This also narrows the client's type, so `Db` is inferred
    // rather than annotated as a bare PrismaClient.
    omit: {
      user: { passwordHash: true },
    },
  })
}

export type Db = ReturnType<typeof createClient>

const globalForPrisma = globalThis as unknown as { prisma?: Db }

function client(): Db {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient()
  }
  return globalForPrisma.prisma
}

export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(client(), prop, receiver)
  },
  has(_target, prop) {
    return Reflect.has(client(), prop)
  },
})
