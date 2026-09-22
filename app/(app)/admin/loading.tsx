export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-16 w-72 animate-pulse rounded-xl bg-white/5" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-card h-32 animate-pulse bg-white/5" />
        ))}
      </div>
      <div className="rounded-card h-96 animate-pulse bg-white/5" />
    </div>
  )
}
