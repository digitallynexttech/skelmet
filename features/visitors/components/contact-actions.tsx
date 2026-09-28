import { Mail, Phone } from "lucide-react"

import { WhatsappIcon } from "@/components/shared/social-icons"
import { whatsappLink } from "@/features/visitors/lib/format"

const BUTTON =
  "text-ash hover:text-bone flex size-9 items-center justify-center rounded-md border border-white/[0.12] transition-colors hover:border-white/30"

/**
 * WhatsApp, call and email for someone who left without paying. The message
 * is only typed in, never sent: staff read it over and send it themselves.
 */
export function ContactActions({
  phone,
  email,
  message,
  subject,
}: {
  phone: string | null
  email: string | null
  message: string
  subject: string
}) {
  if (!phone && !email) return <span className="text-dim text-[12px]">No contact</span>

  return (
    <div className="flex items-center justify-end gap-1.5">
      {phone ? (
        <a
          href={whatsappLink(phone, message)}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={`WhatsApp ${phone}`}
          title="WhatsApp"
          className={BUTTON}
        >
          <WhatsappIcon className="size-4" />
        </a>
      ) : null}
      {phone ? (
        <a href={`tel:+91${phone}`} aria-label={`Call ${phone}`} title="Call" className={BUTTON}>
          <Phone className="size-4" strokeWidth={1.9} />
        </a>
      ) : null}
      {email ? (
        <a
          href={`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`}
          aria-label={`Email ${email}`}
          title="Email"
          className={BUTTON}
        >
          <Mail className="size-4" strokeWidth={1.9} />
        </a>
      ) : null}
    </div>
  )
}
