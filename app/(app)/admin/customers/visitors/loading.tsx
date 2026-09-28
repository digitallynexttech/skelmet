export default function Loading() {
  return (
    <div className="flex flex-col gap-7">
      <div className="h-16 w-56 animate-pulse rounded-md bg-white/5" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-[86px] animate-pulse rounded-md bg-white/5" />
        ))}
      </div>
      <div className="h-12 w-full max-w-[420px] animate-pulse rounded-md bg-white/5" />
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-md bg-white/5" />
        ))}
      </div>
    </div>
  )
}
