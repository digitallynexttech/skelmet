import "server-only"

import { ZodError, flattenError } from "zod"

import { AppError } from "@/lib/errors"

/**
 * Every service export returns an ActionResult. Expected failures `return fail(…)`
 * rather than throwing, Next redacts thrown messages in production (§7).
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number; details?: unknown }

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data }
}

export function fail(message: string, details?: unknown, status = 400): ActionResult<never> {
  return { ok: false, error: message, status, details }
}

/**
 * Wraps a service body so an unexpected throw becomes a well-shaped failure
 * instead of a 500 with a redacted message.
 */
export async function runAction<T>(body: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await body()
  } catch (err) {
    if (err instanceof AppError) {
      return fail(err.message, err.details, err.status)
    }

    // Services parse their input inside this body, so a schema failure lands
    // here rather than at the route wrapper. Map it, or every bad form field
    // in the app reads as a 500.
    if (err instanceof ZodError) {
      return fail("Some of those details are not right.", flattenError(err), 422)
    }

    console.error("[ACTION]", err)
    return fail("Something went wrong on our side.", undefined, 500)
  }
}
