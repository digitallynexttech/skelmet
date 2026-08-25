import type { ApiEnvelope } from "@/lib/api-response"

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
}

/**
 * The single transport. Every mutation and query goes through here, so there is
 * one error shape for the whole app (§1).
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  })

  let body: ApiEnvelope<T> | null = null
  try {
    body = (await res.json()) as ApiEnvelope<T>
  } catch {
    // fall through, a non-JSON body is still an error we can describe
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
