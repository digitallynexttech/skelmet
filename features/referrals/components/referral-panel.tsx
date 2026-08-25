"use client"

import * as React from "react"
import { Check, Copy, Mail, Share2 } from "lucide-react"
import { toast } from "sonner"

import { InstagramIcon, WhatsappIcon } from "@/components/shared/social-icons"
import { Button } from "@/components/ui/button"
import { REFERRAL_REWARD } from "@/lib/constants"

/** Sample code: replaced by the signed-in user's real code once auth is live. */
const CODE = "ROHAN-8F2K"

export function ReferralPanel() {
  const [copied, setCopied] = React.useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(CODE)
      setCopied(true)
      toast.success("Code copied", { description: "Paste it into the group chat." })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Couldn't copy", { description: "Select the code and copy it manually." })
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="rounded-card border border-acid/30 bg-[linear-gradient(160deg,rgb(212_255_61_/_0.08),transparent_54%)] bg-carbon p-6 sm:p-7">
        <div className="mb-3.5 font-mono text-[10px] tracking-[0.16em] text-dim uppercase">
          Your balance
        </div>
        <div className="mb-6 flex items-baseline gap-3">
          <span className="font-display text-[52px] leading-none text-acid sm:text-[64px]">
            &#8377;1,250
          </span>
          <span className="text-[14px] text-ash">from 5 referrals</span>
        </div>
        <Button variant="accent" size="md" full>
          Cash out to UPI
        </Button>
      </div>

      <div className="rounded-card border border-white/10 bg-carbon p-6 sm:p-7">
        <div className="mb-3.5 font-mono text-[10px] tracking-[0.16em] text-dim uppercase">
          Your code
        </div>
        <button
          type="button"
          onClick={copy}
          className="mb-4 flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-white/25 bg-void px-5 py-4 transition-colors hover:border-white/45"
        >
          <span className="font-display leading-[1.08] text-[24px] tracking-[0.1em] text-bone sm:text-[28px]">
            {CODE}
          </span>
          {copied ? (
            <Check className="size-[18px] shrink-0 text-acid" strokeWidth={2.4} />
          ) : (
            <Copy className="size-[18px] shrink-0 text-ash" strokeWidth={1.8} />
          )}
        </button>

        <div className="grid grid-cols-3 gap-2.5">
          <button
            type="button"
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.14] font-mono text-[10px] tracking-[0.08em] text-bone transition-colors hover:border-white/30"
          >
            <WhatsappIcon className="size-3.5 text-acid" />
            CHAT
          </button>
          <button
            type="button"
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.14] font-mono text-[10px] tracking-[0.08em] text-bone transition-colors hover:border-white/30"
          >
            <InstagramIcon className="size-3.5 text-acid" />
            STORY
          </button>
          <button
            type="button"
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/[0.14] font-mono text-[10px] tracking-[0.08em] text-bone transition-colors hover:border-white/30"
          >
            <Mail className="size-3.5 text-acid" strokeWidth={1.9} />
            EMAIL
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-tile border border-white/[0.08] bg-carbon p-5">
        <Share2 className="size-5 shrink-0 text-violet" strokeWidth={1.8} />
        <p className="text-[13.5px] leading-[1.5] text-ash">
          Six mates and this order paid for itself. &#8377;{REFERRAL_REWARD} each way, no cap.
        </p>
      </div>
    </div>
  )
}
