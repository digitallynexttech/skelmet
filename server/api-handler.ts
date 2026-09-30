import "server-only"

import { NextResponse, type NextRequest } from "next/server"
import { ZodError, flattenError } from "zod"

import { AppError } from "@/lib/errors"
import { validationMessage } from "@/lib/validation-message"
import "@/server/zod-messages"

type Ctx<P> = { params: P }
type Handler<P> = (req: NextRequest, ctx: Ctx<P>) => Promise<NextResponse> | NextResponse

/**
 * The wrapper owns error mapping. A local try/catch inside a route hides the
 * envelope, so routes never have one (§7).
 *
 * Dynamic routes MUST pass the param type or `params.id` is `string | undefined`
 * under noUncheckedIndexedAccess and the build fails:
 *
 *   export const PATCH = withErrorHandler<{ id: string }>(async (req, { params }) => …)
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Every `[id]` in this API is a uuid primary key. Anything else cannot name a
 * row, and passed on it made Postgres refuse the query - a 500 for what is
 * simply a page that does not exist.
 */
function badId(params: unknown): boolean {
  const id = (params as { id?: unknown } | null)?.id
  return typeof id === "string" && !UUID.test(id)
}

export function withErrorHandler<P = Record<string, never>>(handler: Handler<P>) {
  return async (req: NextRequest, ctx: { params: Promise<P> } | Ctx<P>) => {
    try {
      // Next 16 hands route params in as a promise.
      const raw = (ctx as { params: Promise<P> }).params
      const params = raw instanceof Promise ? await raw : ((raw ?? {}) as P)
      if (badId(params)) {
        return NextResponse.json(
          { success: false, error: { code: "NOT_FOUND", message: "Not found." } },
          { status: 404 },
        )
      }
      return await handler(req, { params })
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "UNPROCESSABLE",
              message: validationMessage(err),
              details: flattenError(err),
            },
          },
          { status: 422 },
        )
      }

      if (err instanceof AppError) {
        return NextResponse.json(
          {
            success: false,
            error: { code: err.code, message: err.message, details: err.details },
          },
          { status: err.status },
        )
      }

      console.error("[API]", err)
      return NextResponse.json(
        { success: false, error: { code: "INTERNAL", message: "Something went wrong." } },
        { status: 500 },
      )
    }
  }
}
