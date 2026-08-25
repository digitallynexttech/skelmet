export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-16 w-72 animate-pulse rounded-xl bg-white/5" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-card bg-white/5" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-card bg-white/5" />
    </div>
  )
}
