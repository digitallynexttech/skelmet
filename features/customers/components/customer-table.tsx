"use client"

import * as React from "react"
import Link from "next/link"
import { Search } from "lucide-react"

import { Money } from "@/components/shared/money"
import { DataTable, type Column } from "@/components/ui/data-table"
import { Input } from "@/components/ui/input"
import type { CustomerRow } from "@/features/customers/server/customers.service"
import { apiFetch } from "@/lib/api-fetch"
import { MAX_PAGE_SIZE } from "@/lib/constants"

type Payload = {
  data: CustomerRow[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

/**
 * Everyone who has ever bought. There are no customer accounts, so these rows
 * are written by checkout rather than by anyone signing up - which means this
 * list is the only place the shop's customers exist as people rather than as
 * a column on an order.
 */

const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "-"

export function CustomerTable() {
  const [rows, setRows] = React.useState<CustomerRow[]>([])
  const [total, setTotal] = React.useState(0)
  const [search, setSearch] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    // Debounced: the search box hits the database on every keystroke otherwise.
    const timer = window.setTimeout(
      async () => {
        setLoading(true)
        try {
          // The whole window, not a page of twenty: the table sorts and exports
          // what it holds, so a short fetch would quietly make both partial.
          const params = new URLSearchParams({ pageSize: String(MAX_PAGE_SIZE) })
          if (search.trim()) params.set("search", search.trim())
          const res = await apiFetch<Payload>(`/api/admin/customers?${params}`)
          if (cancelled) return
          setRows(res.data)
          setTotal(res.pagination.total)
          setError(null)
        } catch (err) {
          if (!cancelled) setError(err instanceof Error ? err.message : "Could not load customers.")
        } finally {
          if (!cancelled) setLoading(false)
        }
      },
      search ? 300 : 0,
    )
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [search])

  const columns: Column<CustomerRow>[] = [
    {
      key: "customer",
      header: "Customer",
      // Sorts on the name people read, falling back to the email for the rows
      // that have no name yet.
      value: (c) => c.name ?? c.email,
      // The name is the link, not the whole row: a clickable row and a
      // selection checkbox fight over the same click.
      cell: (c) => (
        <Link href={`/admin/customers/${c.id}`} className="group block">
          <div className="text-bone group-hover:text-blaze text-[14px] font-semibold transition-colors">
            {c.name ?? "Unnamed customer"}
          </div>
          <div className="text-dim font-mono text-[11.5px]">{c.email}</div>
        </Link>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      value: (c) => c.phone ?? "",
      cell: (c) => (
        <span className="text-ash font-mono text-[12.5px]">{c.phone ?? "-"}</span>
      ),
    },
    {
      key: "city",
      header: "City",
      value: (c) => c.city ?? "",
      cell: (c) => <span className="text-ash text-[13.5px]">{c.city ?? "-"}</span>,
    },
    {
      key: "orders",
      header: "Orders",
      align: "right",
      value: (c) => c.orderCount,
      cell: (c) => <span className="text-bone font-mono text-[13px]">{c.orderCount}</span>,
    },
    {
      key: "spent",
      header: "Spent",
      align: "right",
      // Money is a string on the wire; sort and export it as a number or
      // "₹1,000" lands between "₹10" and "₹2".
      value: (c) => Number(c.totalSpent),
      cell: (c) => (
        <span className="text-bone text-[13.5px]">
          <Money value={c.totalSpent} />
        </span>
      ),
    },
    {
      key: "last",
      header: "Last order",
      align: "right",
      // Sorts on the raw ISO string, which orders correctly; the cell shows
      // the readable form.
      value: (c) => c.lastOrderAt ?? "",
      cell: (c) => <span className="text-ash font-mono text-[12px]">{day(c.lastOrderAt)}</span>,
    },
  ]

  return (
    <div>
      <div className="mb-6">
        <div className="text-dim mb-2 font-mono text-[10.5px] tracking-[0.18em] uppercase">
          Console
        </div>
        <h1 className="font-display text-bone mb-1 text-[38px] leading-[1.02] uppercase sm:text-[44px]">
          Customers
        </h1>
        <p className="text-ash text-[14.5px]">
          {total} {total === 1 ? "person has" : "people have"} bought. No accounts - these are
          written when an order is placed.
        </p>
      </div>

      <div className="rounded-md bg-carbon relative mb-4 flex items-center gap-2.5 border border-white/10 px-4">
        <Search className="text-dim size-4 shrink-0" strokeWidth={1.9} />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, email or phone"
          className="h-[50px] border-0 bg-transparent px-0 text-[14px] focus:ring-0"
        />
      </div>

      {error ? (
        <div className="border-magenta/35 bg-magenta/[0.06] rounded-md border p-5">
          <p className="text-bone text-[14px]">{error}</p>
        </div>
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowId={(c) => c.id}
          exportName="customers"
          loading={loading}
          total={total}
          empty={search ? "Nobody matches that." : "No customers yet. The first order creates one."}
          exportColumns={[
            { header: "Name", value: (c) => c.name ?? "" },
            { header: "Email", value: (c) => c.email },
            { header: "Phone", value: (c) => c.phone ?? "" },
            { header: "City", value: (c) => c.city ?? "" },
            { header: "Orders", value: (c) => c.orderCount },
            { header: "Spent", value: (c) => Number(c.totalSpent) },
            { header: "Last order", value: (c) => day(c.lastOrderAt) },
          ]}
        />
      )}
    </div>
  )
}
