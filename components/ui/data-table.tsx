"use client"

import * as React from "react"
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  FileSpreadsheet,
} from "lucide-react"
import { toast } from "sonner"

import { Menu, MenuCheckbox, MenuItem, MenuLabel, MenuSeparator } from "@/components/ui/menu"
import { Select } from "@/components/ui/select"
import { useStoredState } from "@/hooks/use-stored-state"
import { downloadCsv, downloadXlsx, type ExportColumn } from "@/lib/export"
import { cn } from "@/lib/utils"

/**
 * The one table every admin screen uses. Sorting, paging and export run over the rows handed in,
 * so the screen must fetch the whole set (up to MAX_PAGE_SIZE); pass `total` when the server held
 * rows back so the table says so, or `server` to page on the server instead. Cells never wrap; the
 * table scrolls sideways instead. Hidden columns and page size are remembered per exportName in
 * this browser.
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
  /** Starts hidden where the table has a column picker, until someone shows it. */
  defaultHidden?: boolean
}

export type TableSort = { key: string; dir: "asc" | "desc" }

/** Paged on the server: `rows` is one page, and the caller fetches each page and order. */
export type ServerPaging<T> = {
  page: number
  pageSize: number
  total: number
  sort: TableSort | null
  /** Columns the server sorts by; the rest are unsortable. */
  sortable: readonly string[]
  onPage: (page: number) => void
  onPageSize: (size: number) => void
  onSort: (sort: TableSort) => void
  /** Every matching row, for an export with nothing ticked. */
  exportAll: () => Promise<T[]>
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
  /** What the export contains, when that differs from what the table shows. */
  exportColumns?: ExportColumn<T>[]
  /** Draws the bordered frame. Off when the table already sits inside a card. */
  frame?: boolean
  /** How many rows match on the server, when more than were sent; the table then warns. */
  total?: number
  /** Detail for one row, revealed on demand, for text a cell cannot hold. */
  expandable?: (row: T) => React.ReactNode
  /** The CSV and Excel buttons over the table. Off where the page has its own Export. */
  exportButtons?: boolean
  /** For a page that exports from its own header. */
  handle?: React.Ref<DataTableHandle<T>>
  /** Controls inside the frame, over the table, on the left: tabs, say. */
  bar?: React.ReactNode
  /** And on the right, before the column picker: search and filters. */
  barEnd?: React.ReactNode
  columnToggle?: boolean
  /** Rows per page to choose from, in the footer. Include pageSize. */
  pageSizes?: readonly number[]
  /** When this changes the table goes back to its first page: a new tab or filter. */
  pageKey?: string
  /** The # column. Exports number their rows either way. */
  numbered?: boolean
  /** A few rows on a record's page: no ticking, column picker, export or page size. */
  compact?: boolean
  rowClassName?: (row: T) => string | undefined
  server?: ServerPaging<T>
  /** New rows are on their way: the old ones stay, dimmed. */
  busy?: boolean
}

export type DataTableHandle<T> = {
  /** The ticked rows that are still listed. */
  selectedRows: () => T[]
  /** The ticked rows, or else every row listed (one page of a server-paged table). */
  exportRows: () => T[]
  /** How many rows an export holds: on a server-paged table, every match. */
  exportCount: () => number
  download: (format: "csv" | "xlsx") => void
}

const PAGE_SIZES = [10, 20, 50, 100]

// Anything but a JSON list of keys reads as none hidden.
function parseHidden(raw: string): Set<string> {
  try {
    const list: unknown = JSON.parse(raw)
    return new Set(Array.isArray(list) ? list.filter((k) => typeof k === "string") : [])
  } catch {
    return new Set()
  }
}

