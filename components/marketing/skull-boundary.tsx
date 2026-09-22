"use client"

import * as React from "react"

/**
 * Catches anything the 3D stage throws so a decoration cannot take the page
 * down with it.
 *
 * Without this, a failed GLB fetch or a chunk that never arrives propagates out
 * of `useLoader` — past the `Suspense` boundary, which only handles the
 * pending case, not the thrown one — to the route's `error.tsx`, replacing the
 * entire homepage with an error screen because an ornament did not load. The
 * poster underneath is a complete hero on its own, so the honest response is
 * to drop the canvas and keep it.
 *
 * A class because React still has no hook equivalent for `getDerivedStateFromError`.
 */
export class SkullBoundary extends React.Component<
  { onError: () => void; children: React.ReactNode },
  { failed: boolean }
> {
  override state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  override componentDidCatch(error: unknown) {
    // Worth a line in the console — a WebGL context that cannot be created and
    // a model that 404s look identical from the outside otherwise.
    console.warn("[skull] 3D stage failed, falling back to the poster:", error)
    this.props.onError()
  }

  override render() {
    return this.state.failed ? null : this.props.children
  }
}
