/**
 * Table exports, CSV and XLSX.
 *
 * Both are generated in the browser from rows already on screen, so an export
 * can never show more than the admin is allowed to see - the server has
 * already applied the permission check that produced them.
 *
 * write-excel-file is imported dynamically: it is about a megabyte, and an
 * admin who never clicks Export should not pay for it on every page load.
 * SheetJS was the obvious alternative and was rejected - npm's latest is
 * pinned at 0.18.5, which carries unpatched prototype-pollution and ReDoS
 * advisories, because the project publishes newer builds off-registry.
 */

export type ExportColumn<T> = {
  /** Header text, and the key used if the row has no accessor. */
  header: string
  /** Pulls the cell value out of a row. */
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

/**
 * Escapes one CSV field.
 *
 * The leading apostrophe on anything starting =, +, - or @ is not decoration:
 * Excel and Sheets treat those as formulas, so a customer who types
 * `=HYPERLINK(...)` into a name field would have it EXECUTE when an admin
 * opens the export. That is CSV injection, and this is the fix for it.
 */
function csvCell(raw: string | number | null | undefined): string {
  const s = raw == null ? "" : String(raw)
  const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return `"${guarded.replace(/"/g, '""')}"`
}

export function downloadCsv<T>(rows: T[], columns: ExportColumn<T>[], name: string): void {
  const head = columns.map((c) => csvCell(c.header)).join(",")
  const body = rows.map((r) => columns.map((c) => csvCell(c.value(r))).join(","))
  // BOM first, or Excel on Windows reads UTF-8 as the local codepage and
  // mangles the rupee sign and every accented name.
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

  // The browser build hands back { toBlob, toFile } rather than writing -
  // it cannot touch the filesystem, so the download is the caller's job.
  const widths = columns.map((c, i) => ({
    // Roughly the longest cell, so nothing opens as ####. Sampled, not
    // exhaustive: an export of thousands should not walk every row twice.
    width: Math.min(
      42,
      Math.max(
        c.header.length + 4,
        ...rows.slice(0, 200).map((r) => String(columns[i]!.value(r) ?? "").length + 2),
      ),
    ),
  }))

  await writeXlsxFile(data as never, { columns: widths } as never).toFile(
    `${name}-${stamp()}.xlsx`,
  )
}
