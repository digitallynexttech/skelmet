import { Monitor, Smartphone, Tablet } from "lucide-react"

/** A phone, a tablet or a screen, for a visitor's device type. */
export function DeviceIcon({ type, className }: { type: string | null; className?: string }) {
  const Icon = type === "mobile" ? Smartphone : type === "tablet" ? Tablet : Monitor
  return <Icon className={className} strokeWidth={1.8} aria-label={type ?? "unknown device"} />
}
