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
  docFromText,
  docToText,
  newsletterImageUrl,
  type NewsletterDoc,
} from "@/features/newsletter/newsletter-content"
import {
  NEWSLETTER_IMAGE_MAX_BYTES,
  NEWSLETTER_IMAGE_TYPES,
  sendCampaignSchema,
  subscribeSchema,
  unsubscribeSchema,
} from "@/features/newsletter/schemas/newsletter.schema"

/**
 * The drop list and the emails staff send it. One paced message per person (own unsubscribe
 * link). When every mail route says the day's allowance is spent the campaign pauses and Resume
 * sends the rest. Each delivery is claimed before sending, so nobody is emailed twice.
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
const BATCH = 25
const HISTORY = 30

// "Take no more for now": Gmail's daily limit (5.4.5) and throttles (4.7.x), Brevo's 429 and
// spent credits. Pause on these rather than failing everyone left.
const COME_BACK_LATER =
  /5\.4\.5|4\.7\.\d|sending limit|quota|try again later|too.many|not.enough.credits|daily limit|API 429/i

// Only when every route says so; otherwise the trouble is this address, not the allowance.
function everyRouteSaysLater(result: { error: string; refusals?: { error: string }[] }) {
  const refusals = result.refusals?.length ? result.refusals : [result]
  return refusals.every((r) => COME_BACK_LATER.test(r.error))
}

// Campaigns sending in this process (single process, pm2 fork mode). A SENDING row missing from
// here was cut off by a restart and waits for Resume.
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
 * Public "Notify me". Answers the same for a new, existing or returning address, so the form
 * cannot reveal who has signed up.
 */
