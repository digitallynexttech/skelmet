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
  /** Extra headers, e.g. the newsletter's List-Unsubscribe pair. */
  headers?: Record<string, string>
}

export type MailAttachment = { filename: string; content: Buffer; contentType: string }

/**
 * How long to wait on the mail server. nodemailer's own defaults are two
 * minutes to connect and ten for a quiet socket, which is how a mail server
 * that stopped answering held a request open for minutes.
 */
export const SMTP_TIMEOUTS = {
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
} as const

/**
 * An address as the logs show it: `r***@example.in`. Enough to tell two
 * customers apart when chasing a failure, without the logs becoming a list
 * of every buyer's email.
 */
export function maskEmail(address: string): string {
  const at = address.lastIndexOf("@")
  if (at <= 0) return "***"
  return `${address[0]}***${address.slice(at)}`
}

export function isMailConfigured(): boolean {
  return Boolean(getEnv().SMTP_HOST)
}

export async function sendMail(input: MailInput): Promise<MailResult> {
  if (!isMailConfigured()) {
    // Warn, not error: on a machine with no SMTP this is the expected path and
    // logging it at error level would train people to ignore the log.
    console.warn(
      `[MAILER] SMTP not configured, skipped "${input.subject}" to ${maskEmail(input.to)}`,
    )
    return { ok: true, delivered: false, reason: "unconfigured" }
  }

  try {
    const nodemailer = (await import("nodemailer")).default
    return await deliver(nodemailer.createTransport(transportOptions()), input)
  } catch (err) {
    return failed(input, err)
  }
}

/**
 * One connection for sending the same email to a list, one message at a time.
 * sendMail logs in afresh for every message, which is right for a receipt; for
 * a few hundred in a row it is a few hundred logins, and Gmail reads that as
 * abuse. Close it when the list is done.
 *
 * Same rules as sendMail: `send` never throws, and with SMTP unconfigured
 * every send is a no-op that says so.
 */
export type MailPool = {
  send: (input: MailInput) => Promise<MailResult>
  close: () => void
}

export async function openMailPool(): Promise<MailPool> {
  if (!isMailConfigured()) return { send: sendMail, close: () => {} }

  const nodemailer = (await import("nodemailer")).default
  const transport = nodemailer.createTransport({
    ...transportOptions(),
    pool: true,
    maxConnections: 1,
  })
  return {
    send: async (input) => {
      try {
        return await deliver(transport, input)
      } catch (err) {
        return failed(input, err)
      }
    },
    close: () => transport.close(),
  }
}

function transportOptions() {
  const env = getEnv()
  return {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    // 465 is implicit TLS; everything else starts plain and upgrades.
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    ...SMTP_TIMEOUTS,
  }
}

async function deliver(
  transport: { sendMail: (message: object) => Promise<{ messageId?: string }> },
  input: MailInput,
): Promise<MailResult> {
  const info = await transport.sendMail({
    from: getEnv().MAIL_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
    ...(input.html ? { html: input.html } : {}),
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
    ...(input.attachments?.length ? { attachments: input.attachments } : {}),
    ...(input.headers ? { headers: input.headers } : {}),
  })
  return { ok: true, delivered: true, messageId: info.messageId ?? null }
}

function failed(input: MailInput, err: unknown): MailResult {
  const error = err instanceof Error ? err.message : String(err)
  console.error(`[MAILER] send failed to ${maskEmail(input.to)}:`, error)
  return { ok: false, delivered: false, error }
}
