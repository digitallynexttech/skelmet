import "server-only"

import { z } from "zod"

import { MAX_PAGE_SIZE } from "@/lib/constants"

/**
 * Query strings for the console's list endpoints, parsed rather than cast.
 *
 * `Number(searchParams.get("page"))` turned `?page=abc` into NaN, which went
 * straight into Prisma's skip and take and came back as a 500; a status
 * string was cast to the enum and reached the database as whatever was
 * typed. A value that does not parse is a 422 with the field named, from the
 * route wrapper, before any service runs.
 */

/** An absent or empty parameter is "not given", so the default applies. */
const given = (value: unknown) => (value === null || value === "" ? undefined : value)

export const pageParam = z.preprocess(
  given,
  z.coerce.number().int().min(1).max(1_000_000).default(1),
)

export const pageSizeParam = z.preprocess(
  given,
  z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
)

export const textParam = z.preprocess(given, z.string().trim().max(200).optional())

export const enumParam = <const T extends readonly [string, ...string[]]>(
  values: T,
  fallback: T[number],
) => z.preprocess(given, z.enum(values).default(fallback))

/** Reads each key of `shape` from the query string and parses them together. */
export function listParams<S extends z.ZodRawShape>(
  params: URLSearchParams,
  shape: S,
): z.infer<z.ZodObject<S>> {
  const raw = Object.fromEntries(Object.keys(shape).map((key) => [key, params.get(key)]))
  return z.object(shape).parse(raw)
}
