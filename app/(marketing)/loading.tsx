export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="size-10 animate-spin rounded-full border-2 border-white/10 border-t-blaze" />
        <span className="font-mono text-[11px] tracking-[0.2em] text-dim uppercase">Loading</span>
      </div>
    </div>
  )
}
