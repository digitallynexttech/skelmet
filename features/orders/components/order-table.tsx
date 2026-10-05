"use client"

import * as React from "react"
import Link from "next/link"
import {
  ChevronDown,
  ChevronsUpDown,
  ClipboardCopy,
  Download,
  FileSpreadsheet,
  ListOrdered,
  Phone,
  Search,
  ShoppingBag,
  ShoppingCart,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { Money } from "@/components/shared/money"
import { ToneBadge } from "@/components/shared/status-badge"
import { DataTable, type Column, type DataTableHandle } from "@/components/ui/data-table"
import { Input } from "@/components/ui/input"
import {
  Menu,
  MenuItem,
  MenuLabel,
  MenuLink,
  MenuOption,
  MenuSeparator,
} from "@/components/ui/menu"
import { FLAME_SKULL_MOUNT } from "@/features/catalog/catalog"
import { PAYMENT_METHOD_SHORT } from "@/features/checkout/payment-options"
import { useOrders, type OrderRow } from "@/features/orders/hooks/use-orders"
import {
  DELIVERY_STATES,
  FULFILMENT_STATES,
  PAYMENT_STATES,
} from "@/features/orders/order-progress"
import { ORDER_VIEWS, viewsIn, type OrderView } from "@/features/orders/order-views"
import { type OrderScope } from "@/lib/constants"
import { useDebounce } from "@/hooks/use-debounce"
import { useUrlState } from "@/hooks/use-url-state"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"

/**
 * The two lists one table serves. Orders is the working list - paid, or
 * cash on delivery accepted, and everything that happens after. All orders
 * adds the ones never paid for, which Abandoned carts follows up on. Each
 * links to the other from More actions.
 */
const SCOPES: Record<
  OrderScope,
  { title: string; exportName: string; other: { label: string; href: string } }
> = {
  paid: {
    title: "Orders",
    exportName: "orders",
    other: { label: "All orders, paid or not", href: "/admin/orders/all" },
  },
  all: {
    title: "All orders",
    exportName: "all-orders",
    other: { label: "Orders to fulfil", href: "/admin/orders" },
  },
}

// Stable, since useUrlState memoises on it.
const DEFAULTS = { view: "all", q: "" }

const PAGE_SIZES = [10, 20, 50, 100]

const secondary =
  "text-bone flex h-9 items-center gap-2 rounded-sm border border-white/[0.14] bg-white/[0.04] px-3 text-[13px] font-semibold transition-colors hover:border-white/25 hover:bg-white/[0.08] aria-expanded:border-white/25 aria-expanded:bg-white/[0.08]"

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The money the courier is still to collect, while it still is. */
function dueAtDoor(o: OrderRow): number {
  const due = Number(o.dueOnDelivery)
  const owed = o.payment === "pending" || o.payment === "partially_paid"
  return owed && o.status !== "RETURNED" && due > 0 ? due : 0
}

/** How the payment is made, and what is left to collect. */
function paymentNote(o: OrderRow): string {
  const due = dueAtDoor(o)
  const method = PAYMENT_METHOD_SHORT[o.paymentMethod]
  return due > 0 ? `${method} · ${formatMoney(due)} due` : method
}

export function OrderTable({ scope = "paid" }: { scope?: OrderScope }) {
  const copy = SCOPES[scope]
  const views = viewsIn(scope)

  // View and search live in the URL, so a filtered list is shareable
  // (§6). The page does not: paging happens in the table, over the window
  // the server sent.
  const [state, setState] = useUrlState(DEFAULTS)
  const [rawQuery, setRawQuery] = React.useState(state.q)
  const debounced = useDebounce(rawQuery, 350)

  React.useEffect(() => {
    if (debounced !== state.q) setState({ q: debounced })
  }, [debounced, state.q, setState])

  // A link or bookmark naming a view this list does not have falls back to
  // all of it.
  const view: OrderView = views.includes(state.view as OrderView)
    ? (state.view as OrderView)
    : "all"
  // The view is the one filter: the status dropdown beside it is gone.
  const { data, isLoading, isError, error } = useOrders({
    page: 1,
    scope,
    view,
    status: "ALL",
    q: state.q,
  })

  // What Export and More actions work on, taken as the menu opens: the
  // ticked orders, or else every order in the tab.
  const table = React.useRef<DataTableHandle<OrderRow>>(null)
  const [target, setTarget] = React.useState<{ rows: OrderRow[]; selected: boolean }>({
    rows: [],
    selected: false,
  })
  function takeTarget() {
    const selected = table.current?.selectedRows() ?? []
    setTarget(
      selected.length > 0
        ? { rows: selected, selected: true }
        : { rows: table.current?.exportRows() ?? [], selected: false },
    )
  }
  const targetLabel =
    target.rows.length === 0
      ? "No orders listed"
      : target.selected
        ? plural(target.rows.length, "selected order", "selected orders")
        : `All ${plural(target.rows.length, "order", "orders")} listed`

  async function copyList(values: string[], what: string) {
    const unique = [...new Set(values.filter(Boolean))]
    try {
      await navigator.clipboard.writeText(unique.join("\n"))
      toast.success(`Copied ${plural(unique.length, what, `${what}s`)}`)
    } catch {
      toast.error("Could not copy. Allow clipboard access for this site and try again.")
    }
  }

  const columns: Column<OrderRow>[] = [
    {
      key: "number",
      header: "Order",
      value: (o) => o.number,
      // The row is not the link: a clickable row and a selection checkbox
      // fight over the same click.
      cell: (o) => (
        <Link
          href={`/admin/orders/${o.id}`}
          className={cn(
            "text-bone hover:text-blaze font-mono text-[13px] transition-colors",
            o.status === "CANCELLED" && "decoration-ash line-through",
          )}
        >
          {o.number}
        </Link>
      ),
    },
    {
      key: "placed",
      header: "Date",
      // Sorts on the ISO string, which orders correctly.
      value: (o) => o.placedAt ?? o.createdAt,
      cell: (o) => (
        <span className="text-ash font-mono text-[12px]">{fmtDate(o.placedAt ?? o.createdAt)}</span>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      value: (o) => o.customer || o.email,
      cell: (o) => (
        <span className="block min-w-0">
          <span className="text-bone block truncate text-[14px]">{o.customer}</span>
          <span className="text-dim block truncate font-mono text-[11px]">{o.email}</span>
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      // Money is a string on the wire; as text "₹1,000" sorts below "₹2".
      value: (o) => Number(o.total),
      cell: (o) => (
        <span className="text-bone font-mono text-[13.5px]">
          <Money value={o.total} />
        </span>
      ),
    },
    // Shopify's three statuses in place of the order's one (order-progress.ts).
    {
      key: "payment",
      header: "Payment status",
      value: (o) => PAYMENT_STATES[o.payment].label,
      cell: (o) => (
        <span className="flex flex-col items-start gap-1.5">
          <ToneBadge tone={PAYMENT_STATES[o.payment].tone}>
            {PAYMENT_STATES[o.payment].label}
          </ToneBadge>
          <span className="text-dim font-mono text-[11px]">{paymentNote(o)}</span>
        </span>
      ),
    },
    {
      key: "fulfilment",
      header: "Fulfilment status",
      value: (o) => FULFILMENT_STATES[o.fulfilment].label,
      cell: (o) => (
        <ToneBadge
          tone={FULFILMENT_STATES[o.fulfilment].tone}
          title={FULFILMENT_STATES[o.fulfilment].title}
        >
          {FULFILMENT_STATES[o.fulfilment].label}
        </ToneBadge>
      ),
    },
    {
      key: "items",
      header: "Items",
      align: "right",
      value: (o) => o.itemCount,
      cell: (o) => (
        <span className="text-ash text-[13.5px]">{plural(o.itemCount, "item", "items")}</span>
      ),
    },
    {
      key: "delivery",
      header: "Delivery status",
      // Blank until there is a parcel, as Shopify leaves it.
      value: (o) => o.delivery?.label ?? "",
      cell: (o) =>
        o.delivery ? (
          <ToneBadge tone={DELIVERY_STATES[o.delivery.key].tone}>{o.delivery.label}</ToneBadge>
        ) : (
          <span className="text-dim">-</span>
        ),
    },
    {
      key: "phone",
      header: "Phone",
      value: (o) => o.phone,
      cell: (o) => <span className="text-ash font-mono text-[12px]">{o.phone || "-"}</span>,
    },
    {
      key: "location",
      header: "Location",
      value: (o) => o.location,
      cell: (o) => <span className="text-ash text-[13.5px]">{o.location || "-"}</span>,
    },
  ]

  // The view, as Shopify has it: All, Unfulfilled, Unpaid... in a menu
  // beside the search.
  const bar = (
    <div className="flex items-center gap-2">
      <Menu
        label={`View: ${ORDER_VIEWS[view].label}`}
        align="start"
        buttonClassName="text-bone flex h-9 shrink-0 items-center gap-1.5 rounded-sm bg-white/[0.06] px-3 text-[13px] font-semibold transition-colors hover:bg-white/[0.1] aria-expanded:bg-white/[0.1]"
        button={
          <>
            {ORDER_VIEWS[view].label}
            <ChevronsUpDown className="text-ash size-3.5" strokeWidth={2.2} />
          </>
        }
      >
        {views.map((v) => (
          <MenuOption
            key={v}
            checked={view === v}
            onSelect={() => setState({ view: v })}
            hint={data?.viewCounts[v]}
          >
            {ORDER_VIEWS[v].label}
          </MenuOption>
        ))}
      </Menu>

      <div className="relative min-w-0 flex-1 sm:max-w-[280px]">
        <Search
          className="text-dim pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          strokeWidth={1.9}
        />
        <Input
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          placeholder="Order no., email or phone"
          aria-label="Search orders by order number, email or phone"
          className="h-9 pr-8 pl-9 text-[13px]"
        />
        {rawQuery ? (
          <button
            type="button"
            onClick={() => setRawQuery("")}
            aria-label="Clear the search"
            className="text-dim hover:text-bone absolute top-1/2 right-2 flex size-6 -translate-y-1/2 items-center justify-center transition-colors"
          >
            <X className="size-3.5" strokeWidth={2.2} />
          </button>
        ) : null}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-bone flex items-center gap-2.5 text-[20px] leading-none font-semibold">
          <ShoppingBag className="text-ash size-5" strokeWidth={1.9} />
          {copy.title}
        </h1>

        <div className="ml-auto flex items-center gap-2">
          <Menu label="Export" onOpen={takeTarget} buttonClassName={secondary} button="Export">
            <MenuLabel>{targetLabel}</MenuLabel>
            <MenuItem
              icon={Download}
              disabled={target.rows.length === 0}
              onSelect={() => table.current?.download("csv")}
            >
              CSV file
            </MenuItem>
            <MenuItem
              icon={FileSpreadsheet}
              disabled={target.rows.length === 0}
              onSelect={() => table.current?.download("xlsx")}
            >
              Excel file
            </MenuItem>
          </Menu>

          <Menu
            label="More actions"
            onOpen={takeTarget}
            buttonClassName={cn(secondary, "group")}
            button={
              <>
                <span className="sm:hidden">More</span>
                <span className="hidden sm:inline">More actions</span>
                <ChevronDown
                  className="text-ash size-4 transition-transform group-aria-expanded:rotate-180"
                  strokeWidth={2}
                />
              </>
            }
          >
            <MenuLabel>{targetLabel}</MenuLabel>
            <MenuItem
              icon={ClipboardCopy}
              disabled={target.rows.length === 0}
              onSelect={() =>
                void copyList(
                  target.rows.map((o) => o.number),
                  "order number",
                )
              }
            >
              Copy order numbers
            </MenuItem>
            <MenuItem
              icon={Phone}
              disabled={target.rows.length === 0}
              onSelect={() =>
                void copyList(
                  target.rows.map((o) => o.phone),
                  "phone number",
                )
              }
            >
              Copy phone numbers
            </MenuItem>
            <MenuSeparator />
            <MenuLink icon={ListOrdered} href={copy.other.href}>
              {copy.other.label}
            </MenuLink>
            <MenuLink icon={ShoppingCart} href="/admin/orders/abandoned">
              Abandoned carts
            </MenuLink>
          </Menu>

          {/* No order is made in here: the shop's checkout is where stock,
              the price and the payment are settled, so a phone order goes
              through it too, in a new tab, with the customer's details. */}
          <Link
            href={`/product/${FLAME_SKULL_MOUNT.slug}`}
            target="_blank"
            rel="noopener"
            title="Opens the shop in a new tab: place the order at checkout with the customer's details"
            className="bg-blaze text-void hover:bg-ember flex h-9 items-center rounded-sm px-3.5 text-[13px] font-semibold transition-colors"
          >
            Create order
          </Link>
        </div>
      </div>

      {isError ? (
        <EmptyState
          title="Could not load orders"
          description={error instanceof Error ? error.message : undefined}
        />
      ) : (
        <DataTable
          handle={table}
          rows={data?.data ?? []}
          columns={columns}
          rowId={(o) => o.id}
          exportName={copy.exportName}
          exportButtons={false}
          columnToggle
          numbered={false}
          // Cancelled orders step back, struck through, as closed business.
          rowClassName={(o) =>
            o.status === "CANCELLED"
              ? "[&>td]:opacity-55 [&>td]:transition-opacity hover:[&>td]:opacity-100"
              : undefined
          }
          pageSizes={PAGE_SIZES}
          pageKey={`${view}|${state.q}`}
          bar={bar}
          loading={isLoading}
          total={data?.pagination?.total}
          empty={
            state.q ? "No order matches that search." : "No orders here yet. Try another view."
          }
          exportColumns={[
            { header: "Order", value: (o) => o.number },
            { header: "Date", value: (o) => fmtDate(o.placedAt ?? o.createdAt) },
            { header: "Customer", value: (o) => o.customer },
            { header: "Email", value: (o) => o.email },
            { header: "Total", value: (o) => Number(o.total) },
            { header: "Payment status", value: (o) => PAYMENT_STATES[o.payment].label },
            { header: "Payment method", value: (o) => PAYMENT_METHOD_SHORT[o.paymentMethod] },
            { header: "Due on delivery", value: (o) => dueAtDoor(o) },
            { header: "Fulfilment status", value: (o) => FULFILMENT_STATES[o.fulfilment].label },
            { header: "Items", value: (o) => o.itemCount },
            { header: "Delivery status", value: (o) => o.delivery?.label ?? "" },
            { header: "Phone", value: (o) => o.phone },
            { header: "Location", value: (o) => o.location },
          ]}
        />
      )}
    </div>
  )
}
