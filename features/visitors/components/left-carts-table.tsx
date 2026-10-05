"use client"

import * as React from "react"
import Link from "next/link"

import { EmptyState } from "@/components/shared/empty-state"
import { Money } from "@/components/shared/money"
import { Badge } from "@/components/ui/badge"
import { DataTable, type Column, type DataTableHandle } from "@/components/ui/data-table"
import { TableSearch } from "@/components/ui/table-search"
import { ViewMenu } from "@/components/ui/view-menu"
import { ContactActions } from "@/features/visitors/components/contact-actions"
import { useLeftCarts, type LeftCartRow } from "@/features/visitors/hooks/use-visitors"
import { ago, deviceLine, placeLine, visitorName, when } from "@/features/visitors/lib/format"

type Show = "all" | "contact" | "checkout"

const itemsText = (r: LeftCartRow) =>
  r.items.map((i) => `${i.qty} × ${i.name} (${i.colourway})`).join(", ")

function message(r: LeftCartRow): string {
  const first = r.name?.split(" ")[0] || "there"
  return `Hi ${first}, this is SKELMET. You left ${itemsText(r)} in your cart. Want a hand finishing your order?`
}

const who = (r: LeftCartRow) => visitorName({ ...r, id: r.visitorId })

/**
 * Carts filled and never turned into an order. A visitor who accepted cookies
 * and typed their details at checkout can be contacted; an anonymous one can
 * only be counted - which is still worth knowing: it says what people want
 * and where they stop.
 */
export function LeftCartsTable({
  handle,
}: {
  /** For Export in the page's header. */
  handle?: React.Ref<DataTableHandle<LeftCartRow>>
}) {
  const { data, isLoading, isError, error } = useLeftCarts()
  const [show, setShow] = React.useState<Show>("all")
  const [query, setQuery] = React.useState("")

  const rows = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data?.data ?? []).filter((r) => {
      if (show === "contact" && !r.email && !r.phone) return false
      if (show === "checkout" && !r.checkoutAt) return false
      if (!q) return true
      return [r.name, r.email, r.phone, r.city, itemsText(r)]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(q))
    })
  }, [data, show, query])

  const summary = data?.summary

  const columns: Column<LeftCartRow>[] = [
    {
      key: "who",
      header: "Visitor",
      value: (r) => who(r),
      cell: (r) => (
        <Link href={`/admin/customers/visitors/${r.visitorId}`} className="group block min-w-0">
          <span className="text-bone group-hover:text-blaze block truncate text-[14px] transition-colors">
            {who(r)}
          </span>
          <span className="text-dim block truncate font-mono text-[11px]">
            {r.phone ?? (r.email && r.name ? r.email : r.anonymous ? "did not accept cookies" : "")}
          </span>
        </Link>
      ),
    },
    {
      key: "cart",
      header: "Left in cart",
      value: (r) => itemsText(r),
      cell: (r) => (
        <span className="block min-w-[180px]">
          {r.items.map((i) => (
            <span key={i.sku} className="text-ash block text-[13px]">
              {i.qty} × {i.name} <span className="text-dim">· {i.colourway}</span>
            </span>
          ))}
        </span>
      ),
    },
    {
      key: "value",
      header: "Value",
      align: "right",
      value: (r) => Number(r.value),
      cell: (r) => (
        <span className="text-bone font-mono text-[13.5px]">
          <Money value={r.value} />
        </span>
      ),
    },
    {
      key: "checkout",
      header: "Checkout",
      value: (r) => (r.checkoutAt ? 1 : 0),
      cell: (r) =>
        r.checkoutAt ? (
          <Badge variant="ember">Reached</Badge>
        ) : (
          <span className="text-dim text-[12.5px]">Cart only</span>
        ),
    },
    {
      key: "device",
      header: "Device · place",
      value: (r) => deviceLine(r),
      cell: (r) => (
        <span className="block min-w-0">
          <span className="text-ash block truncate text-[12.5px]">{deviceLine(r)}</span>
          <span className="text-dim block truncate text-[11.5px]">
            {placeLine(r)}
            {r.source ? ` · ${r.source}` : ""}
          </span>
        </span>
      ),
    },
    {
      key: "updated",
      header: "Last change",
      align: "right",
      value: (r) => r.updatedAt,
      cell: (r) => (
        <span className="flex flex-col items-end gap-1">
          <span className="text-dim font-mono text-[11.5px]" title={when(r.updatedAt)}>
            {ago(r.updatedAt)}
          </span>
          {r.browsingNow ? <Badge variant="acid">Browsing now</Badge> : null}
        </span>
      ),
    },
    {
      key: "contact",
      header: "Follow up",
      align: "right",
      cell: (r) => (
        <ContactActions
          phone={r.phone}
          email={r.email}
          message={message(r)}
          subject="You left something in your SKELMET cart"
        />
      ),
    },
  ]

  if (isError) {
    return (
      <EmptyState
        title="Could not load carts"
        description={error instanceof Error ? error.message : undefined}
      />
    )
  }

  return (
    <DataTable
      handle={handle}
      rows={rows}
      columns={columns}
      rowId={(r) => r.id}
      exportName="abandoned-carts"
      exportButtons={false}
      pageKey={`${show}|${query}`}
      bar={
        <div className="flex items-center gap-2">
          <ViewMenu
            value={show}
            onChange={setShow}
            options={[
              { value: "all", label: "All", count: summary?.count },
              { value: "contact", label: "With contact details", count: summary?.withContact },
              { value: "checkout", label: "Reached checkout", count: summary?.reachedCheckout },
            ]}
          />
          <TableSearch
            value={query}
            onChange={setQuery}
            placeholder="Name, email, phone or city"
            label="Search carts by name, email, phone, city or colourway"
          />
        </div>
      }
      // The board's value tile, as a line: it filters nothing. There from the
      // first render, so the bar does not rearrange itself when it loads.
      barEnd={
        <span className="text-dim text-[12.5px] whitespace-nowrap">
          {summary ? (
            <>
              <Money value={summary.value} className="text-ash font-mono" /> left in carts
            </>
          ) : null}
        </span>
      }
      loading={isLoading}
      empty={
        query || show !== "all"
          ? "Nothing matches. Try another view or clear the search."
          : "No carts left behind. Carts show here once visitors add something and leave without placing an order."
      }
      exportColumns={[
        { header: "Name", value: (r) => r.name ?? "" },
        { header: "Email", value: (r) => r.email ?? "" },
        { header: "Phone", value: (r) => r.phone ?? "" },
        { header: "Cookies", value: (r) => (r.anonymous ? "Anonymous" : "Accepted") },
        { header: "Left in cart", value: (r) => itemsText(r) },
        { header: "Items", value: (r) => r.itemCount },
        { header: "Value", value: (r) => Number(r.value) },
        { header: "Reached checkout", value: (r) => (r.checkoutAt ? when(r.checkoutAt) : "") },
        { header: "Device", value: (r) => deviceLine(r) },
        { header: "Place", value: (r) => placeLine(r) },
        { header: "Source", value: (r) => r.source ?? "" },
        { header: "Last change", value: (r) => when(r.updatedAt) },
      ]}
    />
  )
}
