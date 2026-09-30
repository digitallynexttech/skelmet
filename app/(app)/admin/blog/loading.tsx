export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-16 w-64 animate-pulse rounded-md bg-white/5" />
      <div className="grid grid-cols-3 gap-3 sm:max-w-xl">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-md bg-white/5" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-md bg-white/5" />
    </div>
  )
}
