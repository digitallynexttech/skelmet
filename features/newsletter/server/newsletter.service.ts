import "server-only"

import { randomBytes } from "node:crypto"

import { siteConfig } from "@/config/site"
import { paginate } from "@/lib/api-response"
import { MAX_PAGE_SIZE, PAGE_SIZE, PERMISSIONS } from "@/lib/constants"
import { hasDatabase } from "@/lib/env"
import { isMailConfigured, maskEmail, openMailPool, sendMail } from "@/lib/mailer"
import { createAuditLog, getAuditMeta } from "@/server/audit"
import { fail, ok, runAction, type ActionResult } from "@/server/action-result"
import { requirePermission } from "@/server/action-guard"
import { db } from "@/server/db"
import { later } from "@/server/later"
import { renderNewsletter, unsubscribeHeaders } from "@/features/newsletter/emails/newsletter-email"
import {
  sendCampaignSchema,
  subscribeSchema,
  unsubscribeSchema,
} from "@/features/newsletter/schemas/newsletter.schema"

/**
 * The drop list: who asked to hear about new drops, and the emails staff send
 * them from the console.
 *
 * Sending goes through the shop's own SMTP account, one message per person so
 * each carries its own unsubscribe link, paced and over one connection. The
 * account is a Gmail one, which allows about 500 emails a day; when the mail
 * server says the day's allowance is spent, the campaign pauses where it got
 * to and a later Resume sends the rest. Every delivery is claimed before it is
 * sent, so a campaign resumed after a restart never emails anyone twice.
 */

export type SubscriberStatus = "SUBSCRIBED" | "UNSUBSCRIBED"

export type SubscriberRow = {
  id: string
  email: string
  status: SubscriberStatus
  source: string
  subscribedAt: string
  unsubscribedAt: string | null
}

export type CampaignStatus = "SENDING" | "PAUSED" | "SENT"

export type CampaignRow = {
  id: string
  subject: string
  body: string
  ctaLabel: string | null
  ctaUrl: string | null
  status: CampaignStatus
  /** Sending right now in this server. SENDING without it was cut off by a restart. */
  running: boolean
  recipients: number
  sent: number
  failed: number
  note: string | null
  sentByEmail: string | null
  createdAt: string
  finishedAt: string | null
}

/** Between two emails of one campaign: about 40 a minute, well inside what Gmail tolerates. */
export const SEND_GAP_MS = 1500
/** Subscribers fetched at a time while sending. */
const BATCH = 25
/** Campaigns shown in the console's history. */
const HISTORY = 30

/**
 * What a mail server says when it will take no more for now: Gmail's daily
 * limit (5.4.5), its rate and login throttles (4.7.x), and the wording other
 * servers use for the same. Worth pausing on rather than failing everyone left.
 */
const COME_BACK_LATER = /5\.4\.5|4\.7\.\d|sending limit|quota|try again later|too many/i

/**
 * Campaigns sending in this server process. It is a single process (pm2 fork
 * mode), so this is the whole truth: a SENDING row missing from here was cut
 * off by a restart and waits for Resume.
 */
const running = new Set<string>()

const newToken = () => randomBytes(32).toString("hex")

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** The two ways off the list in every email: a page for people, a URL for mail clients. */
export function unsubscribeLinks(token: string) {
  const t = encodeURIComponent(token)
  return {
    page: `${siteConfig.url}/unsubscribe?token=${t}`,
    oneClick: `${siteConfig.url}/api/public/newsletter/unsubscribe?token=${t}`,
  }
}

function honeypotFilled(raw: unknown): boolean {
  if (typeof raw !== "object" || raw === null || !("website" in raw)) return false
  const pot = (raw as { website?: unknown }).website
  return typeof pot === "string" && pot.length > 0
}

/**
 * Public: the home page's "Notify me". No session, so the route rate-limits
 * by IP and the honeypot catches the bots that fill every field they find.
 *
 * Answers the same whether the address was new, already on the list or
 * coming back, so the form cannot be used to find out who has signed up.
 */
export async function subscribe(raw: unknown): Promise<ActionResult<{ subscribed: true }>> {
  return runAction(async () => {
    // Before parsing: the schema rejects a filled honeypot, and a validation
    // error would tell the bot which check it tripped.
    if (honeypotFilled(raw)) return ok({ subscribed: true })
    const input = subscribeSchema.parse(raw)
    if (!hasDatabase()) return fail("Sign-ups are not available yet.", undefined, 503)

    const email = input.email.trim().toLowerCase()
    const row = await db.subscriber.upsert({
      where: { email },
      create: { email, source: "drop-list", token: newToken() },
      update: {},
      select: { status: true },
    })
    // Signing up again after leaving is a new consent, dated now.
    if (row.status === "UNSUBSCRIBED") {
      await db.subscriber.update({
        where: { email },
        data: { status: "SUBSCRIBED", subscribedAt: new Date(), unsubscribedAt: null },
      })
    }
    return ok({ subscribed: true })
  })
}

