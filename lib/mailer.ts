import "server-only"

import { getEnv } from "@/lib/env"

/**
 * SMTP, with two rules that matter more than anything else here.
 *
 * It NEVER throws into a caller. Sending a receipt is not part of taking
 * money, and a mail server that is slow, full or simply wrong must not turn a
 * captured payment into a failed checkout. Every path returns a result object.
 *
 * It NO-OPS when SMTP is unconfigured, rather than failing. With SMTP_HOST
 * unset nothing is sent, `delivered` comes back false, and the order completes
 * exactly as it would have - which is what lets the whole flow be built and
 * tested before the credentials exist.
 *
 * nodemailer is imported dynamically so a route that never sends mail does not
 * pull it into its bundle.
 */
export type MailResult =
  | { ok: true; delivered: true; messageId: string | null }
  | { ok: true; delivered: false; reason: "unconfigured" }
  | { ok: false; delivered: false; error: string }

export type MailInput = {
  to: string
  subject: string
  text: string
  html?: string
  replyTo?: string
  attachments?: MailAttachment[]
}

export type MailAttachment = { filename: string; content: Buffer; contentType: string }

export function isMailConfigured(): boolean {
  return Boolean(getEnv().SMTP_HOST)
}

export async function sendMail(input: MailInput): Promise<MailResult> {
  if (!isMailConfigured()) {
    // Warn, not error: on a machine with no SMTP this is the expected path and
    // logging it at error level would train people to ignore the log.
    console.warn(`[MAILER] SMTP not configured, skipped "${input.subject}" to ${input.to}`)
    return { ok: true, delivered: false, reason: "unconfigured" }
  }

  try {
    const env = getEnv()
    const nodemailer = (await import("nodemailer")).default

    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      // 465 is implicit TLS; everything else starts plain and upgrades.
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    })

    const info = await transport.sendMail({
      from: env.MAIL_FROM,
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
      ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      ...(input.attachments?.length ? { attachments: input.attachments } : {}),
    })

    return { ok: true, delivered: true, messageId: info.messageId ?? null }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error(`[MAILER] send failed to ${input.to}:`, error)
    return { ok: false, delivered: false, error }
  }
}
