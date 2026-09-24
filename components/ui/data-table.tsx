"use client"

import * as React from "react"
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
} from "lucide-react"

import { downloadCsv, downloadXlsx, type ExportColumn } from "@/lib/export"
import { cn } from "@/lib/utils"

/**
 * The one table every admin screen uses.
 *
 * Built once rather than per screen: five copies of a row counter, a select-all
 * checkbox and a sort arrow drift apart, and the one that drifts is the one
 * that exports the wrong column.
 *
 * Sorting, paging and export all run over the rows handed in, so the screen
 * above must fetch the whole set it wants sorted rather than one page of it.
 * The admin endpoints take a pageSize for exactly that reason, capped at
 * MAX_PAGE_SIZE. Past that cap the server holds rows back, and `total` makes
 * the table say so - because sorting twenty of two hundred rows and calling
 * it "sorted by spend" is a lie, and a spreadsheet that quietly holds one
 * page is a worse one.
 */
export type Column<T> = {
  key: string
  header: string
  /** What the cell renders. Defaults to the sort value. */
  cell?: (row: T) => React.ReactNode
  /** What the column sorts and exports by. Omit to make a column unsortable. */
  value?: (row: T) => string | number | null | undefined
  align?: "left" | "right"
  className?: string
}

type Props<T> = {
  rows: T[]
  columns: Column<T>[]
  rowId: (row: T) => string
  /** Filename stem for exports, e.g. "customers". */
  exportName: string
  empty?: React.ReactNode
  loading?: boolean
  pageSize?: number
  /** Rendered between the selection count and the export buttons. */
  toolbar?: React.ReactNode
  /**
   * What the export contains, when that differs from what the table shows.
   * A cell that stacks a name over an email reads well on screen and badly
   * in a spreadsheet, where they want to be two columns.
   */
  exportColumns?: ExportColumn<T>[]
  /**
   * Draws the bordered frame. Off when the table already sits inside a
   * card, where a second rounded border is just a box in a box.
   */
  frame?: boolean
  /**
   * How many rows match on the server, when that is more than were sent.
   * Sorting and export run over what is loaded, so if the server held some
   * back the table has to say so rather than let an admin believe a
   * spreadsheet covers everything.
   */
  total?: number
  /**
   * Detail for one row, revealed on demand. For content a cell cannot hold
   * honestly - a paragraph of free text truncated to one line is not a
   * summary, it is a message the reader cannot read.
   */
  expandable?: (row: T) => React.ReactNode
}

