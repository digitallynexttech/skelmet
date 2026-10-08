// Built in the browser from rows already on screen, so an export never shows
// more than the user may see. write-excel-file (~1 MB) loads on demand. Not
// SheetJS: npm's 0.18.5 has unpatched advisories.

export type ExportColumn<T> = {
  header: string
  value: (row: T) => string | number | null | undefined
}

function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function save(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoking immediately can cancel the download in Safari; a tick is enough.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Security: a leading ' stops Excel running a customer-typed formula (CSV injection).
function csvCell(raw: string | number | null | undefined): string {
  const s = raw == null ? "" : String(raw)
  const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return `"${guarded.replace(/"/g, '""')}"`
}

export function downloadCsv<T>(rows: T[], columns: ExportColumn<T>[], name: string): void {
  const head = columns.map((c) => csvCell(c.header)).join(",")
  const body = rows.map((r) => columns.map((c) => csvCell(c.value(r))).join(","))
  // BOM, or Excel on Windows mangles UTF-8 (the rupee sign, accents).
  const blob = new Blob(["﻿", [head, ...body].join("\r\n")], {
    type: "text/csv;charset=utf-8",
  })
  save(blob, `${name}-${stamp()}.csv`)
}

export async function downloadXlsx<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  name: string,
): Promise<void> {
  const writeXlsxFile = (await import("write-excel-file/browser")).default

  const data = [
    columns.map((c) => ({
      value: c.header,
      fontWeight: "bold" as const,
      backgroundColor: "#14121B",
      color: "#F7F4ED",
    })),
    ...rows.map((r) =>
      columns.map((c) => {
        const v = c.value(r)
        return typeof v === "number"
          ? { type: Number, value: v }
          : { type: String, value: v == null ? "" : String(v) }
      }),
    ),
  ]

  const widths = columns.map((c, i) => ({
    // Roughly the longest cell (first 200 rows), so nothing opens as ####.
    width: Math.min(
      42,
      Math.max(
        c.header.length + 4,
        ...rows.slice(0, 200).map((r) => String(columns[i]!.value(r) ?? "").length + 2),
      ),
    ),
  }))

  await writeXlsxFile(data as never, { columns: widths } as never).toFile(`${name}-${stamp()}.xlsx`)
}
