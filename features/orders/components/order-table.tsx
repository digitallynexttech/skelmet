"use client"

import * as React from "react"
import Link from "next/link"
import {
  ChevronDown,
  ClipboardCopy,
  ListOrdered,
  Phone,
  ShoppingBag,
  ShoppingCart,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { EmptyState } from "@/components/shared/empty-state"
import { Money } from "@/components/shared/money"
import { PageHeader } from "@/components/shared/page-header"
import { ToneBadge } from "@/components/shared/status-badge"
import { DataTable, type Column, type DataTableHandle } from "@/components/ui/data-table"
import { ExportMenu } from "@/components/ui/export-menu"
import { HeaderLink, headerButton } from "@/components/ui/header-button"
import { Menu, MenuItem, MenuLabel, MenuLink, MenuSeparator } from "@/components/ui/menu"
import { TableSearch } from "@/components/ui/table-search"
import { ViewMenu } from "@/components/ui/view-menu"
import { FLAME_SKULL_MOUNT } from "@/features/catalog/catalog"
import { PAYMENT_METHOD_SHORT } from "@/features/checkout/payment-options"
import {
  planTestOrderDeletion,
  useDeleteTestOrders,
  useOrders,
  type OrderRow,
  type TestOrderPlan,
} from "@/features/orders/hooks/use-orders"
import {
  DELIVERY_STATES,
  FULFILMENT_STATES,
  PAYMENT_STATES,
} from "@/features/orders/order-progress"
import { ORDER_VIEWS, viewsIn, type OrderView } from "@/features/orders/order-views"
import { type OrderScope } from "@/lib/constants"
import { useConfirm } from "@/hooks/use-confirm"
import { useDebounce } from "@/hooks/use-debounce"
import { useUrlState } from "@/hooks/use-url-state"
import { formatMoney } from "@/lib/money"
import { cn } from "@/lib/utils"

// Orders: paid or COD accepted, and onward. All orders adds the never-paid ones.
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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** What the courier is still to collect, or 0 once nothing is. */
function dueAtDoor(o: OrderRow): number {
  const due = Number(o.dueOnDelivery)
  const owed = o.payment === "pending" || o.payment === "partially_paid"
  return owed && o.status !== "RETURNED" && due > 0 ? due : 0
}

function paymentNote(o: OrderRow): string {
  const due = dueAtDoor(o)
  const method = PAYMENT_METHOD_SHORT[o.paymentMethod]
  return due > 0 ? `${method} · ${formatMoney(due)} due` : method
}

export function OrderTable({
  scope = "paid",
  canDeleteTest = false,
}: {
  scope?: OrderScope
  /** The server checks this too. */
  canDeleteTest?: boolean
}) {
  const copy = SCOPES[scope]
  const views = viewsIn(scope)

  // View and search in the URL; the page is not, as the table pages client-side.
  const [state, setState] = useUrlState(DEFAULTS)
  const [rawQuery, setRawQuery] = React.useState(state.q)
  const debounced = useDebounce(rawQuery, 350)

  React.useEffect(() => {
    if (debounced !== state.q) setState({ q: debounced })
  }, [debounced, state.q, setState])

  // A view this list lacks (old link) falls back to all.
  const view: OrderView = views.includes(state.view as OrderView)
    ? (state.view as OrderView)
    : "all"
  const { data, isLoading, isError, error } = useOrders({
    page: 1,
    scope,
    view,
    status: "ALL",
    q: state.q,
  })

  // Taken as the menu opens: the ticked orders, or else every order in the tab.
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

  // The server previews what would go and what stays; only the confirm deletes.
  const { ask, dialog } = useConfirm()
  const deleteTest = useDeleteTestOrders()

  async function askToDelete(rows: OrderRow[]) {
    let plan: TestOrderPlan
    try {
      plan = await planTestOrderDeletion(rows.map((o) => o.id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not check those orders.")
      return
    }
    const n = plan.deletable.length
    ask({
      title: n ? `Delete ${plural(n, "order", "orders")}?` : "None of these can be deleted",
      body: <DeletionPreview plan={plan} />,
      confirmLabel: n ? `Delete ${plural(n, "order", "orders")}` : "Close",
      tone: n ? "danger" : "primary",
      run: (done) => {
        if (!n) return done()
        deleteTest.mutate(
          plan.deletable.map((o) => o.id),
          {
            onSuccess: (result) => {
              const gone = result.deletable.length
              toast.success(`Deleted ${plural(gone, "order", "orders")}`, {
                description: result.kept.length
                  ? `Kept ${result.kept.map((k) => k.number).join(", ")}.`
                  : undefined,
              })
            },
            onError: (err) =>
              toast.error(err instanceof Error ? err.message : "Could not delete those orders."),
            onSettled: done,
          },
        )
      },
    })
  }

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
      // Not a clickable row: it would fight the selection checkbox.
      cell: (o) => (
        <Link
          href={`/admin/orders/${o.id}`}
          className={cn(
            "text-bone hover:text-blaze font-mono text-[13px] transition-colors",
            o.status === "CANCELLED" && "decoration-ash line-through",
          )}
        >
          {o.number}
          {o.testPayment ? (
            <ToneBadge
              tone="neutral"
              title="Paid through Razorpay's test account: no real money changed hands."
              className="ml-2 px-1.5 py-0.5 align-middle no-underline"
            >
              Test
            </ToneBadge>
          ) : null}
        </Link>
      ),
    },
    {
      key: "placed",
      header: "Date",
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
      // A number, so it sorts numerically.
      value: (o) => Number(o.total),
      cell: (o) => (
        <span className="text-bone font-mono text-[13.5px]">
          <Money value={o.total} />
        </span>
      ),
    },
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

  const bar = (
    <div className="flex items-center gap-2">
      <ViewMenu
        value={view}
        onChange={(v) => setState({ view: v })}
        options={views.map((v) => ({
          value: v,
          label: ORDER_VIEWS[v].label,
          count: data?.viewCounts[v],
        }))}
      />
      <TableSearch
        value={rawQuery}
        onChange={setRawQuery}
        placeholder="Order no., email or phone"
        label="Search orders by order number, email or phone"
      />
    </div>
  )
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={ShoppingBag}
        title={copy.title}
        parent={scope === "all" ? { label: "Orders", href: "/admin/orders" } : undefined}
        actions={
          <>
            <ExportMenu table={table} noun={["order", "orders"]} />

            <Menu
              label="More actions"
              onOpen={takeTarget}
              buttonClassName={cn(headerButton(), "group")}
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
              {canDeleteTest ? (
                <>
                  <MenuSeparator />
                  {/* Ticked orders only: never "everything in this view". */}
                  <MenuItem
                    icon={Trash2}
                    disabled={!target.selected}
                    hint={target.selected ? undefined : "tick first"}
                    onSelect={() => void askToDelete(target.rows)}
                  >
                    Delete orders
                  </MenuItem>
                </>
              ) : null}
            </Menu>

            {/* Orders are only made at checkout, which settles stock, price and payment. */}
            <HeaderLink
              variant="primary"
              href={`/product/${FLAME_SKULL_MOUNT.slug}`}
              target="_blank"
              rel="noopener"
              title="Opens the shop in a new tab: place the order at checkout with the customer's details"
            >
              Create order
            </HeaderLink>
          </>
        }
      />

      {dialog}

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
          rowClassName={(o) =>
            o.status === "CANCELLED"
              ? "[&>td]:opacity-55 [&>td]:transition-opacity hover:[&>td]:opacity-100"
              : undefined
          }
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

function DeletionPreview({ plan }: { plan: TestOrderPlan }) {
  return (
    <div className="flex flex-col gap-4">
      {plan.deletable.length ? (
        <div>
          <p>
            Deleted for good, with their payments and shipments. Stock they still hold goes back on
            sale. This cannot be undone.
          </p>
          <ul className="mt-3 max-h-48 overflow-y-auto rounded-sm border border-white/[0.09]">
            {plan.deletable.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-3 py-2 first:border-t-0"
              >
                <span className="min-w-0">
                  <span className="text-bone font-mono text-[12.5px]">{o.number}</span>
                  <span className="text-dim ml-2 text-[12.5px]">{o.customer}</span>
                </span>
                <span className="text-dim shrink-0 font-mono text-[11.5px]">
                  {o.testPayment ? "Test payment · " : "No payment taken · "}
                  {formatMoney(o.total)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {plan.kept.length ? (
        <div>
          <p className="text-bone font-semibold">Kept, because they look real or still matter:</p>
          <ul className="mt-2 max-h-40 overflow-y-auto">
            {plan.kept.map((k) => (
              <li key={k.id} className="py-1 text-[13px]">
                <span className="text-bone font-mono text-[12.5px]">{k.number}</span>{" "}
                <span className="text-ash">{k.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
