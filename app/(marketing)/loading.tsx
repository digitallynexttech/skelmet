export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="border-t-blaze size-10 animate-spin rounded-full border-2 border-white/10" />
        <span className="text-dim font-mono text-[11px] tracking-[0.2em] uppercase">Loading</span>
      </div>
    </div>
  )
}
