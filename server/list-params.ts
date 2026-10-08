import "server-only"

import { z } from "zod"

import { MAX_PAGE_SIZE } from "@/lib/constants"

// List query strings are parsed, never cast: a bad value is a 422, not a Prisma 500.

// Absent or empty: the default applies.
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
