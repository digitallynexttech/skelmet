import Image from "next/image"
import Link from "next/link"
import { InstagramIcon, WhatsappIcon, YoutubeIcon } from "@/components/shared/social-icons"

import { BRAND_LOCKUP_VECTOR } from "@/components/shared/wordmark"
import { footerNav } from "@/config/nav"
import { siteConfig } from "@/config/site"

const SOCIALS = [
  { href: siteConfig.social.instagram, label: "Instagram", Icon: InstagramIcon },
  { href: siteConfig.social.youtube, label: "YouTube", Icon: YoutubeIcon },
  { href: siteConfig.social.whatsapp, label: "WhatsApp", Icon: WhatsappIcon },
]

const COLUMN_TITLE = "text-dim mb-1 font-mono text-[11px] tracking-[0.2em] uppercase"

/**
 * `cookieSettings` is handed in by the storefront layout rather than imported
 * here: the control belongs to the visitors feature, and components/ never
 * reaches into features/.
 */
export function SiteFooter({ cookieSettings }: { cookieSettings?: React.ReactNode }) {
  return (
    <footer className="bg-carbon relative overflow-hidden border-t border-white/[0.07] px-5 pt-16 sm:px-8 xl:px-14">
      {/* Five columns once there is room: what the shop is, the three lists
          of links, and who to reach. No logo up here - it signs the footer off
          below. In two columns the first takes the full row, so the lists
          pair off under it. */}
      <div className="grid gap-12 pb-14 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1.2fr_1.35fr] lg:gap-8 xl:gap-12">
        <div className="sm:col-span-2 lg:col-span-1">
          <p className="text-ash mb-6 max-w-[420px] text-[14.5px] leading-[1.6] lg:max-w-[300px]">
            {siteConfig.description}
          </p>
          <div className="flex gap-2.5">
            {SOCIALS.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                target="_blank"
                rel="noreferrer noopener"
                className="text-ash hover:bg-blaze hover:border-blaze hover:text-void focus-visible:bg-blaze focus-visible:border-blaze focus-visible:text-void flex size-11 items-center justify-center rounded-full border border-white/[0.14] transition-colors duration-200"
              >
                <Icon className="size-[18px]" />
              </a>
            ))}
          </div>
        </div>

        {footerNav.map((group) => (
          <div key={group.title} className="flex flex-col gap-3.5">
            <div className={COLUMN_TITLE}>{group.title}</div>
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

        {/* Who the buyer is dealing with and how to reach them, on every
            page: the E-Commerce Rules ask for the seller's name, address
            and contact details to be shown, not just filed. */}
        <div className="flex flex-col gap-3.5">
          <div className={COLUMN_TITLE}>Contact</div>
          <address className="text-ash flex flex-col gap-3.5 text-[14.5px] not-italic">
            <span>
              {siteConfig.legalEntity}
              <span className="text-dim mt-1.5 block text-[13px] leading-[1.6]">
                {siteConfig.address.line1}
                <br />
                {siteConfig.address.city} {siteConfig.address.pin}
              </span>
            </span>
            <a
              href={`tel:${siteConfig.phone.replace(/\s/g, "")}`}
              className="hover:text-bone transition-colors"
            >
              {siteConfig.phone}
            </a>
            <a
              href={`mailto:${siteConfig.email}`}
              className="hover:text-bone break-words transition-colors"
            >
              {siteConfig.email}
            </a>
          </address>
        </div>
      </div>

      <div className="text-dim flex flex-col gap-3 border-t border-white/[0.07] py-6 font-mono text-[11.5px] tracking-[0.1em] sm:flex-row sm:items-center sm:justify-between">
        {/* The legal form and the GSTIN are on the contact page and in the
            policies; here the line only says whose site it is. */}
        <span>
          © {new Date().getFullYear()} SKELMET · {siteConfig.legalEntity}
        </span>
        <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {cookieSettings}
          <span>MADE &amp; PACKED IN INDIA</span>
        </span>
      </div>

      {/* The logo, oversized, signing the page off - where the name used to be
          set in outlined type. Decorative: the lockup in the header is the one
          that is named and linked. The vector copy, because this is drawn
          wider than the PNG's 896px; fetched only when scrolled to. */}
      <div aria-hidden="true" className="flex justify-center pt-2 pb-[3.5vw] select-none">
        <Image
          src={BRAND_LOCKUP_VECTOR.src}
          width={BRAND_LOCKUP_VECTOR.width}
          height={BRAND_LOCKUP_VECTOR.height}
          alt=""
          loading="lazy"
          unoptimized
          // Narrower on a phone, where the floating buttons share this corner.
          className="h-auto w-[min(60vw,1040px)] sm:w-[min(66vw,1040px)]"
        />
      </div>
    </footer>
  )
}