export function DataTable<T>({
  rows,
  columns,
  rowId,
  exportName,
  empty,
  loading = false,
  pageSize = 20,
  toolbar,
  exportColumns,
  frame = true,
  total,
  expandable,
}: Props<T>) {
  const [sort, setSort] = React.useState<{ key: string; dir: "asc" | "desc" } | null>(null)
  const [page, setPage] = React.useState(1)
  const [picked, setPicked] = React.useState<Set<string>>(new Set())
  const [open, setOpen] = React.useState<Set<string>>(new Set())

  const sorted = React.useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.value) return rows
    const dir = sort.dir === "asc" ? 1 : -1
    // Copy first: sorting the prop array in place mutates the caller's state.
    return [...rows].sort((a, b) => {
      const x = col.value!(a)
      const y = col.value!(b)
      if (x == null && y == null) return 0
      if (x == null) return 1
      if (y == null) return -1
      if (typeof x === "number" && typeof y === "number") return (x - y) * dir
      return String(x).localeCompare(String(y), undefined, { numeric: true }) * dir
    })
  }, [rows, sort, columns])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const current = Math.min(page, totalPages)
  const start = (current - 1) * pageSize
  const shown = sorted.slice(start, start + pageSize)

  // A filter upstream can shrink the list under the current page; snap back
  // rather than showing an empty one.
  if (page !== current) setPage(current)

  const pageIds = shown.map(rowId)
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => picked.has(id))

  function toggleAll() {
    const next = new Set(picked)
    if (allOnPage) for (const id of pageIds) next.delete(id)
    else for (const id of pageIds) next.add(id)
    setPicked(next)
  }

  function toggleOne(id: string) {
    const next = new Set(picked)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setPicked(next)
  }

  const truncated = typeof total === "number" && total > rows.length

  // Position is looked up, not searched: indexOf inside the accessor makes
  // an export of n rows do n^2 comparisons.
  const rank = new Map(sorted.map((r, i) => [rowId(r), i + 1]))

  const exportCols: ExportColumn<T>[] = [
    { header: "S.No", value: (r) => rank.get(rowId(r)) ?? 0 },
    ...(exportColumns ??
      columns
        .filter((c) => c.value)
        .map((c) => ({ header: c.header, value: (r: T) => c.value!(r) }))),
  ]

  // Selection wins when there is one: an admin who ticked four rows and hit
  // Export meant those four, not the page they happen to be on.
  const exportRows = picked.size > 0 ? sorted.filter((r) => picked.has(rowId(r))) : sorted

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="text-dim font-mono text-[11px] tracking-[0.1em]">
          {picked.size > 0 ? (
            <button
              type="button"
              onClick={() => setPicked(new Set())}
              className="text-acid hover:text-bone transition-colors"
            >
              {picked.size} selected · clear
            </button>
          ) : (
            <span>
              {sorted.length} {sorted.length === 1 ? "row" : "rows"}
              {truncated ? " of " + total : null}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {toolbar}
          <button
            type="button"
            onClick={() => downloadCsv(exportRows, exportCols, exportName)}
            disabled={exportRows.length === 0}
            className="text-ash hover:text-bone hover:border-white/25 flex h-9 items-center gap-2 rounded-md border border-white/[0.12] px-3 text-[12.5px] transition-colors disabled:opacity-40"
          >
            <Download className="size-3.5" strokeWidth={2} />
            CSV
          </button>
          <button
            type="button"
            onClick={() => void downloadXlsx(exportRows, exportCols, exportName)}
            disabled={exportRows.length === 0}
            className="text-ash hover:text-bone hover:border-white/25 flex h-9 items-center gap-2 rounded-md border border-white/[0.12] px-3 text-[12.5px] transition-colors disabled:opacity-40"
          >
            <FileSpreadsheet className="size-3.5" strokeWidth={2} />
            Excel
          </button>
        </div>
      </div>

      <div className={cn(frame && "overflow-hidden rounded-md border border-white/[0.09]")}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-void/50">
              <tr className="text-dim font-mono text-[10.5px] tracking-[0.14em] uppercase">
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all rows on this page"
                    checked={allOnPage}
                    onChange={toggleAll}
                    className="accent-blaze size-3.5 align-middle"
                  />
                </th>
                <th className="w-12 px-2 py-3 font-normal">#</th>
                {expandable ? <th className="w-9" /> : null}
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className={cn("px-4 py-3 font-normal", c.align === "right" && "text-right")}
                  >
                    {c.value ? (
                      <button
                        type="button"
                        onClick={() =>
                          setSort((s) =>
                            s?.key === c.key
                              ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" }
                              : { key: c.key, dir: "asc" },
                          )
                        }
                        className={cn(
                          // A button does not inherit font-family, so a sortable header would
                          // otherwise sit in the body face beside its mono neighbours.
                          "hover:text-bone inline-flex items-center gap-1.5 font-mono transition-colors",
                          sort?.key === c.key && "text-bone",
                          c.align === "right" && "flex-row-reverse",
                        )}
                      >
                        {c.header}
                        {sort?.key === c.key ? (
                          sort.dir === "asc" ? (
                            <ArrowUp className="size-3" strokeWidth={2.4} />
                          ) : (
                            <ArrowDown className="size-3" strokeWidth={2.4} />
                          )
                        ) : null}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((row, i) => {
                const id = rowId(row)
                return (
                  <React.Fragment key={id}>
                  <tr
                    className={cn(
                      "border-t border-white/[0.07] transition-colors",
                      picked.has(id) ? "bg-blaze/[0.06]" : "hover:bg-white/[0.02]",
                    )}
                  >
                    <td className="px-3 py-3.5">
                      <input
                        type="checkbox"
                        aria-label={`Select row ${start + i + 1}`}
                        checked={picked.has(id)}
                        onChange={() => toggleOne(id)}
                        className="accent-blaze size-3.5 align-middle"
                      />
                    </td>
                    <td className="text-dim px-2 py-3.5 font-mono text-[12px]">{start + i + 1}</td>
                    {expandable ? (
                      <td className="px-1 py-3.5">
                        <button
                          type="button"
                          onClick={() =>
                            setOpen((o) => {
                              const next = new Set(o)
                              if (next.has(id)) next.delete(id)
                              else next.add(id)
                              return next
                            })
                          }
                          aria-expanded={open.has(id)}
                          aria-label={open.has(id) ? "Hide detail" : "Show detail"}
                          className="text-dim hover:text-bone transition-colors"
                        >
                          <ChevronDown
                            className={cn("size-4 transition-transform", !open.has(id) && "-rotate-90")}
                            strokeWidth={2}
                          />
                        </button>
                      </td>
                    ) : null}
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          "px-4 py-3.5 align-middle",
                          c.align === "right" && "text-right",
                          c.className,
                        )}
                      >
                        {c.cell ? c.cell(row) : (c.value?.(row) ?? "-")}
                      </td>
                    ))}
                  </tr>
                  {expandable && open.has(id) ? (
                    <tr className="border-t border-white/[0.05]">
                      <td colSpan={columns.length + 3} className="px-4 pb-5">
                        {expandable(row)}
                      </td>
                    </tr>
                  ) : null}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>

        {shown.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-dim text-[13.5px]">
              {loading ? "Loading…" : (empty ?? "Nothing here yet.")}
            </p>
          </div>
        ) : null}
      </div>

      {truncated ? (
        <p className="text-ember mt-3 text-[12px] leading-[1.5]">
          Showing the first {rows.length} of {total}. Sorting and export cover these
          rows only - narrow the search to reach the rest.
        </p>
      ) : null}

      {totalPages > 1 ? (
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-dim font-mono text-[11px]">
            {start + 1}–{Math.min(start + pageSize, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={current === 1}
              aria-label="Previous page"
              className="text-ash hover:text-bone hover:border-white/25 flex size-8 items-center justify-center rounded-md border border-white/[0.12] transition-colors disabled:opacity-30"
            >
              <ChevronLeft className="size-4" strokeWidth={2} />
            </button>
            <span className="text-ash px-2 font-mono text-[12px]">
              {current} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={current === totalPages}
              aria-label="Next page"
              className="text-ash hover:text-bone hover:border-white/25 flex size-8 items-center justify-center rounded-md border border-white/[0.12] transition-colors disabled:opacity-30"
            >
              <ChevronRight className="size-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
