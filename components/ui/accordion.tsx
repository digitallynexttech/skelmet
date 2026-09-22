"use client"

import * as React from "react"
import { Minus, Plus } from "lucide-react"

import { cn } from "@/lib/utils"

export type AccordionItem = {
  question: string
  answer: React.ReactNode
}

export function Accordion({
  items,
  defaultOpen = 0,
  className,
}: {
  items: AccordionItem[]
  defaultOpen?: number | null
  className?: string
}) {
  const [open, setOpen] = React.useState<number | null>(defaultOpen)

  return (
    <div className={cn("flex flex-col", className)}>
      {items.map((item, i) => {
        const isOpen = open === i
        return (
          <div key={item.question} className="border-t border-white/10 last:border-b">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-5 py-6 text-left"
            >
              <span className="text-bone text-[17px] font-semibold sm:text-[19px]">
                {item.question}
              </span>
              {isOpen ? (
                <Minus className="text-blaze size-5 shrink-0" strokeWidth={2} />
              ) : (
                <Plus className="text-dim size-5 shrink-0" strokeWidth={2} />
              )}
            </button>
            <div
              className={cn(
                "grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              )}
            >
              <div className="overflow-hidden">
                <p className="text-ash max-w-[640px] pb-6 text-[15px] leading-[1.62] sm:text-[15.5px]">
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