export async function subscribe(raw: unknown): Promise<ActionResult<{ subscribed: true }>> {
  return runAction(async () => {
    // Before parsing, so a validation error does not tell the bot which check it tripped.
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

/** Public: the email link and the mail client's one-click. The token is the whole credential. */
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

export type SendResult =
  { test: true; to: string } | { test: false; id: string; recipients: number }

/** Sends a test to the sender now, or records the campaign and sends it after the response. */
export async function sendCampaign(raw: unknown): Promise<ActionResult<SendResult>> {
  return runAction<SendResult>(async () => {
    const session = await requirePermission(PERMISSIONS.NEWSLETTER_SEND)
    const input = sendCampaignSchema.parse(raw)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)
    if (!isMailConfigured()) {
      return fail("Email is not set up on this server, so nothing can be sent.", undefined, 503)
    }

    const email = {
      subject: input.subject,
      content: input.content,
      ctaLabel: input.ctaLabel || null,
      ctaUrl: input.ctaUrl || null,
    }

    if (input.test) {
      const to = session.user.email
      if (!to) return fail("Your account has no email address to send a test to.")
      const mail = renderNewsletter({
        ...email,
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
        subject: email.subject,
        body: docToText(email.content),
        content: email.content,
        ctaLabel: email.ctaLabel,
        ctaUrl: email.ctaUrl,
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
      meta: { subject: email.subject, recipients },
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

    // A PENDING claim may or may not have gone. Not retried: a missed email beats a double one.
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
 * The send loop; exported for tests. Batches subscribers still subscribed, signed up before the
 * campaign and not yet claimed, so an unsubscribe partway through drops out.
 */
export async function runCampaign(id: string, gapMs = SEND_GAP_MS): Promise<void> {
  running.add(id)
  const pool = await openMailPool()
  try {
    const campaign = await db.newsletterCampaign.findUnique({
      where: { id },
      select: {
        subject: true,
        body: true,
        content: true,
        ctaLabel: true,
        ctaUrl: true,
        createdAt: true,
      },
    })
    if (!campaign) return
    // Older campaigns have only plain text.
    const email = {
      subject: campaign.subject,
      content: campaign.content ? (campaign.content as NewsletterDoc) : docFromText(campaign.body),
      ctaLabel: campaign.ctaLabel,
      ctaUrl: campaign.ctaUrl,
    }

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
        // Claimed before sending (unique pair), so a restart cannot send it again.
        const claimed = await db.newsletterDelivery.createMany({
          data: [{ campaignId: id, subscriberId: subscriber.id }],
          skipDuplicates: true,
        })
        if (claimed.count === 0) continue

        const links = unsubscribeLinks(subscriber.token)
        const mail = renderNewsletter({ ...email, unsubscribeUrl: links.page })
        const result = await pool.send({
          to: subscriber.email,
          ...mail,
          headers: unsubscribeHeaders(links.oneClick),
        })
        const where = { campaignId_subscriberId: { campaignId: id, subscriberId: subscriber.id } }

        if (result.ok && result.delivered) {
          await db.newsletterDelivery.update({ where, data: { status: "SENT" } })
        } else if (!result.ok && everyRouteSaysLater(result)) {
          // Release the claim so Resume tries this one again, and pause.
          await db.newsletterDelivery.delete({ where })
          await db.newsletterCampaign.update({
            where: { id },
            data: {
              status: "PAUSED",
              note: `The mail servers asked us to stop for now (${result.error.slice(0, 160)}). Each allows so many emails a day; resume tomorrow to send the rest.`,
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

// About twice EMAIL_IMAGE_WIDTH (544px), sharp on a phone.
const IMAGE_MAX_WIDTH = 1200

export type UploadedImage = { id: string; url: string; width: number; height: number }

/**
 * Re-encodes an editor picture (JPEG, or PNG if it has alpha), which also strips camera metadata
 * such as location before it goes to every inbox. A GIF keeps only its first frame.
 */
export async function uploadNewsletterImage(form: FormData): Promise<ActionResult<UploadedImage>> {
  return runAction(async () => {
    const session = await requirePermission(PERMISSIONS.NEWSLETTER_SEND)
    if (!hasDatabase()) return fail("Database not configured.", undefined, 503)

    const file = form.get("file")
    if (!(file instanceof File) || file.size === 0) return fail("Choose a picture to upload.")
    if (!NEWSLETTER_IMAGE_TYPES.includes(file.type)) {
      return fail("Use a JPG, PNG, WebP or GIF picture.", undefined, 415)
    }
    if (file.size > NEWSLETTER_IMAGE_MAX_BYTES) {
      return fail("That picture is over 8 MB. Use a smaller one.", undefined, 413)
    }

    let image: Awaited<ReturnType<typeof prepareImage>>
    try {
      image = await prepareImage(Buffer.from(await file.arrayBuffer()))
    } catch {
      return fail("That file could not be read as a picture.", undefined, 422)
    }

    const row = await db.newsletterImage.create({
      data: { ...image, createdById: session.user.id },
      select: { id: true },
    })
    return ok({
      id: row.id,
      url: newsletterImageUrl(row.id),
      width: image.width,
      height: image.height,
    })
  })
}

async function prepareImage(input: Buffer) {
  const sharp = (await import("sharp")).default
  const source = sharp(input, { failOn: "error" })
  const { hasAlpha } = await source.metadata()
  const resized = source.rotate().resize({ width: IMAGE_MAX_WIDTH, withoutEnlargement: true })
  const { data, info } = hasAlpha
    ? await resized.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true })
    : await resized.jpeg({ quality: 82, mozjpeg: true }).toBuffer({ resolveWithObject: true })
  return {
    data,
    contentType: hasAlpha ? "image/png" : "image/jpeg",
    width: info.width,
    height: info.height,
    bytes: data.length,
  }
}

/** Public: a newsletter picture, for the inboxes that open the email. */
export async function getNewsletterImage(
  id: string,
): Promise<ActionResult<{ data: Uint8Array; contentType: string }>> {
  return runAction(async () => {
    if (!hasDatabase()) return fail("Not available right now.", undefined, 503)
    const row = await db.newsletterImage.findUnique({
      where: { id },
      select: { data: true, contentType: true },
    })
    if (!row) return fail("Not found.", undefined, 404)
    return ok({ data: row.data, contentType: row.contentType })
  })
}
