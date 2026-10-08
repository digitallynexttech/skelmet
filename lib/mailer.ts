import "server-only"

import { getEnv } from "@/lib/env"

/**
 * Email, sent by the first of up to three routes that takes it:
 *
 *   1. Brevo's API, as BREVO_FROM (no-reply@skelmet.in)      BREVO_API_KEY
 *   2. Brevo's SMTP relay, as the same sender                BREVO_SMTP_LOGIN + BREVO_SMTP_KEY
 *   3. The shop's own SMTP account (Gmail), as MAIL_FROM     SMTP_HOST, SMTP_USER, SMTP_PASSWORD
 *
 * Each is used only when it is configured, and a route that fails hands the
 * message to the next. Brevo's API and its relay are two doors into one
 * account - a bad API key or an IP Brevo has not authorised stops one and not
 * the other - and Gmail is another company altogether, so a Brevo outage or a
 * spent daily quota still gets the receipt out, from the Gmail address.
 *
 * The cost of falling through: an API call that timed out may still have been
 * accepted, and the next route then sends a second copy. A receipt twice beats
 * no receipt.
 *
 * Two rules matter more than anything else here.
 *
 * It NEVER throws into a caller. Sending a receipt is not part of taking
 * money, and a mail server that is slow, full or simply wrong must not turn a
 * captured payment into a failed checkout. Every path returns a result object.
 *
 * It NO-OPS when no route is configured, rather than failing: nothing is sent,
 * `delivered` comes back false, and the order completes exactly as it would
 * have - which is what lets the whole flow be built and tested before the
 * credentials exist.
 *
 * nodemailer is imported dynamically so a route that never sends mail does not
 * pull it into its bundle.
 */
export type MailResult =
  | { ok: true; delivered: true; messageId: string | null; via: MailVia }
  | { ok: true; delivered: false; reason: "unconfigured" }
  | { ok: false; delivered: false; error: string; refusals: MailRefusal[] }

/** One route's refusal: the newsletter pauses only when every route says "later". */
export type MailRefusal = { via: MailVia; error: string }

/** Which route delivered it: Brevo's API, Brevo's SMTP relay, or the shop's own SMTP. */
export type MailVia = "brevo-api" | "brevo-smtp" | "smtp"

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
 * How long to wait on a mail server. nodemailer's own defaults are two
 * minutes to connect and ten for a quiet socket, which is how a mail server
 * that stopped answering held a request open for minutes.
 */
export const SMTP_TIMEOUTS = {
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
} as const

/** The same patience for Brevo's API, which answers in well under a second. */
export const BREVO_API_TIMEOUT_MS = 15_000

export const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"
export const BREVO_SMTP_HOST = "smtp-relay.brevo.com"

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
  const env = getEnv()
  return Boolean(env.BREVO_API_KEY || brevoSmtpConfigured() || env.SMTP_HOST)
}

export async function sendMail(input: MailInput): Promise<MailResult> {
  const routes = configuredRoutes({ pooled: false })
  if (routes.length === 0) {
    // Warn, not error: on a machine with no mail set up this is the expected
    // path, and logging it at error level would train people to ignore the log.
    console.warn(
      `[MAILER] mail not configured, skipped "${input.subject}" to ${maskEmail(input.to)}`,
    )
    return { ok: true, delivered: false, reason: "unconfigured" }
  }
  try {
    return await sendThrough(routes, input)
  } finally {
    for (const route of routes) route.close()
  }
}

/**
 * For sending the same email to a list, one message at a time. Each SMTP
 * route keeps one connection open: sendMail logs in afresh for every message,
 * which is right for a receipt, but a few hundred logins in a row is what
 * Gmail reads as abuse. Brevo's API needs no connection. Close it when the
 * list is done.
 *
 * Same rules as sendMail: `send` never throws, and with nothing configured
 * every send is a no-op that says so.
 */
export type MailPool = {
  send: (input: MailInput) => Promise<MailResult>
  close: () => void
}

export async function openMailPool(): Promise<MailPool> {
  const routes = configuredRoutes({ pooled: true })
  if (routes.length === 0) return { send: sendMail, close: () => {} }
  return {
    send: (input) => sendThrough(routes, input),
    close: () => {
      for (const route of routes) route.close()
    },
  }
}

type Route = {
  via: MailVia
  /** Resolves to the message id, or throws why the route would not take it. */
  send: (input: MailInput) => Promise<string | null>
  close: () => void
}

async function sendThrough(routes: Route[], input: MailInput): Promise<MailResult> {
  const failures: MailRefusal[] = []
  for (const [i, route] of routes.entries()) {
    try {
      const messageId = await route.send(input)
      if (failures.length > 0) {
        console.warn(`[MAILER] sent to ${maskEmail(input.to)} via ${route.via} instead`)
      }
      return { ok: true, delivered: true, messageId, via: route.via }
    } catch (err) {
      // A provider's refusal can quote the address back; the logs must not.
      const error = scrub(err instanceof Error ? err.message : String(err), input.to)
      failures.push({ via: route.via, error })
      const next = routes[i + 1]
      if (next) {
        console.warn(
          `[MAILER] ${route.via} failed for ${maskEmail(input.to)} (${error}), trying ${next.via}`,
        )
      }
    }
  }
  // One route: its own words, which the console shows staff as they are.
  // Several: each route's, so the log says which door refused and why.
  const error =
    failures.length === 1
      ? failures[0]!.error
      : failures.map((f) => `${f.via}: ${f.error}`).join("; ")
  console.error(`[MAILER] send failed to ${maskEmail(input.to)}:`, error)
  return { ok: false, delivered: false, error, refusals: failures }
}

