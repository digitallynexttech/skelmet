"use client"

import { useEffect } from "react"

import { Button } from "@/components/ui/button"

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[ADMIN]", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-3 font-mono text-[11px] tracking-[0.22em] text-magenta uppercase">
        Console error
      </div>
      <h1 className="mb-4 font-display text-[34px] leading-[1.04] text-bone uppercase">
        That screen failed to load
      </h1>
      <p className="mb-7 max-w-[400px] text-[14.5px] leading-[1.6] text-ash">
        {error.message || "Something went wrong on our side."}
      </p>
      <Button type="button" variant="primary" size="md" onClick={reset}>
        Try again
      </Button>
    </div>
  )
}
