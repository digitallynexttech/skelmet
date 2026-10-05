import type { Metadata } from "next"
import Link from "next/link"

import { siteConfig } from "@/config/site"

/**
 * Absolute, because whether the root layout's "%s - SKELMET" template reaches
 * a not-found in its own segment is Next's call, and this title must not come
 * out as "Page not found - SKELMET - SKELMET" either way.
 */
export const metadata: Metadata = {
  title: { absolute: `Page not found - ${siteConfig.name}` },
}

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <div className="text-ember mb-4 font-mono text-[11.5px] tracking-[0.22em] uppercase">
        Error 404
      </div>
      <h1 className="font-display text-bone mb-5 text-[64px] leading-[1.0] uppercase sm:text-[96px]">
        Nothing
        <br />
        <span className="text-blaze">mounted here</span>
      </h1>
      <p className="text-ash mb-8 max-w-[420px] text-[16px] leading-[1.6]">
        That page has been taken off the wall. The skulls are still where you left them.
      </p>
      <Link
        href="/"
        className="from-blaze to-ember text-void inline-flex h-[54px] items-center rounded-full bg-gradient-to-r px-7 text-sm font-bold tracking-[0.05em] uppercase"
      >
        Back to the shop
      </Link>
    </div>
  )
}
