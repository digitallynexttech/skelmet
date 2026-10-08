"use client"

import { ChevronsUpDown } from "lucide-react"

import { Menu, MenuOption } from "@/components/ui/menu"

/** Shopify-style view picker beside a table's search (All, Unpaid...), each with its count. */
export function ViewMenu<T extends string>({
  value,
  options,
  onChange,
  label = "View",
}: {
  value: T
  options: Array<{ value: T; label: string; count?: number }>
  onChange: (next: T) => void
  /** Accessible name prefix: "View", "Status". */
  label?: string
}) {
  const current = options.find((o) => o.value === value) ?? options[0]
  return (
    <Menu
      label={`${label}: ${current?.label ?? ""}`}
      align="start"
      buttonClassName="text-bone flex h-9 shrink-0 items-center gap-1.5 rounded-sm bg-white/[0.06] px-3 text-[13px] font-semibold transition-colors hover:bg-white/[0.1] aria-expanded:bg-white/[0.1]"
      button={
        <>
          {current?.label}
          <ChevronsUpDown className="text-ash size-3.5" strokeWidth={2.2} />
        </>
      }
    >
      {options.map((o) => (
        <MenuOption
          key={o.value}
          checked={o.value === value}
          onSelect={() => onChange(o.value)}
          hint={o.count}
        >
          {o.label}
        </MenuOption>
      ))}
    </Menu>
  )
}
