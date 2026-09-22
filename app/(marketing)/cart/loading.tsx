export default function Loading() {
  return (
    <div className="px-5 py-10 sm:px-8 xl:px-14">
      <div className="mb-10 h-16 w-64 animate-pulse rounded-xl bg-white/5" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex flex-col gap-3.5">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-card h-40 animate-pulse bg-white/5" />
          ))}
        </div>
        <div className="rounded-card h-96 animate-pulse bg-white/5" />
      </div>
    </div>
  )
}
