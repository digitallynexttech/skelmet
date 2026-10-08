import type { ApiEnvelope } from "@/lib/api-response"
import { fieldErrorsOf } from "@/lib/validation-message"

export class ApiFetchError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message)
    this.name = "ApiFetchError"
    this.status = status
    this.code = code
    this.details = details
  }

  /** `{ field: message }`, for a form to show under each input. */
  get fieldErrors(): Record<string, string> {
    return fieldErrorsOf(this.details)
  }
}

/** The one client transport, so the app has one error shape. */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      // FormData sets its own multipart type and boundary.
      ...(init?.body && !(init.body instanceof FormData)
        ? { "content-type": "application/json" }
        : {}),
      ...init?.headers,
    },
  })

  let body: ApiEnvelope<T> | null = null
  try {
    body = (await res.json()) as ApiEnvelope<T>
  } catch {
    // Non-JSON: still reported below.
  }

  if (!res.ok || !body || body.success === false) {
    const error = body && body.success === false ? body.error : undefined
    throw new ApiFetchError(
      error?.message ?? "That didn't work. Try again.",
      res.status,
      error?.code ?? "ERROR",
      error?.details,
    )
  }

  return body.data
}
