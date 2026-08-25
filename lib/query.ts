import { toast } from "sonner"

import { ApiFetchError } from "@/lib/api-fetch"

/**
 * Every mutation goes through this, so success and failure sound the same
 * everywhere and each one declares the keys it invalidates (§5).
 */
export function mutationWithToast<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  messages: { loading: string; success: string },
) {
  return async (...args: TArgs): Promise<TResult> => {
    const id = toast.loading(messages.loading)
    try {
      const result = await fn(...args)
      toast.success(messages.success, { id })
      return result
    } catch (err) {
      const message =
        err instanceof ApiFetchError ? err.message : "That didn't work. Try again."
      toast.error(message, { id })
      throw err
    }
  }
}
