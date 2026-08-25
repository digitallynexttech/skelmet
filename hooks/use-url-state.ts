"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

/**
 * List state (page, filters, tab) lives in the URL so a filtered view is
 * shareable and the back button behaves (§6).
 */
export function useUrlState<T extends Record<string, string>>(
  defaults: T,
): [T, (next: Partial<T>) => void] {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const state = React.useMemo(() => {
    const out = { ...defaults }
    for (const key of Object.keys(defaults) as Array<keyof T>) {
      const value = searchParams.get(String(key))
      if (value !== null) out[key] = value as T[keyof T]
    }
    return out
  }, [searchParams, defaults])

  const setState = React.useCallback(
    (next: Partial<T>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(next)) {
        // Drop the param when it matches the default, so URLs stay short.
        if (value === undefined || value === "" || value === defaults[key]) params.delete(key)
        else params.set(key, String(value))
      }
      const query = params.toString()
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams, defaults],
  )

  return [state, setState]
}
