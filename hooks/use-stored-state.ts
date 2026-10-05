"use client"

import { useCallback, useSyncExternalStore } from "react"

/**
 * A small preference kept in this browser - how many rows a table shows,
 * which of its columns are hidden. Not for anything that has to survive:
 * storage can be blocked or cleared, and then this is the fallback.
 *
 * Read through useSyncExternalStore, so the server render and hydration use
 * the fallback and the stored value follows straight after, with no
 * mismatch. A browser that refuses storage keeps the choice in memory
 * instead, for as long as the page is open.
 */

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
  // Another tab changing the same preference.
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
        // Private mode or blocked storage: memory holds it instead.
        memory.set(key, next)
      }
      for (const listener of listeners) listener()
    },
    [key],
  )

  return [value, set]
}