/** Public: who a link belongs to, masked, for the unsubscribe page to name. */
export async function subscriberForToken(
  token: string,
): Promise<{ email: string; status: SubscriberStatus } | null> {
  const parsed = unsubscribeSchema.safeParse({ token })
  if (!parsed.success || !hasDatabase()) return null
  const row = await db.subscriber.findUnique({
    where: { token: parsed.data.token },
    select: { email: true, status: true },
  })
  return row ? { email: maskEmail(row.email), status: row.status } : null
}

/**
 * Public: the link in every email, and the one-click unsubscribe a mail
 * client sends. The token is the whole credential. Doing it twice is fine.
 */
export async function unsubscribe(raw: unknown): Promise<ActionResult<{ email: string }>> {
  return runAction(async () => {
    const { token } = unsubscribeSchema.parse(raw)
    if (!hasDatabase()) return fail("Not available right now.", undefined, 503)

    const row = await db.subscriber.findUnique({
      where: { token },
      select: { id: true, email: true, status: true },
    })
    if (!row) return fail("That unsubscribe link is not valid.", undefined, 404)

    if (row.status === "SUBSCRIBED") {
      await db.subscriber.update({
        where: { id: row.id },
        data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() },
      })
    }
    return ok({ email: maskEmail(row.email) })
  })
}

function serializeSubscriber(row: {
  id: string
  email: string
  status: SubscriberStatus
  source: string
  subscribedAt: Date
  unsubscribedAt: Date | null
}): SubscriberRow {
  return {
    ...row,
    subscribedAt: row.subscribedAt.toISOString(),
    unsubscribedAt: row.unsubscribedAt?.toISOString() ?? null,
  }
}

const SUBSCRIBER_SELECT = {
  id: true,
  email: true,
  status: true,
  source: true,
  subscribedAt: true,
  unsubscribedAt: true,
} as const

export async function listSubscribers(params: {
  page?: number
  pageSize?: number
  status?: string | null
  q?: string | null
}): Promise<
  ActionResult<{
    data: SubscriberRow[]
    pagination: unknown
    counts: { subscribed: number; unsubscribed: number }
  }>
> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.NEWSLETTER_READ)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const page = Math.max(1, params.page ?? 1)
    const size = Math.min(MAX_PAGE_SIZE, Math.max(1, params.pageSize ?? PAGE_SIZE))
    const wanted = params.status?.trim()
    const status: SubscriberStatus | null =
      wanted === "SUBSCRIBED" || wanted === "UNSUBSCRIBED" ? wanted : null
    const q = params.q?.trim()

    const where = {
      ...(status ? { status } : {}),
      ...(q ? { email: { contains: q, mode: "insensitive" as const } } : {}),
    }

    const [rows, total, subscribed, unsubscribed] = await Promise.all([
      db.subscriber.findMany({
        where,
        select: SUBSCRIBER_SELECT,
        orderBy: { subscribedAt: "desc" },
        skip: (page - 1) * size,
        take: size,
      }),
      db.subscriber.count({ where }),
      db.subscriber.count({ where: { status: "SUBSCRIBED" } }),
      db.subscriber.count({ where: { status: "UNSUBSCRIBED" } }),
    ])

    return ok({
      ...paginate(rows.map(serializeSubscriber), page, size, total),
      counts: { subscribed, unsubscribed },
    })
  })
}

/** For someone who asked by email or phone rather than through the link. */
export async function unsubscribeSubscriber(id: string): Promise<ActionResult<SubscriberRow>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.NEWSLETTER_SEND)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const before = await db.subscriber.findUnique({ where: { id }, select: { status: true } })
    if (!before) return fail("Subscriber not found.", undefined, 404)

    const row =
      before.status === "UNSUBSCRIBED"
        ? await db.subscriber.findUniqueOrThrow({ where: { id }, select: SUBSCRIBER_SELECT })
        : await db.subscriber.update({
            where: { id },
            data: { status: "UNSUBSCRIBED", unsubscribedAt: new Date() },
            select: SUBSCRIBER_SELECT,
          })

    await createAuditLog(session, {
      action: "newsletter:unsubscribe",
      module: "newsletter",
      entityId: id,
      ...(await getAuditMeta()),
    })
    return ok(serializeSubscriber(row))
  })
}

