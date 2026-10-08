import { NextRequest } from "next/server"
import { describe, expect, it, vi } from "vitest"
import { z } from "zod"

import { withErrorHandler } from "@/server/api-handler"
import { listParams, pageParam, pageSizeParam, enumParam, textParam } from "@/server/list-params"

const req = (url = "https://skelmet.in/api/admin/orders") => new NextRequest(url)

describe("withErrorHandler", () => {
  it("answers 404 for an id that is not a uuid, without running the handler", async () => {
    const handler = vi.fn()
    const route = withErrorHandler<{ id: string }>(handler)
    for (const id of ["abc", "1", "'; drop table orders; --", "5f6e7d8c-9b0a-4c1d-8e2f"]) {
      const res = await route(req(), { params: Promise.resolve({ id }) })
      expect(res.status).toBe(404)
      expect(await res.json()).toEqual({
        success: false,
        error: { code: "NOT_FOUND", message: "Not found." },
      })
    }
    expect(handler).not.toHaveBeenCalled()
  })

  it("runs the handler for a uuid", async () => {
    const route = withErrorHandler<{ id: string }>(
      async (_r, { params }) => Response.json({ id: params.id }) as never,
    )
    const id = "5f6e7d8c-9b0a-4c1d-8e2f-3a4b5c6d7e8f"
    const res = await route(req(), { params: Promise.resolve({ id }) })
    expect(res.status).toBe(200)
  })

  it("turns a query string that does not parse into a 422", async () => {
    const route = withErrorHandler(async (r) => {
      listParams(r.nextUrl.searchParams, { page: pageParam })
      return Response.json({}) as never
    })
    const res = await route(req("https://skelmet.in/api/admin/orders?page=abc"), {
      params: Promise.resolve({}),
    })
    expect(res.status).toBe(422)
  })
})

describe("listParams", () => {
  const shape = {
    page: pageParam,
    pageSize: pageSizeParam,
    status: enumParam(["ALL", "PAID"], "ALL"),
    q: textParam,
  }
  const parse = (query: string) => listParams(new URLSearchParams(query), shape)

  it("fills in the defaults for what is absent or empty", () => {
    expect(parse("")).toEqual({ page: 1, pageSize: undefined, status: "ALL", q: undefined })
    expect(parse("page=&status=&q=")).toEqual({
      page: 1,
      pageSize: undefined,
      status: "ALL",
      q: undefined,
    })
  })

  it("reads good values", () => {
    expect(parse("page=3&pageSize=200&status=PAID&q=%20rao%20")).toEqual({
      page: 3,
      pageSize: 200,
      status: "PAID",
      q: "rao",
    })
  })

  it("refuses NaN, zero, fractions, oversized pages and unknown statuses", () => {
    for (const query of ["page=abc", "page=0", "page=1.5", "pageSize=201", "status=SHIPPED"]) {
      expect(() => parse(query), query).toThrow(z.ZodError)
    }
  })
})
