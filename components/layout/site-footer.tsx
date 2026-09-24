import Link from "next/link"
import { InstagramIcon, WhatsappIcon, YoutubeIcon } from "@/components/shared/social-icons"

import { Wordmark } from "@/components/shared/wordmark"
import { footerNav } from "@/config/nav"
import { siteConfig } from "@/config/site"

const SOCIALS = [
  { href: siteConfig.social.instagram, label: "Instagram", Icon: InstagramIcon },
  { href: siteConfig.social.youtube, label: "YouTube", Icon: YoutubeIcon },
  { href: siteConfig.social.whatsapp, label: "WhatsApp", Icon: WhatsappIcon },
]

export function SiteFooter() {
  return (
    <footer className="bg-carbon relative overflow-hidden border-t border-white/[0.07] px-5 pt-16 sm:px-8 xl:px-14">
      <div className="grid gap-12 pb-14 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div>
          <Wordmark className="mb-5" />
          <p className="text-ash mb-6 max-w-[300px] text-[14.5px] leading-[1.6]">
            Somewhere proper to put your helmet. Designed, made and shipped from {siteConfig.city}.
          </p>
          <div className="flex gap-2.5">
            {SOCIALS.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                target="_blank"
                rel="noreferrer noopener"
                className="text-ash hover:text-bone flex size-11 items-center justify-center rounded-full border border-white/[0.14] transition-colors hover:border-white/30"
              >
                <Icon className="size-[17px]" />
              </a>
            ))}
          </div>
        </div>

        {footerNav.map((group) => (
          <div key={group.title} className="flex flex-col gap-3.5">
            <div className="text-dim mb-1 font-mono text-[11px] tracking-[0.2em] uppercase">
              {group.title}
            </div>
            {group.items.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-ash hover:text-bone text-[14.5px] transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </div>

      <div className="text-dim flex flex-col gap-3 border-t border-white/[0.07] py-6 font-mono text-[11.5px] tracking-[0.1em] sm:flex-row sm:items-center sm:justify-between">
        <span>
          © {new Date().getFullYear()} SKELMET · {siteConfig.legalEntity} · GSTIN {siteConfig.gstin}
        </span>
        <span>MADE &amp; PACKED IN INDIA</span>
      </div>

      {/* Oversized outline wordmark sitting on the footer edge.
          leading 0.92 is derived, not guessed: Anton's cap-height is 0.8594em
          and its natural content box is 1.5054em, so the box only contains the
          caps from ~0.872 upward. Anything lower (this was 0.74 with a -6vw
          pull) clips the letterforms against the footer's overflow-hidden. */}
      <div
        aria-hidden="true"
        className="font-display pb-[0.6vw] text-center text-[19vw] leading-[0.92] tracking-[0.02em] text-transparent select-none [-webkit-text-stroke:1px_rgb(255_90_31_/_0.42)]"
      >
        SKELMET
      </div>
    </footer>
  )
}
