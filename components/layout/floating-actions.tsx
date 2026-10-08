"use client"

import { useSyncExternalStore } from "react"
import { ArrowUp } from "lucide-react"

import { WhatsappIcon } from "@/components/shared/social-icons"
import { siteConfig } from "@/lib/config/site"
import { cn } from "@/lib/utils"

const BUTTON =
  "flex size-12 items-center justify-center rounded-full shadow-[0_10px_28px_rgb(0_0_0_/_0.5)] transition-[background-color,border-color,color,scale,filter] duration-200"

const SHOW_AFTER = 300 // px scrolled

const scrolledDown = () => window.scrollY > SHOW_AFTER
const notScrolled = () => false

function onScroll(notify: () => void) {
  window.addEventListener("scroll", notify, { passive: true })
  return () => window.removeEventListener("scroll", notify)
}

/**
 * WhatsApp and back-to-top, bottom right, once the page is scrolled. Above the skull, below the
 * header, menu and cookie card. On a phone it rides above a `data-sticky-bar` and hides on a page
 * marked `data-clear-corner` (checkout).
 */
export function FloatingActions() {
  // Re-renders only when the answer flips, not on every scroll event.
  const shown = useSyncExternalStore(onScroll, scrolledDown, notScrolled)

  const toTop = () => {
    // Smooth, or instant under reduced motion, via `scroll-behavior` in globals.css.
    window.scrollTo({ top: 0 })
    // The buttons are about to hide: move focus to the top with the view.
    document.querySelector<HTMLElement>("header a[href]")?.focus({ preventScroll: true })
  }

  return (
    <div
      inert={!shown}
      className={cn(
        "fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-[35] flex flex-col gap-3 transition-[opacity,translate] duration-300 sm:right-6 sm:bottom-6",
        // The bar is a 1px rule, 12px, a 54px button and the safe area (16px at least).
        "max-lg:[body:has([data-sticky-bar])_&]:bottom-[calc(79px+max(1rem,env(safe-area-inset-bottom)))]",
        "max-lg:[body:has([data-clear-corner])_&]:hidden",
        shown ? "opacity-100" : "pointer-events-none translate-y-3 opacity-0",
      )}
    >
      <button
        type="button"
        onClick={toTop}
        aria-label="Back to top"
        title="Back to top"
        className={cn(
          BUTTON,
          "bg-graphite text-bone hover:bg-blaze hover:border-blaze hover:text-void focus-visible:bg-blaze focus-visible:border-blaze focus-visible:text-void border border-white/[0.14]",
        )}
      >
        <ArrowUp className="size-5" strokeWidth={2.2} aria-hidden />
      </button>

      <a
        href={siteConfig.social.whatsapp}
        target="_blank"
        rel="noreferrer noopener"
        aria-label="Chat with us on WhatsApp"
        title="Chat with us on WhatsApp"
        className={cn(BUTTON, "bg-whatsapp text-void hover:scale-105 hover:brightness-110")}
      >
        <WhatsappIcon className="size-6" />
      </a>
    </div>
  )
}
