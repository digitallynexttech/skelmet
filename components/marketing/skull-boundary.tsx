"use client"

import * as React from "react"

/**
 * Catches anything the 3D stage throws, so a decoration cannot swap the homepage
 * for error.tsx; the poster underneath stays as the hero. A class: there is no
 * hook for getDerivedStateFromError.
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
    // Logged: no WebGL and a 404 model look the same from outside otherwise.
    console.warn("[skull] 3D stage failed, falling back to the poster:", error)
    this.props.onError()
  }

  override render() {
    return this.state.failed ? null : this.props.children
  }
}
