/** Duplicated from globals.css on purpose: emails cannot read CSS variables. */
export const C = {
  void: "#07060a",
  carbon: "#14121b",
  line: "#2a2733",
  blaze: "#ff5a1f",
  ember: "#ff8a00",
  acid: "#d4ff3d",
  bone: "#f7f4ed",
  ash: "#a3a0b0",
  dim: "#7c7989",
} as const

export const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
export const MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace"

/** Never interpolate unescaped, even our own values. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