/** Erases the address and its delivery history, for someone who asks to be forgotten. */
export async function deleteSubscriber(id: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.NEWSLETTER_SEND)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const row = await db.subscriber.findUnique({ where: { id }, select: { email: true } })
    if (!row) return fail("Subscriber not found.", undefined, 404)
    await db.subscriber.delete({ where: { id } })

    await createAuditLog(session, {
      action: "newsletter:delete",
      module: "newsletter",
      entityId: id,
      // Masked: the point of deleting is that the address is gone.
      meta: { email: maskEmail(row.email) },
      ...(await getAuditMeta()),
    })
    return ok({ id })
  })
}

/** The history, and how many a new email would go to right now. */
export async function listCampaigns(): Promise<
  ActionResult<{ data: CampaignRow[]; subscribed: number }>
> {
  return runAction(async () => {
    await requirePermission(PERMISSIONS.NEWSLETTER_READ)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const [campaigns, subscribed] = await Promise.all([
      db.newsletterCampaign.findMany({ orderBy: { createdAt: "desc" }, take: HISTORY }),
      db.subscriber.count({ where: { status: "SUBSCRIBED" } }),
    ])
    const counts = await db.newsletterDelivery.groupBy({
      by: ["campaignId", "status"],
      where: { campaignId: { in: campaigns.map((c) => c.id) } },
      _count: { _all: true },
    })
    const tally = (id: string, status: "SENT" | "FAILED") =>
      counts.find((c) => c.campaignId === id && c.status === status)?._count._all ?? 0

    return ok({
      data: campaigns.map((c) => ({
        id: c.id,
        subject: c.subject,
        body: c.body,
        ctaLabel: c.ctaLabel,
        ctaUrl: c.ctaUrl,
        status: c.status,
        running: running.has(c.id),
        recipients: c.recipients,
        sent: tally(c.id, "SENT"),
        failed: tally(c.id, "FAILED"),
        note: c.note,
        sentByEmail: c.sentByEmail,
        createdAt: c.createdAt.toISOString(),
        finishedAt: c.finishedAt?.toISOString() ?? null,
      })),
      subscribed,
    })
  })
}

/**
 * Sends a campaign, or a test of it to the staff member sending.
 *
 * A test goes out now and says whether it arrived at the mail server. The
 * real thing is recorded, answered at once, and sent after the response - a
 * few hundred paced emails take minutes, which no request should wait on.
 */
export type SendResult =
  { test: true; to: string } | { test: false; id: string; recipients: number }

export async function sendCampaign(raw: unknown): Promise<ActionResult<SendResult>> {
  return runAction<SendResult>(async () => {
    const session = await requirePermission(PERMISSIONS.NEWSLETTER_SEND)
    const input = sendCampaignSchema.parse(raw)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)
    if (!isMailConfigured()) {
      return fail("Email is not set up on this server, so nothing can be sent.", undefined, 503)
    }

    const content = {
      subject: input.subject,
      body: input.body,
      ctaLabel: input.ctaLabel || null,
      ctaUrl: input.ctaUrl || null,
    }

    if (input.test) {
      const to = session.user.email
      if (!to) return fail("Your account has no email address to send a test to.")
      const mail = renderNewsletter({
        ...content,
        // A test has no subscriber behind it; this page says so.
        unsubscribeUrl: `${siteConfig.url}/unsubscribe?preview=1`,
      })
      const result = await sendMail({ to, ...mail, subject: `[Test] ${mail.subject}` })
      if (!result.ok) return fail(`The mail server refused it: ${result.error}`, undefined, 502)
      return ok({ test: true as const, to })
    }

    if (running.size > 0) {
      return fail(
        "Another email is still sending. Send this one when it has finished.",
        undefined,
        409,
      )
    }
    const recipients = await db.subscriber.count({ where: { status: "SUBSCRIBED" } })
    if (recipients === 0) {
      return fail("Nobody is subscribed yet, so there is no one to send it to.")
    }

    const campaign = await db.newsletterCampaign.create({
      data: {
        ...content,
        recipients,
        sentById: session.user.id,
        sentByEmail: session.user.email ?? null,
      },
      select: { id: true },
    })
    await createAuditLog(session, {
      action: "newsletter:send",
      module: "newsletter",
      entityId: campaign.id,
      meta: { subject: content.subject, recipients },
      ...(await getAuditMeta()),
    })

    // Marked before the response, so a second click cannot start a second one.
    running.add(campaign.id)
    later(() => runCampaign(campaign.id))
    return ok({ test: false as const, id: campaign.id, recipients })
  })
}

