import type { Metadata } from "next"

import { Section } from "@/components/marketing/section"
import { ButtonLink } from "@/components/ui/button"
import { siteConfig } from "@/config/site"
import { UnsubscribeButton } from "@/features/newsletter/components/unsubscribe-button"
import { subscriberForToken } from "@/features/newsletter/server/newsletter.service"

export const metadata: Metadata = {
  title: "Unsubscribe",
  description: "Leave the SKELMET drop list.",
  robots: { index: false, follow: false },
}

/**
 * Where the Unsubscribe link in every newsletter lands. It names the address,
 * masked, so a forwarded email cannot quietly take someone else off the list,
 * and asks for one press rather than acting on the visit.
 */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; preview?: string }>
}) {
  const { token, preview } = await searchParams
  const who = token ? await subscriberForToken(token) : null

  let title: string
  let body: React.ReactNode
  let action: React.ReactNode = null

  if (preview) {
    title = "Unsubscribe"
    body =
      "This is where a subscriber's Unsubscribe link lands. In a test email it leads here and nowhere else; in the real one, one press takes that reader off the list."
  } else if (!who) {
    title = "This link doesn't work"
    body = `It may have been cut short when it was copied. Email ${siteConfig.supportEmail} and we'll take you off the list by hand.`
  } else if (who.status === "UNSUBSCRIBED") {
    title = "You're off the list"
    body = `${who.email} won't get emails about new drops. If you change your mind, the Notify me form on the home page puts you back.`
  } else {
    title = "Leave the drop list?"
    body = `${who.email} will stop getting emails about new designs and colourways.`
    action = <UnsubscribeButton token={token!} />
  }

  return (
    <Section className="min-h-[60svh]">
      <div className="mx-auto max-w-[560px] py-10 text-center sm:py-16">
        <p className="text-dim mb-4 font-mono text-[11px] tracking-[0.22em] uppercase">
          Newsletter
        </p>
        <h1 className="font-display text-bone mb-5 text-[40px] leading-[1.04] uppercase sm:text-[52px]">
          {title}
        </h1>
        <p className="text-ash mb-8 text-[15.5px] leading-[1.65]">{body}</p>
        <div className="flex flex-col items-center gap-5">
          {action}
          <ButtonLink href="/" variant="ghost" size="sm">
            Back to the shop
          </ButtonLink>
        </div>
      </div>
    </Section>
  )
}
