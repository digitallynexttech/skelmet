"use client"

import { useCallback, useSyncExternalStore } from "react"

// Per-browser preferences only (storage can be blocked or cleared). SSR and
// hydration use the fallback, so there is no mismatch.

const memory = new Map<string, string>()
const listeners = new Set<() => void>()

function read(key: string): string | null {
  if (memory.has(key)) return memory.get(key)!
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Another tab's change.
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

export function useStoredState(key: string, fallback: string): [string, (next: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key) ?? fallback,
    () => fallback,
  )

  const set = useCallback(
    (next: string) => {
      try {
        window.localStorage.setItem(key, next)
        memory.delete(key)
      } catch {
        // Blocked storage: keep it in memory.
        memory.set(key, next)
      }
      for (const listener of listeners) listener()
    },
    [key],
  )

  return [value, set]
}
