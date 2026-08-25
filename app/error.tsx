"use client"

import { useEffect } from "react"

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[APP]", error)
  }, [error])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <div className="mb-4 font-mono text-[11.5px] tracking-[0.22em] text-magenta uppercase">
        Something broke
      </div>
      <h1 className="mb-5 font-display text-[52px] leading-[1.0] text-bone uppercase sm:text-[72px]">
        That went
        <br />
        <span className="text-blaze">sideways</span>
      </h1>
      <p className="mb-8 max-w-[420px] text-[16px] leading-[1.6] text-ash">
        Our side, not yours. Try again, if it keeps happening, tell us and we&apos;ll dig in.
      </p>
      <button
        type="button"
        onClick={reset}
        className="inline-flex h-[54px] items-center rounded-full bg-gradient-to-r from-blaze to-ember px-7 text-sm font-bold tracking-[0.05em] text-void uppercase"
      >
        Try again
      </button>
    </div>
  )
}
