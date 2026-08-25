"use client"

import * as React from "react"
import { ChevronDown, Minus, Plus } from "lucide-react"

import { EmptyState } from "@/components/shared/empty-state"
import { Money } from "@/components/shared/money"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
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

function ProductCard({ product }: { product: ProductRow }) {
  const [open, setOpen] = React.useState(true)
  const { updateProduct, updateVariant, adjustStock } = useProductMutations()
  const busy = updateProduct.isPending || updateVariant.isPending || adjustStock.isPending

  return (
    <article className="rounded-card border border-white/[0.09] bg-carbon">
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
                ? "size-4 shrink-0 text-ash transition-transform"
                : "size-4 shrink-0 -rotate-90 text-ash transition-transform"
            }
            strokeWidth={2}
          />
          <span className="min-w-0">
            <span className="block truncate text-[16px] font-semibold text-bone">
              {product.name}
            </span>
            <span className="block font-mono text-[11px] text-dim">/{product.slug}</span>
          </span>
        </button>

        <Badge variant={STATUS_TONE[product.status]}>{product.status}</Badge>

        <span className="font-mono text-[12.5px] text-ash">
          {product.totalStock} in stock
        </span>

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
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06] text-left font-mono text-[10px] tracking-[0.16em] text-dim uppercase">
              <th className="px-6 py-3 font-normal">Colourway</th>
              <th className="px-6 py-3 font-normal">SKU</th>
              <th className="px-6 py-3 font-normal">Price</th>
              <th className="px-6 py-3 font-normal">Stock</th>
              <th className="px-6 py-3 font-normal">Adjust</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {product.variants.map((v) => (
              <tr key={v.id}>
                <td className="px-6 py-4 text-[14px] text-bone capitalize">{v.colourway}</td>
                <td className="px-6 py-4 font-mono text-[12px] text-ash">{v.sku}</td>
                <td className="px-6 py-4">
                  <PriceCell variant={v} disabled={busy} />
                </td>
                <td className="px-6 py-4">
                  <span
                    className={
                      v.stock === 0
                        ? "font-mono text-[14px] font-bold text-magenta"
                        : v.stock <= LOW_STOCK
                          ? "font-mono text-[14px] font-bold text-ember"
                          : "font-mono text-[14px] text-bone"
                    }
                  >
                    {v.stock}
                  </span>
                  {v.stock === 0 ? (
                    <span className="ml-2 text-[12px] text-magenta">out</span>
                  ) : v.stock <= LOW_STOCK ? (
                    <span className="ml-2 text-[12px] text-ember">low</span>
                  ) : null}
                </td>
                <td className="px-6 py-4">
                  <StockCell variant={v} disabled={busy} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </article>
  )
}

export function ProductManager() {
  const { data, isLoading, isError, error } = useProducts()

  if (isLoading) {
    return (
      <div className="flex flex-col gap-5">
        <div className="h-14 w-72 animate-pulse rounded-xl bg-white/5" />
        <div className="h-72 animate-pulse rounded-card bg-white/5" />
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

      <p className="text-[13px] text-dim">
        Total catalogue value at list price:{" "}
        <Money
          value={products.reduce(
            (sum, p) => sum + p.variants.reduce((s, v) => s + Number(v.price) * v.stock, 0),
            0,
          )}
          className="font-mono text-bone"
        />
      </p>
    </div>
  )
}
