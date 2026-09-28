export default function Loading() {
  return (
    <div className="flex flex-col gap-7">
      <div className="h-16 w-72 animate-pulse rounded-md bg-white/5" />
      <div className="h-11 w-full max-w-[360px] animate-pulse rounded-md bg-white/5" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[86px] animate-pulse rounded-md bg-white/5" />
        ))}
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-md bg-white/5" />
        ))}
      </div>
    </div>
  )
}
