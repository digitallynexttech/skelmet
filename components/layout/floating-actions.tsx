"use client"

import { useSyncExternalStore } from "react"
import { ArrowUp } from "lucide-react"

import { WhatsappIcon } from "@/components/shared/social-icons"
import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"

const BUTTON =
  "flex size-12 items-center justify-center rounded-full shadow-[0_10px_28px_rgb(0_0_0_/_0.5)] transition-[background-color,border-color,color,scale,filter] duration-200"

// How far down before the pair appears: the first screen of a page - the
// hero and its own button - is left alone.
const SHOW_AFTER = 300

const scrolledDown = () => window.scrollY > SHOW_AFTER
const notScrolled = () => false

function onScroll(notify: () => void) {
  window.addEventListener("scroll", notify, { passive: true })
  return () => window.removeEventListener("scroll", notify)
}

/**
 * The two buttons that follow the visitor down the page, bottom right: a
 * WhatsApp chat with the shop and the way back to the top. Neither is there
 * on the first screen; both arrive together once the page has been scrolled.
 *
 * Over the flying skull; under the header, the phone menu, the cookie card -
 * which on a phone covers this corner until it has its answer - and a bar
 * stuck to the bottom of a phone (`data-sticky-bar`, the product page's Buy
 * now). The pair rides above that bar, and when the bar lets go and scrolls
 * up through them it passes over them, not under. A page that needs the
 * corner to itself on a phone says so with `data-clear-corner`: the cart and
 * checkout, where the buttons would sit on Checkout and Pay.
 */
export function FloatingActions() {
  // Read from the scroll position, not kept in state: React re-renders only
  // when the answer flips, however many scroll events go by.
  const shown = useSyncExternalStore(onScroll, scrolledDown, notScrolled)

  const toTop = () => {
    // `scroll-behavior` in globals.css makes this smooth, and instant for
    // anyone who has asked for less motion.
    window.scrollTo({ top: 0 })
    // The buttons are about to hide; leave keyboard focus at the top of the
    // page with the view, not on something that is no longer there.
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
