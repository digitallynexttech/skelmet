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
 *
 * Cells never wrap: each column is as wide as its longest line, and the table
 * scrolls sideways when that is wider than the screen. Squeezed to fit, it
 * broke an order number over three lines at its hyphens and a two-word header
 * over two. A cell that stacks lines on purpose - a name over an email -
 * still stacks; only the lines themselves stay whole. The expanded detail row
 * wraps as prose, since that is what it holds.
 *
 * A screen can also ask for the fuller kit - controls inside the frame (bar),
 * a column picker, a choice of rows per page - and export from its own
 * header through `handle`. The picker and the page size are remembered per
 * table (by exportName) in this browser.
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
  /** The CSV and Excel buttons over the table. Off where the page has its own Export. */
  exportButtons?: boolean
  /** For a page that exports from its own header. */
  handle?: React.Ref<DataTableHandle<T>>
  /** Controls inside the frame, over the table, on the left: tabs, say. */
  bar?: React.ReactNode
  /** And on the right, before the column picker: search and filters. */
  barEnd?: React.ReactNode
  /** A menu to hide and show columns. */
  columnToggle?: boolean
  /** Rows per page to choose from, in the footer. Include pageSize. */
  pageSizes?: readonly number[]
  /** When this changes the table goes back to its first page: a new tab or filter. */
  pageKey?: string
  /** The # column of row numbers. Exports number their rows either way. */
  numbered?: boolean
}

export type DataTableHandle<T> = {
  /** The ticked rows that are still listed. */
  selectedRows: () => T[]
  /** What an export holds now: the ticked rows, or else every row listed. */
  exportRows: () => T[]
  download: (format: "csv" | "xlsx") => void
}

