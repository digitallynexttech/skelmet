import "server-only"

import { getEnv } from "@/lib/env"

/**
 * Routes, each only when set, falling through on failure: Brevo API, then Brevo
 * SMTP (both from BREVO_FROM), then Gmail SMTP (MAIL_FROM). A fall-through after
 * a timeout can send twice; better than no receipt.
 * Never throws (mail must not fail a paid checkout); with no route it is a no-op.
 */
export type MailResult =
  | { ok: true; delivered: true; messageId: string | null; via: MailVia }
  | { ok: true; delivered: false; reason: "unconfigured" }
  | { ok: false; delivered: false; error: string; refusals: MailRefusal[] }

/** One route's refusal: the newsletter pauses only when every route says "later". */
export type MailRefusal = { via: MailVia; error: string }

export type MailVia = "brevo-api" | "brevo-smtp" | "smtp"

export type MailInput = {
  to: string
  subject: string
  text: string
  html?: string
  replyTo?: string
  attachments?: MailAttachment[]
  /** E.g. the newsletter's List-Unsubscribe pair. */
  headers?: Record<string, string>
}

export type MailAttachment = { filename: string; content: Buffer; contentType: string }

/** nodemailer's defaults (2 min to connect, 10 idle) hold a request open for minutes. */
export const SMTP_TIMEOUTS = {
  connectionTimeout: 10_000,
  greetingTimeout: 10_000,
  socketTimeout: 20_000,
} as const

export const BREVO_API_TIMEOUT_MS = 15_000

export const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"
export const BREVO_SMTP_HOST = "smtp-relay.brevo.com"

/** `r***@example.in`: tells customers apart in logs without logging addresses. */
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
    // Warn, not error: expected on a machine with no mail set up.
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
 * For list sends: one SMTP connection per route, since hundreds of logins in a
 * row look like abuse to Gmail. `send` never throws. Close when done.
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
  /** Resolves to the message id; throws when the route refuses. */
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
  // One route: its error as is (staff see it). Several: each labelled by route.
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

/** Brevo's transactional API body. Exported for tests. */
export function brevoMessage(input: MailInput, from: string, replyTo?: string) {
  return {
    sender: parseAddress(from),
    to: [{ email: input.to }],
    subject: input.subject,
    // Brevo requires an HTML body.
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

function brevoError(body: string): string {
  try {
    const parsed = JSON.parse(body) as { code?: string; message?: string }
    if (parsed.message) return parsed.code ? `${parsed.code}: ${parsed.message}` : parsed.message
  } catch {
    // Not JSON, e.g. a proxy's error page.
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

function scrub(error: string, to: string): string {
  if (!to) return error
  const literal = to.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return error.replace(new RegExp(literal, "gi"), maskEmail(to))
}
