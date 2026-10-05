import { cn } from "@/lib/utils"

/**
 * What an admin page shows while it loads (each section's loading.tsx), in
 * the shape the page will take: the PageHeader's line, then a table in its
 * frame, a record's two columns, or the dashboard's tiles. Sized like the
 * real thing, so nothing jumps when it arrives.
 */
export function PageSkeleton({
  kind = "table",
}: {
  kind?: "table" | "detail" | "dashboard" | "tabs"
}) {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading">
      <div className="flex items-center gap-3">
        <Block className="size-5" />
        <Block className="h-6 w-40" />
        {kind === "table" ? <Block className="ml-auto h-9 w-24" /> : null}
      </div>

      {kind === "dashboard" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Block key={i} className="h-[104px]" />
          ))}
        </div>
      ) : null}

      {kind === "tabs" ? <Block className="h-11 w-full max-w-[520px]" /> : null}

      {kind === "detail" ? (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Block className="h-80" />
          <Block className="h-80" />
        </div>
      ) : (
        <div className="rounded-md border border-white/[0.09]">
          <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 py-2.5">
            <Block className="h-9 w-16" />
            <Block className="h-9 w-full max-w-[280px]" />
            <Block className="ml-auto size-9" />
          </div>
          <div className="divide-y divide-white/[0.07]">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-4 py-4">
                <Block className="h-5 w-full" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Block({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-sm bg-white/5", className)} />
}
