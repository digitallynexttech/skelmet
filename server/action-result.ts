import "server-only"

import { ZodError, flattenError } from "zod"

import { AppError } from "@/lib/errors"
import { validationMessage } from "@/lib/validation-message"
import "@/server/zod-messages"

/** Services return this; expected failures `return fail(…)`, never throw (Next redacts thrown messages). */
export type ActionResult<T> =
  { ok: true; data: T } | { ok: false; error: string; status: number; details?: unknown }

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data }
}

export function fail(message: string, details?: unknown, status = 400): ActionResult<never> {
  return { ok: false, error: message, status, details }
}

/** Turns an unexpected throw into a well-shaped failure. */
export async function runAction<T>(body: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await body()
  } catch (err) {
    if (err instanceof AppError) {
      return fail(err.message, err.details, err.status)
    }

    // Services parse input in here, so map schema failures or they read as 500s.
    if (err instanceof ZodError) {
      return fail(validationMessage(err), flattenError(err), 422)
    }

    console.error("[ACTION]", err)
    return fail("Something went wrong on our side.", undefined, 500)
  }
}
