export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-16 w-64 animate-pulse rounded-md bg-white/5" />
      <div className="h-11 w-96 max-w-full animate-pulse rounded-md bg-white/5" />
      <div className="rounded-card h-72 animate-pulse bg-white/5" />
    </div>
  )
}
