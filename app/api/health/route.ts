import { NextResponse } from "next/server"

import { hasDatabase } from "@/lib/env"
import { withErrorHandler } from "@/server/api-handler"

export const dynamic = "force-dynamic"

export const GET = withErrorHandler(async () => {
  let dbOk = false

  if (hasDatabase()) {
    try {
      const { db } = await import("@/server/db")
      await db.$queryRaw`SELECT 1`
      dbOk = true
    } catch {
      dbOk = false
    }
  }

  return NextResponse.json({
    ok: true,
    db: dbOk,
    version: process.env.npm_package_version ?? "0.1.0",
  })
})