const iconButton =
  "text-ash hover:text-bone flex size-9 shrink-0 items-center justify-center rounded-sm border border-white/[0.12] transition-colors hover:border-white/25 aria-expanded:border-white/25 aria-expanded:text-bone"

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
  exportButtons = true,
  handle,
  bar,
  barEnd,
  columnToggle = true,
  pageSizes = PAGE_SIZES,
  pageKey,
  numbered = false,
  rowClassName,
  compact = false,
  server,
  busy = false,
}: Props<T>) {
  const [localSort, setLocalSort] = React.useState<TableSort | null>(null)
  const sort = server ? server.sort : localSort
  const [page, setPage] = React.useState(1)
  // Ticked rows by id. Kept whole, so a server-paged table remembers ticks on other pages.
  const [picked, setPicked] = React.useState<Map<string, T>>(new Map())
  const [open, setOpen] = React.useState<Set<string>>(new Set())

  // Reset to page one during render, React's pattern for state that follows a prop.
  const [seenKey, setSeenKey] = React.useState(pageKey)
  if (pageKey !== seenKey) {
    setSeenKey(pageKey)
    setPage(1)
    // Rows on other pages are unseen: a new filter may have dropped them.
    if (server) setPicked(new Map())
  }

  const defaultHidden = JSON.stringify(columns.filter((c) => c.defaultHidden).map((c) => c.key))
  const [hiddenRaw, setHiddenRaw] = useStoredState(`skm.table.${exportName}.hidden`, defaultHidden)
  const [sizeRaw, setSizeRaw] = useStoredState(`skm.table.${exportName}.size`, String(pageSize))
  const size = server
    ? server.pageSize
    : pageSizes?.includes(Number(sizeRaw))
      ? Number(sizeRaw)
      : pageSize

  const hidden = React.useMemo(
    () => (columnToggle ? parseHidden(hiddenRaw) : new Set<string>()),
    [columnToggle, hiddenRaw],
  )
  const shownColumns = columns.filter((c) => !hidden.has(c.key))
  // Columns renamed since the choice was stored can leave none: show them all.
  const visible = shownColumns.length > 0 ? shownColumns : columns

  const sorted = React.useMemo(() => {
    if (server || !sort) return rows
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
  }, [server, rows, sort, columns])

  function changeSort(key: string) {
    const next: TableSort =
      sort?.key === key ? { key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }
    if (server) server.onSort(next)
    else setLocalSort(next)
  }

  const count = server ? server.total : sorted.length
  const totalPages = Math.max(1, Math.ceil(count / size))
  const current = Math.min(server ? server.page : page, totalPages)
  const start = (current - 1) * size
  const shown = server ? rows : sorted.slice(start, start + size)

  // A filter upstream can shrink the list under the current page.
  if (!server && page !== current) setPage(current)
  const goTo = (n: number) => (server ? server.onPage(n) : setPage(n))

  const allOnPage = shown.length > 0 && shown.every((r) => picked.has(rowId(r)))

  function toggleAll() {
    const next = new Map(picked)
    for (const r of shown) {
      if (allOnPage) next.delete(rowId(r))
      else next.set(rowId(r), r)
    }
    setPicked(next)
  }

  function toggleOne(row: T) {
    const next = new Map(picked)
    const id = rowId(row)
    if (next.has(id)) next.delete(id)
    else next.set(id, row)
    setPicked(next)
  }

  const truncated = !server && typeof total === "number" && total > rows.length

  const exportColsFor = (list: T[]): ExportColumn<T>[] => {
    // A map, not indexOf in the accessor, which would make export O(n^2).
    const rank = new Map(list.map((r, i) => [rowId(r), i + 1]))
    return [
      { header: "S.No", value: (r) => rank.get(rowId(r)) ?? 0 },
      ...(exportColumns ??
        columns
          .filter((c) => c.value)
          .map((c) => ({ header: c.header, value: (r: T) => c.value!(r) }))),
    ]
  }

  // Export takes the ticked rows if any, else all. A ticked row a filter has since hidden is
  // neither counted nor exported; on a server-paged table every tick counts until a new filter.
  const pickedRows = server
    ? [...picked.values()]
    : picked.size > 0
      ? sorted.filter((r) => picked.has(rowId(r)))
      : []
  const exportRows = pickedRows.length > 0 ? pickedRows : sorted
  const exportCount = pickedRows.length > 0 ? pickedRows.length : count

  async function download(format: "csv" | "xlsx") {
    let list = exportRows
    if (server && pickedRows.length === 0) {
      const gathering = toast.loading(`Gathering ${server.total} rows...`)
      try {
        list = await server.exportAll()
      } catch {
        toast.error("Could not fetch every row. Try again.")
        return
      } finally {
        toast.dismiss(gathering)
      }
    }
    // Numbered by place in the full list, so ticked rows keep the numbers the table shows.
    const cols = exportColsFor(server ? list : sorted)
    if (format === "csv") return downloadCsv(list, cols, exportName)
    // The spreadsheet library loads on first use, so this can fail on a dropped connection.
    await downloadXlsx(list, cols, exportName).catch(() =>
      toast.error("Could not build the Excel file. Try again, or export as CSV."),
    )
  }

  React.useImperativeHandle(handle, () => ({
    selectedRows: () => pickedRows,
    exportRows: () => exportRows,
    exportCount: () => exportCount,
    download: (format) => void download(format),
  }))

  const inFrame = bar != null || barEnd != null
  const selecting = inFrame && pickedRows.length > 0
  const topRow = !compact && (exportButtons || toolbar != null || (columnToggle && !inFrame))

  const selection =
    pickedRows.length > 0 ? (
      <button
        type="button"
        onClick={() => setPicked(new Map())}
        className="text-acid hover:text-bone transition-colors"
      >
        {pickedRows.length} selected · clear
      </button>
    ) : null

  const columnsMenu =
    columnToggle && !compact ? (
      <Menu
        label="Show or hide columns"
        button={<Columns3 className="size-4" strokeWidth={1.9} />}
        buttonClassName={iconButton}
      >
        <MenuLabel>Columns</MenuLabel>
        {columns.map((c) => {
          const on = visible.includes(c)
          return (
            <MenuCheckbox
              key={c.key}
              checked={on}
              // The last visible column cannot be hidden.
              disabled={on && visible.length === 1}
              onChange={(next) => {
                const keys = new Set(hidden)
                if (next) keys.delete(c.key)
                else keys.add(c.key)
                setHiddenRaw(JSON.stringify([...keys]))
              }}
            >
              {c.header}
            </MenuCheckbox>
          )
        })}
        {hidden.size > 0 ? (
          <>
            <MenuSeparator />
            <MenuItem onSelect={() => setHiddenRaw("[]")}>Show all columns</MenuItem>
          </>
        ) : null}
      </Menu>
    ) : null

  // Shown when there is a page size to choose or the count has nowhere else to go; else only
  // when there is more than one page.
  const footer =
    (compact || (!pageSizes && topRow)) && totalPages === 1 ? null : (
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5",
          inFrame ? "border-t border-white/[0.07] px-3 py-2.5" : "mt-3",
        )}
      >
        <div className="text-dim flex items-center gap-3 font-mono text-[11px] tracking-[0.06em]">
          {topRow || inFrame ? null : selection}
          <span>
            {count === 0 ? "0 rows" : `${start + 1}–${Math.min(start + size, count)} of ${count}`}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {pageSizes && !compact ? (
            <div className="flex items-center gap-2">
              <span className="text-dim text-[12.5px]">Rows per page</span>
              <Select
                label="Rows per page"
                size="sm"
                placement="top"
                value={String(size)}
                onChange={(next) => {
                  if (server) {
                    server.onPageSize(Number(next))
                    return
                  }
                  setSizeRaw(next)
                  setPage(1)
                }}
                options={pageSizes.map((n) => ({ value: String(n), label: String(n) }))}
                className="w-[76px]"
              />
            </div>
          ) : null}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => goTo(Math.max(1, current - 1))}
              disabled={current === 1}
              aria-label="Previous page"
              className="text-ash hover:text-bone flex size-8 items-center justify-center rounded-md border border-white/[0.12] transition-colors hover:border-white/25 disabled:opacity-30"
            >
              <ChevronLeft className="size-4" strokeWidth={2} />
            </button>
            <span className="text-ash px-1.5 font-mono text-[12px] whitespace-nowrap">
              {current} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => goTo(Math.min(totalPages, current + 1))}
              disabled={current === totalPages}
              aria-label="Next page"
              className="text-ash hover:text-bone flex size-8 items-center justify-center rounded-md border border-white/[0.12] transition-colors hover:border-white/25 disabled:opacity-30"
            >
              <ChevronRight className="size-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>
    )

  return (
    <div>
      {topRow ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-dim font-mono text-[11px] tracking-[0.1em]">
            {selection ?? (
              <span>
                {count} {count === 1 ? "row" : "rows"}
                {truncated ? " of " + total : null}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {toolbar}
            {inFrame ? null : columnsMenu}
            {exportButtons ? (
              <>
                <button
                  type="button"
                  onClick={() => download("csv")}
                  disabled={exportRows.length === 0}
                  className="text-ash hover:text-bone flex h-9 items-center gap-2 rounded-md border border-white/[0.12] px-3 text-[12.5px] transition-colors hover:border-white/25 disabled:opacity-40"
                >
                  <Download className="size-3.5" strokeWidth={2} />
                  CSV
                </button>
                <button
                  type="button"
                  onClick={() => download("xlsx")}
                  disabled={exportRows.length === 0}
                  className="text-ash hover:text-bone flex h-9 items-center gap-2 rounded-md border border-white/[0.12] px-3 text-[12.5px] transition-colors hover:border-white/25 disabled:opacity-40"
                >
                  <FileSpreadsheet className="size-3.5" strokeWidth={2} />
                  Excel
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* With controls inside, the frame cannot clip: their menus open past its foot. */}
      <div
        className={cn(
          frame && "rounded-md border border-white/[0.09]",
          frame && !inFrame && "overflow-hidden",
        )}
      >
        {inFrame ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-white/[0.07] px-3 py-2.5">
            <div className={cn("min-w-0", barEnd != null ? "flex-[1_1_360px]" : "flex-1")}>
              {bar}
            </div>
            <div
              className={cn(
                "flex items-center gap-2",
                barEnd != null ? "w-full flex-wrap sm:ml-auto sm:w-auto sm:flex-nowrap" : "ml-auto",
              )}
            >
              {barEnd}
              {columnsMenu}
            </div>
          </div>
        ) : null}

        {/* contain-inline-size: a wide table scrolls here instead of widening the page. */}
        <div className="scrollbar-visible overflow-x-auto contain-inline-size">
          <table className="w-full text-left">
            <thead className="bg-void/50">
              <tr className="text-ash text-[12.5px] font-semibold whitespace-nowrap">
                {compact ? null : (
                  <th className="relative w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all rows on this page"
                      checked={allOnPage}
                      onChange={toggleAll}
                      className="accent-blaze size-3.5 align-middle"
                    />
                    {/* Headings go invisible, not removed, so no column changes width. */}
                    {selecting ? (
                      <span className="absolute inset-y-0 left-full flex items-center gap-3 pl-2 text-[13px] whitespace-nowrap">
                        <span className="text-bone font-semibold">
                          {pickedRows.length} selected
                        </span>
                        <button
                          type="button"
                          onClick={() => setPicked(new Map())}
                          className="text-ash hover:text-bone underline-offset-4 transition-colors hover:underline"
                        >
                          Clear
                        </button>
                      </span>
                    ) : null}
                  </th>
                )}
                {numbered ? (
                  <th className={cn("w-12 px-2 py-3", selecting && "invisible")}>#</th>
                ) : null}
                {expandable ? <th className="w-9" /> : null}
                {visible.map((c) => (
                  <th
                    key={c.key}
                    className={cn(
                      "px-4 py-3",
                      c.align === "right" && "text-right",
                      selecting && "invisible",
                    )}
                  >
                    {c.value && (!server || server.sortable.includes(c.key)) ? (
                      <button
                        type="button"
                        onClick={() => changeSort(c.key)}
                        className={cn(
                          // A button does not inherit font weight and face from the row.
                          "hover:text-bone inline-flex items-center gap-1.5 font-sans font-semibold transition-colors",
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
            <tbody
              aria-busy={busy || undefined}
              className={cn("transition-opacity", busy && "opacity-50")}
            >
              {shown.map((row, i) => {
                const id = rowId(row)
                return (
                  <React.Fragment key={id}>
                    <tr
                      className={cn(
                        "border-t border-white/[0.07] transition-colors",
                        picked.has(id) ? "bg-blaze/[0.06]" : "hover:bg-white/[0.02]",
                        rowClassName?.(row),
                      )}
                    >
                      {compact ? null : (
                        <td className="px-3 py-3.5">
                          <input
                            type="checkbox"
                            aria-label={`Select row ${start + i + 1}`}
                            checked={picked.has(id)}
                            onChange={() => toggleOne(row)}
                            className="accent-blaze size-3.5 align-middle"
                          />
                        </td>
                      )}
                      {numbered ? (
                        <td className="text-dim px-2 py-3.5 font-mono text-[12px]">
                          {start + i + 1}
                        </td>
                      ) : null}
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
                              className={cn(
                                "size-4 transition-transform",
                                !open.has(id) && "-rotate-90",
                              )}
                              strokeWidth={2}
                            />
                          </button>
                        </td>
                      ) : null}
                      {visible.map((c) => (
                        <td
                          key={c.key}
                          className={cn(
                            "px-4 py-3.5 align-middle whitespace-nowrap",
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
                        <td
                          colSpan={visible.length + (numbered ? 1 : 0) + (compact ? 1 : 2)}
                          className="px-4 pb-5"
                        >
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

        {inFrame ? footer : null}
      </div>

      {truncated ? (
        <p className="text-ember mt-3 text-[12px] leading-[1.5]">
          Showing the first {rows.length} of {total}. Sorting and export cover these rows only -
          narrow the search to reach the rest.
        </p>
      ) : null}

      {inFrame ? null : footer}
    </div>
  )
}
