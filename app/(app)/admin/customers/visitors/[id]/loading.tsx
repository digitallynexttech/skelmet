export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-12 w-64 animate-pulse rounded-md bg-white/5" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-md bg-white/5" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-56 animate-pulse rounded-md bg-white/5" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-md bg-white/5" />
    </div>
  )
}
