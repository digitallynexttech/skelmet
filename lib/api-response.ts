import { NextResponse } from "next/server"

import type { ActionResult } from "@/server/action-result"

export type Pagination = {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type ApiSuccess<T> = { success: true; data: T }
export type ApiFailure = {
  success: false
  error: { code: string; message: string; details?: unknown }
}
export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure

const CODE_BY_STATUS: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "UNPROCESSABLE",
  429: "RATE_LIMITED",
  500: "INTERNAL",
}

/** Routes are one expression: `respond(await someService(...))`, no try/catch or logic. */
export function respond<T>(result: ActionResult<T>, successStatus = 200) {
  if (result.ok) {
    return NextResponse.json<ApiSuccess<T>>(
      { success: true, data: result.data },
      {
        status: successStatus,
      },
    )
  }

  return NextResponse.json<ApiFailure>(
    {
      success: false,
      error: {
        code: CODE_BY_STATUS[result.status] ?? "ERROR",
        message: result.error,
        ...(result.details === undefined ? {} : { details: result.details }),
      },
    },
    { status: result.status },
  )
}

/** Never cached: invoices carry the customer's address. Failures stay JSON. */
export function respondPdf(result: ActionResult<{ pdf: Buffer; filename: string }>) {
  if (!result.ok) return respond(result)
  return new NextResponse(new Uint8Array(result.data.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${result.data.filename}"`,
      "Cache-Control": "private, no-store",
    },
  })
}

/** Cached for a year: an image id is never reused for new content. */
export function respondImage(result: ActionResult<{ data: Uint8Array; contentType: string }>) {
  if (!result.ok) return respond(result)
  return new NextResponse(new Uint8Array(result.data.data), {
    headers: {
      "Content-Type": result.data.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}

/** A paginated read is `ok({ data: rows, pagination })`, so hooks read `.data.data`. */
export function paginate<T>(rows: T[], page: number, pageSize: number, total: number) {
  return {
    data: rows,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    } satisfies Pagination,
  }
}
