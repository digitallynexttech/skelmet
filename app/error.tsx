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
      <div className="text-magenta mb-4 font-mono text-[11.5px] tracking-[0.22em] uppercase">
        Something broke
      </div>
      <h1 className="font-display text-bone mb-5 text-[52px] leading-[1.0] uppercase sm:text-[72px]">
        That went
        <br />
        <span className="text-blaze">sideways</span>
      </h1>
      <p className="text-ash mb-8 max-w-[420px] text-[16px] leading-[1.6]">
        Our side, not yours. Try again, if it keeps happening, tell us and we&apos;ll dig in.
      </p>
      <button
        type="button"
        onClick={reset}
        className="from-blaze to-ember text-void inline-flex h-[54px] items-center rounded-full bg-gradient-to-r px-7 text-sm font-bold tracking-[0.05em] uppercase"
      >
        Try again
      </button>
    </div>
  )
}
