"use client"

import * as React from "react"
import Link from "next/link"
import { Users } from "lucide-react"

import { Money } from "@/components/shared/money"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, type Column, type DataTableHandle } from "@/components/ui/data-table"
import { ExportMenu } from "@/components/ui/export-menu"
import { TableSearch } from "@/components/ui/table-search"
import type { CustomerRow } from "@/features/customers/server/customers.service"
import { apiFetch } from "@/lib/api-fetch"
import { MAX_PAGE_SIZE } from "@/lib/constants"

type Payload = {
  data: CustomerRow[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

// Everyone who has paid for an order. Unpaid ones are in Abandoned carts.

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
  const table = React.useRef<DataTableHandle<CustomerRow>>(null)

  React.useEffect(() => {
    let cancelled = false
    // Debounced search.
    const timer = window.setTimeout(
      async () => {
        setLoading(true)
        try {
          // The whole window: the table sorts and exports what it holds.
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
      value: (c) => c.name ?? c.email,
      // The name is the link, not the row: a row link would fight the selection checkbox.
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
      cell: (c) => <span className="text-ash font-mono text-[12.5px]">{c.phone ?? "-"}</span>,
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
      // Money arrives as a string: sort it as a number.
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
      value: (c) => c.lastOrderAt ?? "",
      cell: (c) => <span className="text-ash font-mono text-[12px]">{day(c.lastOrderAt)}</span>,
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={Users}
        title="Customers"
        actions={<ExportMenu table={table} noun={["customer", "customers"]} />}
      />

      {error ? (
        <div className="border-magenta/35 bg-magenta/[0.06] rounded-md border p-5">
          <p className="text-bone text-[14px]">{error}</p>
        </div>
      ) : (
        <DataTable
          handle={table}
          rows={rows}
          columns={columns}
          rowId={(c) => c.id}
          exportName="customers"
          exportButtons={false}
          pageKey={search}
          bar={
            <TableSearch
              value={search}
              onChange={setSearch}
              placeholder="Name, email or phone"
              label="Search customers by name, email or phone"
            />
          }
          loading={loading}
          total={total}
          empty={search ? "Nobody matches that." : "No buyers yet. The first paid order adds one."}
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
