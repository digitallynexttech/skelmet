"use client"

import { useSyncExternalStore } from "react"

const subscribe = () => () => {}
const getSnapshot = () => true
const getServerSnapshot = () => false

/**
 * `false` on the server and during the first client render, `true` after
 * hydration.
 *
 * The canonical way to gate localStorage-backed state without a hydration
 * mismatch, and without `setState` inside an effect, which React 19 flags as
 * a cascading render.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
