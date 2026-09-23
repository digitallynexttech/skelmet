"use client"

import * as React from "react"
import { ChevronDown, Minus, Plus } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Money } from "@/components/shared/money"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/ui/data-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  useProductMutations,
  useProducts,
  type ProductRow,
  type VariantRow,
} from "@/features/products/hooks/use-products"

const LOW_STOCK = 5

const STATUS_TONE = {
  ACTIVE: "acid",
  DRAFT: "muted",
  ARCHIVED: "outline",
} as const

function StockCell({ variant, disabled }: { variant: VariantRow; disabled: boolean }) {
  const { adjustStock } = useProductMutations()
  const [amount, setAmount] = React.useState("1")
  const step = Math.max(1, Number(amount) || 1)

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Remove ${step} from ${variant.sku}`}
        className="px-3"
        disabled={disabled || variant.stock < step}
        onClick={() => adjustStock.mutate({ id: variant.id, delta: -step })}
      >
        <Minus className="size-3.5" strokeWidth={2.2} />
      </Button>

      <Input
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
        inputMode="numeric"
        aria-label="Amount to add or remove"
        className="h-10 w-14 px-2 text-center font-mono text-[13px]"
      />

      <Button
        variant="ghost"
        size="sm"
        aria-label={`Add ${step} to ${variant.sku}`}
        className="px-3"
        disabled={disabled}
        onClick={() => adjustStock.mutate({ id: variant.id, delta: step })}
      >
        <Plus className="size-3.5" strokeWidth={2.2} />
      </Button>
    </div>
  )
}

function PriceCell({ variant, disabled }: { variant: VariantRow; disabled: boolean }) {
  const { updateVariant } = useProductMutations()
  const [value, setValue] = React.useState(variant.price)

  // The row is the source of truth. If someone else changed the price, take
  // theirs rather than keeping a stale draft on screen.
  const [seen, setSeen] = React.useState(variant.price)
  if (seen !== variant.price) {
    setSeen(variant.price)
    setValue(variant.price)
  }

  const dirty = value !== variant.price

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (dirty) updateVariant.mutate({ id: variant.id, price: Number(value) })
      }}
      className="flex items-center gap-2"
    >
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))}
        inputMode="decimal"
        aria-label={`Price for ${variant.sku}`}
        className="h-10 w-24 px-3 font-mono text-[13px]"
      />
      {dirty ? (
        <Button type="submit" variant="primary" size="sm" disabled={disabled}>
          Save
        </Button>
      ) : null}
    </form>
  )
}

function StockLevel({ variant }: { variant: VariantRow }) {
  const tone =
    variant.stock === 0
      ? "text-magenta font-mono text-[14px] font-bold"
      : variant.stock <= LOW_STOCK
        ? "text-ember font-mono text-[14px] font-bold"
        : "text-bone font-mono text-[14px]"

  return (
    <>
      <span className={tone}>{variant.stock}</span>
      {variant.stock === 0 ? (
        <span className="text-magenta ml-2 text-[12px]">out</span>
      ) : variant.stock <= LOW_STOCK ? (
        <span className="text-ember ml-2 text-[12px]">low</span>
      ) : null}
    </>
  )
}

function ProductCard({ product }: { product: ProductRow }) {
  const [open, setOpen] = React.useState(true)
  const { updateProduct, updateVariant, adjustStock } = useProductMutations()
  const busy = updateProduct.isPending || updateVariant.isPending || adjustStock.isPending

  return (
    <article className="rounded-md bg-carbon border border-white/[0.09]">
      <header className="flex flex-wrap items-center gap-4 border-b border-white/[0.07] px-6 py-5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <ChevronDown
            className={
              open
                ? "text-ash size-4 shrink-0 transition-transform"
                : "text-ash size-4 shrink-0 -rotate-90 transition-transform"
            }
            strokeWidth={2}
          />
          <span className="min-w-0">
            <span className="text-bone block truncate text-[16px] font-semibold">
              {product.name}
            </span>
            <span className="text-dim block font-mono text-[11px]">/{product.slug}</span>
          </span>
        </button>

        <Badge variant={STATUS_TONE[product.status]}>{product.status}</Badge>

        <span className="text-ash font-mono text-[12.5px]">{product.totalStock} in stock</span>

        <div className="flex gap-2">
          {product.status === "ACTIVE" ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => updateProduct.mutate({ id: product.id, status: "DRAFT" })}
            >
              Unpublish
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() => updateProduct.mutate({ id: product.id, status: "ACTIVE" })}
            >
              Publish
            </Button>
          )}
        </div>
      </header>

      {open ? (
        <div className="px-6 py-5">
          <DataTable
            rows={product.variants}
            rowId={(v) => v.id}
            exportName={`variants-${product.slug}`}
            frame={false}
            pageSize={25}
            empty="This product has no variants."
            columns={[
              {
                key: "colourway",
                header: "Colourway",
                value: (v) => v.colourway,
                cell: (v) => (
                  <span className="text-bone text-[14px] capitalize">{v.colourway}</span>
                ),
              },
              {
                key: "sku",
                header: "SKU",
                value: (v) => v.sku,
                cell: (v) => <span className="text-ash font-mono text-[12px]">{v.sku}</span>,
              },
              {
                // Sorted as a number: price is a string on the wire, and
                // "1000" sorts below "2" as text.
                key: "price",
                header: "Price",
                value: (v) => Number(v.price),
                cell: (v) => <PriceCell variant={v} disabled={busy} />,
              },
              {
                key: "stock",
                header: "Stock",
                value: (v) => v.stock,
                cell: (v) => <StockLevel variant={v} />,
              },
              {
                // No value, so it neither sorts nor exports — a pair of
                // buttons is not data.
                key: "adjust",
                header: "Adjust",
                cell: (v) => <StockCell variant={v} disabled={busy} />,
              },
            ]}
          />
        </div>
      ) : null}
    </article>
  )
}

export function ProductManager() {
  const { data, isLoading, isError, error } = useProducts()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="h-14 w-72 animate-pulse rounded-md bg-white/5" />
        <div className="rounded-md h-72 animate-pulse bg-white/5" />
      </div>
    )
  }

  if (isError) {
    return (
      <EmptyState
        title="Could not load products"
        description={error instanceof Error ? error.message : "Try again in a moment."}
      />
    )
  }

  const products = data?.data ?? []

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        eyebrow="Catalogue"
        title="Products"
        description="Prices, stock and what is live on the storefront. Stock moves by an amount in or out, so two people counting the same shelf add up instead of overwriting each other."
      />

      {products.length === 0 ? (
        <EmptyState
          title="No products yet"
          description="Run the seed, or add a product to the database."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      <p className="text-dim text-[13px]">
        Total catalogue value at list price:{" "}
        <Money
          value={products.reduce(
            (sum, p) => sum + p.variants.reduce((s, v) => s + Number(v.price) * v.stock, 0),
            0,
          )}
          className="text-bone font-mono"
        />
      </p>
    </div>
  )
}