/** The hidden columns as stored: a JSON list of keys, or anything else as none. */
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
  columnToggle = false,
  pageSizes,
  pageKey,
  numbered = true,
}: Props<T>) {
  const [sort, setSort] = React.useState<{ key: string; dir: "asc" | "desc" } | null>(null)
  const [page, setPage] = React.useState(1)
  const [picked, setPicked] = React.useState<Set<string>>(new Set())
  const [open, setOpen] = React.useState<Set<string>>(new Set())

  // A new tab or filter starts on page one, not on whatever page the last
  // one was left at. Adjusted during render, as React has it for state that
  // follows a prop.
  const [seenKey, setSeenKey] = React.useState(pageKey)
  if (pageKey !== seenKey) {
    setSeenKey(pageKey)
    setPage(1)
  }

  const defaultHidden = JSON.stringify(columns.filter((c) => c.defaultHidden).map((c) => c.key))
  const [hiddenRaw, setHiddenRaw] = useStoredState(`skm.table.${exportName}.hidden`, defaultHidden)
  const [sizeRaw, setSizeRaw] = useStoredState(`skm.table.${exportName}.size`, String(pageSize))
  const size = pageSizes?.includes(Number(sizeRaw)) ? Number(sizeRaw) : pageSize

  const hidden = React.useMemo(
    () => (columnToggle ? parseHidden(hiddenRaw) : new Set<string>()),
    [columnToggle, hiddenRaw],
  )
  const shownColumns = columns.filter((c) => !hidden.has(c.key))
  // Columns renamed since the choice was stored can leave none: show them all.
  const visible = shownColumns.length > 0 ? shownColumns : columns

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

  const totalPages = Math.max(1, Math.ceil(sorted.length / size))
  const current = Math.min(page, totalPages)
  const start = (current - 1) * size
  const shown = sorted.slice(start, start + size)

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
  // Counted over the rows still listed: a ticked row that a filter or a
  // search has since hidden is neither shown as selected nor exported.
  const pickedRows = picked.size > 0 ? sorted.filter((r) => picked.has(rowId(r))) : []
  const exportRows = pickedRows.length > 0 ? pickedRows : sorted

  function download(format: "csv" | "xlsx") {
    if (format === "csv") return downloadCsv(exportRows, exportCols, exportName)
    // The spreadsheet library is fetched on first use, so a dropped
    // connection fails here - say so rather than doing nothing.
    void downloadXlsx(exportRows, exportCols, exportName).catch(() =>
      toast.error("Could not build the Excel file. Try again, or export as CSV."),
    )
  }

  React.useImperativeHandle(handle, () => ({
    selectedRows: () => pickedRows,
    exportRows: () => exportRows,
    download,
  }))

  const inFrame = bar != null || barEnd != null
  const selecting = inFrame && pickedRows.length > 0
  const topRow = exportButtons || toolbar != null || (columnToggle && !inFrame)

  const selection =
    pickedRows.length > 0 ? (
      <button
        type="button"
        onClick={() => setPicked(new Set())}
        className="text-acid hover:text-bone transition-colors"
      >
        {pickedRows.length} selected · clear
      </button>
    ) : null

  const columnsMenu = columnToggle ? (
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
            // One always stays: a table of no columns is just row numbers.
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

  /**
   * Where the rows are and how many to a page. Always there once the reader
   * can choose the page size, or when the count has nowhere else to go;
   * otherwise only when there is more than one page.
   */
  const footer =
    !pageSizes && topRow && totalPages === 1 ? null : (
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5",
          inFrame ? "border-t border-white/[0.07] px-3 py-2.5" : "mt-3",
        )}
      >
        <div className="text-dim flex items-center gap-3 font-mono text-[11px] tracking-[0.06em]">
          {topRow || inFrame ? null : selection}
          <span>
            {sorted.length === 0
              ? "0 rows"
              : `${start + 1}–${Math.min(start + size, sorted.length)} of ${sorted.length}`}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {pageSizes ? (
            <div className="flex items-center gap-2">
              <span className="text-dim text-[12.5px]">Rows per page</span>
              <Select
                label="Rows per page"
                size="sm"
                placement="top"
                value={String(size)}
                onChange={(next) => {
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
              onClick={() => setPage((p) => Math.max(1, p - 1))}
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
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
                {sorted.length} {sorted.length === 1 ? "row" : "rows"}
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

      {/* With controls inside it the frame cannot clip: their menus open
          over the table and past its foot. */}
      <div
        className={cn(
          frame && "rounded-md border border-white/[0.09]",
          frame && !inFrame && "overflow-hidden",
        )}
      >
        {inFrame ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-white/[0.07] px-3 py-2.5">
            <div className="min-w-0 flex-[1_1_360px]">{bar}</div>
            <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto sm:flex-nowrap">
              {barEnd}
              {columnsMenu}
            </div>
          </div>
        ) : null}

        {/* Contained on the inline axis, so a table wider than the screen
            scrolls in here instead of reporting its width upward: in a grid
            or flex column, that width stretched the whole page sideways. */}
        <div className="scrollbar-visible overflow-x-auto contain-inline-size">
          <table className="w-full text-left">
            <thead className="bg-void/50">
              <tr className="text-dim font-mono text-[10.5px] tracking-[0.14em] whitespace-nowrap uppercase">
                <th className="relative w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label="Select all rows on this page"
                    checked={allOnPage}
                    onChange={toggleAll}
                    className="accent-blaze size-3.5 align-middle"
                  />
                  {/* With rows ticked, the headings give way to the count, as
                      Shopify has it. They are hidden rather than removed, so
                      no column changes width under the pointer. */}
                  {selecting ? (
                    <span className="absolute inset-y-0 left-full flex items-center gap-3 pl-2 font-sans text-[13px] tracking-normal whitespace-nowrap normal-case">
                      <span className="text-bone font-semibold">{pickedRows.length} selected</span>
                      <button
                        type="button"
                        onClick={() => setPicked(new Set())}
                        className="text-ash hover:text-bone underline-offset-4 transition-colors hover:underline"
                      >
                        Clear
                      </button>
                    </span>
                  ) : null}
                </th>
                {numbered ? (
                  <th className={cn("w-12 px-2 py-3 font-normal", selecting && "invisible")}>#</th>
                ) : null}
                {expandable ? <th className="w-9" /> : null}
                {visible.map((c) => (
                  <th
                    key={c.key}
                    className={cn(
                      "px-4 py-3 font-normal",
                      c.align === "right" && "text-right",
                      selecting && "invisible",
                    )}
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
                        <td colSpan={visible.length + (numbered ? 3 : 2)} className="px-4 pb-5">
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
