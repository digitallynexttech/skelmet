"use client"

import * as React from "react"
import { Check, MapPin, X } from "lucide-react"

import { siteConfig } from "@/config/site"
import { apiFetch } from "@/lib/api-fetch"
import { cn } from "@/lib/utils"

/**
 * Delivery check.
 *
 * Two questions, in order. Is it a pincode at all - six digits, never starting
 * with zero, since 0 is not an allocated postal circle - which is answered
 * here without a request. Then, can a courier reach it: that one is
 * Shiprocket's (via /api/public/shipping/pincode), and costs a request.
 *
 * The time it quotes is always the shop's own promise, the same one checkout
 * shows. Shiprocket's transit days start at pickup, after the shop has packed
 * and dispatched, so quoting them promised a delivery the shop cannot make.
 *
 * Shiprocket is an improvement, never a dependency. When it is not set up,
 * rate-limits us, or simply does not answer, the check falls back to the
 * promise it made before Shiprocket existed rather than showing an error for a
 * pincode that is almost certainly fine.
 *
 * The field is digits-only at the source rather than validated after the
 * fact, so letters simply cannot be typed into it.
 */
const PINCODE = /^[1-9][0-9]{5}$/

type Answer = { live: boolean; serviceable: boolean; found: boolean }

type Result = { ok: true; pin: string } | { ok: false; message: string }

export function PincodeCheck({ className }: { className?: string }) {
  const [pin, setPin] = React.useState("")
  const [result, setResult] = React.useState<Result | null>(null)
  const [checking, setChecking] = React.useState(false)

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    // Strip on the way in: paste, autofill and keypress all land here.
    setPin(event.target.value.replace(/\D/g, "").slice(0, 6))
    // Clearing in the handler, not an effect - a stale answer beside a
    // half-edited pincode is worse than no answer.
    setResult(null)
  }

  async function check() {
    if (!PINCODE.test(pin)) {
      setResult({
        ok: false,
        message: pin.length === 0 ? "Enter your pincode." : "That is not a valid pincode.",
      })
      return
    }

    const asked = pin
    setChecking(true)
    try {
      const answer = await apiFetch<Answer>(
        `/api/public/shipping/pincode?pincode=${encodeURIComponent(asked)}`,
      )
      setResult(
        answer.live && !answer.found
          ? { ok: false, message: `We couldn't find pincode ${asked}. Check the number.` }
          : answer.live && !answer.serviceable
            ? {
                ok: false,
                message: `Couriers don't reach ${asked} yet. Message us and we'll try to arrange it.`,
              }
            : { ok: true, pin: asked },
      )
    } catch {
      // Rate-limited, offline, Shiprocket down: the static promise still holds.
      setResult({ ok: true, pin: asked })
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className={className}>
      <div className="bg-carbon flex h-[54px] items-center gap-2.5 rounded-lg border border-white/10 px-4 focus-within:border-white/25">
        <MapPin className="text-ember size-[17px] shrink-0" strokeWidth={1.7} />
        <input
          value={pin}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              void check()
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
          onClick={() => void check()}
          disabled={checking}
          className="text-acid hover:text-bone shrink-0 font-mono text-[11px] font-bold tracking-[0.1em] transition-colors disabled:opacity-60"
        >
          {checking ? "CHECKING" : "CHECK"}
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
