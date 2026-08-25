"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Fades a section up the first time it enters the viewport, per the motion spec
 * (700ms, cubic-bezier(.16,1,.3,1), 60ms stagger via `delay`).
 *
 * setState only ever happens inside the observer callback or a rAF, never
 * synchronously in the effect body, which React 19 flags as a cascading render.
 */
export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode
  delay?: number
  className?: string
  as?: "div" | "section" | "li"
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [shown, setShown] = React.useState(false)

  React.useEffect(() => {
    const node = ref.current
    if (!node) return

    // No IntersectionObserver (very old browser, or a test env): show it on the
    // next frame rather than leaving the content invisible.
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setShown(true))
      return () => cancelAnimationFrame(frame)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true)
          observer.disconnect()
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref as never}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
        shown ? "translate-y-0 opacity-100" : "translate-y-7 opacity-0 motion-reduce:opacity-100",
        className,
      )}
    >
      {children}
    </Tag>
  )
}
