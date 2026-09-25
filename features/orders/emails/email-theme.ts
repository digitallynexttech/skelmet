/**
 * What every customer email shares: the palette, the font stacks, and the
 * escaping every interpolated value goes through.
 *
 * The palette is duplicated from globals.css on purpose: an email cannot read
 * CSS variables, and a colour that silently resolved to nothing would render
 * as black text on a black card.
 */
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

/** Order numbers and product names are ours, but never interpolate unescaped. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
