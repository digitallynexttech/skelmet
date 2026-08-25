/** Wire error shape: `{ success: false, error: { code, message, details? } }` (§5). */
export type ApiErrorBody = {
  code: string
  message: string
  details?: unknown
}

export class AppError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(message: string, status = 400, code = "BAD_REQUEST", details?: unknown) {
    super(message)
    this.name = "AppError"
    this.status = status
    this.code = code
    this.details = details
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "You need to sign in to do that.") {
    super(message, 401, "UNAUTHORIZED")
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have access to that.") {
    super(message, 403, "FORBIDDEN")
  }
}

/** A missing grant answers 404, never 403, so nobody can probe what exists (§6). */
export class NotFoundError extends AppError {
  constructor(message = "Not found.") {
    super(message, 404, "NOT_FOUND")
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 409, "CONFLICT", details)
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests. Try again shortly.") {
    super(message, 429, "RATE_LIMITED")
  }
}