function configuredRoutes({ pooled }: { pooled: boolean }): Route[] {
  const env = getEnv()
  const routes: Route[] = []
  if (env.BREVO_API_KEY) routes.push(brevoApiRoute(env.BREVO_API_KEY, env.BREVO_FROM))
  if (brevoSmtpConfigured()) {
    routes.push(
      smtpRoute("brevo-smtp", env.BREVO_FROM, pooled, {
        host: BREVO_SMTP_HOST,
        port: 587,
        secure: false,
        auth: { user: env.BREVO_SMTP_LOGIN!, pass: env.BREVO_SMTP_KEY! },
      }),
    )
  }
  if (env.SMTP_HOST) {
    routes.push(
      smtpRoute("smtp", env.MAIL_FROM, pooled, {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        // 465 is implicit TLS; everything else starts plain and upgrades.
        secure: env.SMTP_PORT === 465,
        auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD ?? "" } : undefined,
      }),
    )
  }
  return routes
}

function brevoSmtpConfigured(): boolean {
  const env = getEnv()
  return Boolean(env.BREVO_SMTP_LOGIN && env.BREVO_SMTP_KEY)
}

/** Where a reply goes: the caller's choice, else MAIL_REPLY_TO, else the sender. */
function replyToFor(input: MailInput): string | undefined {
  return input.replyTo ?? getEnv().MAIL_REPLY_TO
}

// ── Brevo's API ─────────────────────────────────────────────

function brevoApiRoute(apiKey: string, from: string): Route {
  return {
    via: "brevo-api",
    send: async (input) => {
      const res = await fetch(BREVO_API_URL, {
        method: "POST",
        headers: {
          "api-key": apiKey,
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(brevoMessage(input, from, replyToFor(input))),
        signal: AbortSignal.timeout(BREVO_API_TIMEOUT_MS),
      })
      const body = await res.text()
      if (!res.ok) throw new Error(`Brevo API ${res.status}: ${brevoError(body)}`)
      // Taken: from here nothing may throw, or the next route sends it again.
      try {
        const id = (JSON.parse(body) as { messageId?: unknown }).messageId
        return typeof id === "string" ? id : null
      } catch {
        return null
      }
    },
    close: () => {},
  }
}

/** The message as Brevo's transactional API takes it. Exported for tests. */
export function brevoMessage(input: MailInput, from: string, replyTo?: string) {
  return {
    sender: parseAddress(from),
    to: [{ email: input.to }],
    subject: input.subject,
    // Brevo wants an HTML body; a plain-text email gets its text, escaped.
    htmlContent: input.html ?? textAsHtml(input.text),
    textContent: input.text,
    ...(replyTo ? { replyTo: parseAddress(replyTo) } : {}),
    ...(input.attachments?.length
      ? {
          attachment: input.attachments.map((a) => ({
            name: a.filename,
            content: a.content.toString("base64"),
          })),
        }
      : {}),
    ...(input.headers ? { headers: input.headers } : {}),
  }
}

/** Brevo's own words for a refusal ({ code, message }), or the body as it came. */
function brevoError(body: string): string {
  try {
    const parsed = JSON.parse(body) as { code?: string; message?: string }
    if (parsed.message) return parsed.code ? `${parsed.code}: ${parsed.message}` : parsed.message
  } catch {
    // Not JSON: a proxy's error page, say.
  }
  return body.slice(0, 200) || "no reason given"
}

/** `SKELMET <no-reply@skelmet.in>` as Brevo takes it: { name, email }. */
export function parseAddress(address: string): { email: string; name?: string } {
  const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(address)
  if (!match) return { email: address.trim() }
  const name = match[1]!.trim()
  return name ? { name, email: match[2]!.trim() } : { email: match[2]!.trim() }
}

function textAsHtml(text: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  return `<div style="white-space:pre-wrap">${escaped}</div>`
}

// ── SMTP: Brevo's relay or the shop's own account ───────────

type SmtpOptions = {
  host: string
  port: number
  secure: boolean
  auth?: { user: string; pass: string }
}

type Transport = {
  sendMail: (message: object) => Promise<{ messageId?: string }>
  close?: () => void
}

function smtpRoute(via: MailVia, from: string, pooled: boolean, options: SmtpOptions): Route {
  // Made on first use, so a message the API takes never loads nodemailer.
  let transport: Transport | null = null
  return {
    via,
    send: async (input) => {
      if (!transport) {
        const nodemailer = (await import("nodemailer")).default
        transport = nodemailer.createTransport({
          ...options,
          ...SMTP_TIMEOUTS,
          ...(pooled ? { pool: true, maxConnections: 1 } : {}),
        }) as Transport
      }
      const replyTo = replyToFor(input)
      const info = await transport.sendMail({
        from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
        ...(replyTo ? { replyTo } : {}),
        ...(input.attachments?.length ? { attachments: input.attachments } : {}),
        ...(input.headers ? { headers: input.headers } : {}),
      })
      return info.messageId ?? null
    },
    close: () => transport?.close?.(),
  }
}

/** The error text with the recipient's address masked, wherever it appears. */
function scrub(error: string, to: string): string {
  if (!to) return error
  const literal = to.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return error.replace(new RegExp(literal, "gi"), maskEmail(to))
}
