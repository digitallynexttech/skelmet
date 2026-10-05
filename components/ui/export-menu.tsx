"use client"

import * as React from "react"
import { Download, FileSpreadsheet } from "lucide-react"

import type { DataTableHandle } from "@/components/ui/data-table"
import { headerButton } from "@/components/ui/header-button"
import { Menu, MenuItem, MenuLabel } from "@/components/ui/menu"

/**
 * Export, in a page's header: a CSV or Excel file of the table below it -
 * the ticked rows, or else every row listed. Which, is said in the menu,
 * read as it opens.
 */
export function ExportMenu<T>({
  table,
  noun,
}: {
  table: React.RefObject<DataTableHandle<T> | null>
  /** What a row is, one and many: ["order", "orders"]. */
  noun: [string, string]
}) {
  const [target, setTarget] = React.useState({ count: 0, selected: false })
  const word = (n: number) => (n === 1 ? noun[0] : noun[1])

  return (
    <Menu
      label="Export"
      buttonClassName={headerButton()}
      button="Export"
      onOpen={() => {
        const selected = table.current?.selectedRows().length ?? 0
        setTarget(
          selected > 0
            ? { count: selected, selected: true }
            : { count: table.current?.exportRows().length ?? 0, selected: false },
        )
      }}
    >
      <MenuLabel>
        {target.count === 0
          ? `No ${noun[1]} listed`
          : target.selected
            ? `${target.count} selected ${word(target.count)}`
            : `All ${target.count} ${word(target.count)} listed`}
      </MenuLabel>
      <MenuItem
        icon={Download}
        disabled={target.count === 0}
        onSelect={() => table.current?.download("csv")}
      >
        CSV file
      </MenuItem>
      <MenuItem
        icon={FileSpreadsheet}
        disabled={target.count === 0}
        onSelect={() => table.current?.download("xlsx")}
      >
        Excel file
      </MenuItem>
    </Menu>
  )
}
