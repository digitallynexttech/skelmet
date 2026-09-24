"use client"

import * as React from "react"
import { Check, MapPin, X } from "lucide-react"

import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"

/**
 * Delivery check. Previously an input with no state and a CHECK button that
 * did nothing - it accepted "dsvf" and answered nothing at all.
 *
 * We ship anywhere in India, so there is no serviceability list to consult:
 * the only question is whether what was typed is a real pincode. Six digits,
 * never starting with zero - 0 is not an allocated postal circle.
 *
 * The field is digits-only at the source rather than validated after the
 * fact, so letters simply cannot be typed into it.
 */
const PINCODE = /^[1-9][0-9]{5}$/

type Result = { ok: true; pin: string } | { ok: false; message: string }

export function PincodeCheck({ className }: { className?: string }) {
  const [pin, setPin] = React.useState("")
  const [result, setResult] = React.useState<Result | null>(null)

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    // Strip on the way in: paste, autofill and keypress all land here.
    setPin(event.target.value.replace(/\D/g, "").slice(0, 6))
    // Clearing in the handler, not an effect - a stale answer beside a
    // half-edited pincode is worse than no answer.
    setResult(null)
  }

  function check() {
    setResult(
      PINCODE.test(pin)
        ? { ok: true, pin }
        : {
            ok: false,
            message: pin.length === 0 ? "Enter your pincode." : "That is not a valid pincode.",
          },
    )
  }

  return (
    <div className={className}>
      <div className="rounded-lg bg-carbon flex h-[54px] items-center gap-2.5 border border-white/10 px-4 focus-within:border-white/25">
        <MapPin className="text-ember size-[17px] shrink-0" strokeWidth={1.7} />
        <input
          value={pin}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              check()
            }
          }}
          placeholder="Enter pincode"
          // inputMode brings up the digit pad; maxLength stops the 7th
          // character even where the strip above is bypassed.
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          aria-label="Delivery pincode"
          className="text-bone placeholder:text-dim h-full min-w-0 flex-1 border-0 bg-transparent font-mono text-[15px] tracking-[0.12em] outline-none"
        />
        <button
          type="button"
          onClick={check}
          className="text-acid hover:text-bone shrink-0 font-mono text-[11px] font-bold tracking-[0.1em] transition-colors"
        >
          CHECK
        </button>
      </div>

      {result ? (
        <p
          className={cn(
            "mt-2.5 flex items-start gap-1.5 text-[12.5px] leading-[1.5]",
            result.ok ? "text-acid" : "text-dim",
          )}
          role="status"
        >
          {result.ok ? (
            <>
              <Check className="mt-[3px] size-3.5 shrink-0" strokeWidth={2.6} />
              <span>
                <span className="font-mono tracking-[0.06em]">{result.pin}</span> - free delivery,
                dispatched in {siteConfig.promise.dispatchHours} hrs, arrives within{" "}
                {siteConfig.promise.deliveryDays}.
              </span>
            </>
          ) : (
            <>
              <X className="mt-[3px] size-3.5 shrink-0" strokeWidth={2.6} />
              <span>{result.message}</span>
            </>
          )}
        </p>
      ) : null}
    </div>
  )
}
