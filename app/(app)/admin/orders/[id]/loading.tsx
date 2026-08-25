export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-14 w-64 animate-pulse rounded-xl bg-white/5" />
      <div className="h-20 animate-pulse rounded-card bg-white/5" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="h-80 animate-pulse rounded-card bg-white/5" />
        <div className="h-80 animate-pulse rounded-card bg-white/5" />
      </div>
    </div>
  )
}