/** Carries on a campaign that paused at the daily limit or was cut off by a restart. */
export async function resumeCampaign(id: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.NEWSLETTER_SEND)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const campaign = await db.newsletterCampaign.findUnique({
      where: { id },
      select: { status: true },
    })
    if (!campaign) return fail("Campaign not found.", undefined, 404)
    if (running.has(id)) return ok({ id })
    if (campaign.status === "SENT")
      return fail("That email has already gone to everyone.", undefined, 409)
    if (running.size > 0) {
      return fail(
        "Another email is still sending. Resume this one when it has finished.",
        undefined,
        409,
      )
    }

    // A claim still PENDING was cut off between claiming and hearing back, so
    // it may or may not have gone. Not retried: one missed email beats one
    // person getting it twice.
    await db.newsletterDelivery.updateMany({
      where: { campaignId: id, status: "PENDING" },
      data: { status: "FAILED", error: "Interrupted while sending; it may have arrived." },
    })
    await db.newsletterCampaign.update({ where: { id }, data: { status: "SENDING", note: null } })
    await createAuditLog(session, {
      action: "newsletter:resume",
      module: "newsletter",
      entityId: id,
      ...(await getAuditMeta()),
    })

    running.add(id)
    later(() => runCampaign(id))
    return ok({ id })
  })
}

/**
 * The send loop. Exported for tests, which pass a gap of 0.
 *
 * Takes the campaign's subscribers in batches: still subscribed, signed up
 * before it was sent, and not yet claimed for it. Someone who unsubscribes
 * partway through drops out of the next batch.
 */
export async function runCampaign(id: string, gapMs = SEND_GAP_MS): Promise<void> {
  running.add(id)
  const pool = await openMailPool()
  try {
    const campaign = await db.newsletterCampaign.findUnique({
      where: { id },
      select: { subject: true, body: true, ctaLabel: true, ctaUrl: true, createdAt: true },
    })
    if (!campaign) return

    for (;;) {
      const batch = await db.subscriber.findMany({
        where: {
          status: "SUBSCRIBED",
          subscribedAt: { lte: campaign.createdAt },
          deliveries: { none: { campaignId: id } },
        },
        select: { id: true, email: true, token: true },
        orderBy: { subscribedAt: "asc" },
        take: BATCH,
      })
      if (batch.length === 0) break

      for (const subscriber of batch) {
        // Claimed before sending: the unique pair means nothing else can have
        // this one, and a restart cannot send it again.
        const claimed = await db.newsletterDelivery.createMany({
          data: [{ campaignId: id, subscriberId: subscriber.id }],
          skipDuplicates: true,
        })
        if (claimed.count === 0) continue

        const links = unsubscribeLinks(subscriber.token)
        const mail = renderNewsletter({ ...campaign, unsubscribeUrl: links.page })
        const result = await pool.send({
          to: subscriber.email,
          ...mail,
          headers: unsubscribeHeaders(links.oneClick),
        })
        const where = { campaignId_subscriberId: { campaignId: id, subscriberId: subscriber.id } }

        if (result.ok && result.delivered) {
          await db.newsletterDelivery.update({ where, data: { status: "SENT" } })
        } else if (!result.ok && COME_BACK_LATER.test(result.error)) {
          // The server will take no more for now. Hand this one back so Resume
          // tries it again, and stop where we are.
          await db.newsletterDelivery.delete({ where })
          await db.newsletterCampaign.update({
            where: { id },
            data: {
              status: "PAUSED",
              note: `The mail server asked us to stop for now (${result.error.slice(0, 160)}). Gmail allows about 500 emails a day; resume tomorrow to send the rest.`,
            },
          })
          return
        } else {
          await db.newsletterDelivery.update({
            where,
            data: {
              status: "FAILED",
              error: result.ok ? "Email is not set up on this server." : result.error.slice(0, 500),
            },
          })
        }
        if (gapMs > 0) await sleep(gapMs)
      }
    }

    await db.newsletterCampaign.update({
      where: { id },
      data: { status: "SENT", finishedAt: new Date(), note: null },
    })
  } catch (err) {
    console.error("[NEWSLETTER] campaign stopped:", err)
    await db.newsletterCampaign
      .update({
        where: { id },
        data: { status: "PAUSED", note: "Stopped by an error on our side. Resume it to carry on." },
      })
      .catch(() => {})
  } finally {
    pool.close()
    running.delete(id)
  }
}
