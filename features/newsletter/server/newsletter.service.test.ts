import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  db: {
    subscriber: {
      upsert: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    newsletterCampaign: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    newsletterDelivery: { createMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
    newsletterImage: { create: vi.fn() },
  },
  send: vi.fn(),
  sendMail: vi.fn(),
  later: vi.fn(),
  configured: true,
}))

vi.mock("@/server/db", () => ({ db: mocks.db }))
vi.mock("@/lib/env", () => ({ hasDatabase: () => true }))
vi.mock("@/server/action-guard", () => ({
  requirePermission: async () => ({ user: { id: "staff-1", email: "owner@skelmet.in" } }),
}))
vi.mock("@/server/audit", () => ({ createAuditLog: vi.fn(), getAuditMeta: async () => ({}) }))
vi.mock("@/server/later", () => ({ later: mocks.later }))
vi.mock("@/lib/mailer", () => ({
  isMailConfigured: () => mocks.configured,
  maskEmail: (a: string) => `${a[0]}***${a.slice(a.lastIndexOf("@"))}`,
  openMailPool: async () => ({ send: mocks.send, close: vi.fn() }),
  sendMail: mocks.sendMail,
}))

const { runCampaign, sendCampaign, subscribe, unsubscribe, uploadNewsletterImage } =
  await import("@/features/newsletter/server/newsletter.service")

const { docFromText } = await import("@/features/newsletter/newsletter-content")
const sharp = (await import("sharp")).default

const TOKEN = "a".repeat(64)

beforeEach(() => {
  // Reset, not clear: a test that stops early leaves queued once-values behind.
  vi.resetAllMocks()
  mocks.configured = true
})

describe("subscribe", () => {
  it("stores the address lowercased, with a token of its own", async () => {
    mocks.db.subscriber.upsert.mockResolvedValue({ status: "SUBSCRIBED" })
    expect(await subscribe({ email: "Rider@Example.IN " })).toEqual({
      ok: true,
      data: { subscribed: true },
    })
    const call = mocks.db.subscriber.upsert.mock.calls[0]![0]
    expect(call.where).toEqual({ email: "rider@example.in" })
    expect(call.create.token).toMatch(/^[0-9a-f]{64}$/)
    expect(mocks.db.subscriber.update).not.toHaveBeenCalled()
  })

  it("answers the same for an address already on the list", async () => {
    mocks.db.subscriber.upsert.mockResolvedValue({ status: "SUBSCRIBED" })
    expect(await subscribe({ email: "rider@example.in" })).toEqual({
      ok: true,
      data: { subscribed: true },
    })
  })

  it("takes someone back who left, dated now", async () => {
    mocks.db.subscriber.upsert.mockResolvedValue({ status: "UNSUBSCRIBED" })
    await subscribe({ email: "rider@example.in" })
    expect(mocks.db.subscriber.update).toHaveBeenCalledWith({
      where: { email: "rider@example.in" },
      data: expect.objectContaining({ status: "SUBSCRIBED", unsubscribedAt: null }),
    })
  })

  it("writes nothing for a bot that filled the honeypot, and says it worked", async () => {
    expect(await subscribe({ email: "bot@spam.io", website: "http://x" })).toMatchObject({
      ok: true,
    })
    expect(mocks.db.subscriber.upsert).not.toHaveBeenCalled()
  })

  it("rejects something that is not an email", async () => {
    expect(await subscribe({ email: "not-an-email" })).toMatchObject({ ok: false, status: 422 })
  })
})

describe("unsubscribe", () => {
  it("takes the address off the list and names it masked", async () => {
    mocks.db.subscriber.findUnique.mockResolvedValue({
      id: "s1",
      email: "rider@example.in",
      status: "SUBSCRIBED",
    })
    expect(await unsubscribe({ token: TOKEN })).toEqual({
      ok: true,
      data: { email: "r***@example.in" },
    })
    expect(mocks.db.subscriber.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: expect.objectContaining({ status: "UNSUBSCRIBED" }),
    })
  })

  it("is harmless the second time", async () => {
    mocks.db.subscriber.findUnique.mockResolvedValue({
      id: "s1",
      email: "rider@example.in",
      status: "UNSUBSCRIBED",
    })
    expect(await unsubscribe({ token: TOKEN })).toMatchObject({ ok: true })
    expect(mocks.db.subscriber.update).not.toHaveBeenCalled()
  })

  it("does not know a made-up token", async () => {
    mocks.db.subscriber.findUnique.mockResolvedValue(null)
    expect(await unsubscribe({ token: TOKEN })).toMatchObject({ ok: false, status: 404 })
  })
})

describe("sendCampaign", () => {
  const draft = { subject: "The Ghost Grey drop", content: docFromText("It's here. Have a look.") }

  it("sends a test only to the person sending it", async () => {
    mocks.sendMail.mockResolvedValue({ ok: true, delivered: true, messageId: "m" })
    expect(await sendCampaign({ ...draft, test: true })).toEqual({
      ok: true,
      data: { test: true, to: "owner@skelmet.in" },
    })
    expect(mocks.sendMail).toHaveBeenCalledTimes(1)
    expect(mocks.sendMail.mock.calls[0]![0]).toMatchObject({
      to: "owner@skelmet.in",
      subject: "[Test] The Ghost Grey drop",
    })
    expect(mocks.db.newsletterCampaign.create).not.toHaveBeenCalled()
  })

  it("will not start with nobody subscribed", async () => {
    mocks.db.subscriber.count.mockResolvedValue(0)
    expect(await sendCampaign(draft)).toMatchObject({ ok: false, status: 400 })
    expect(mocks.later).not.toHaveBeenCalled()
  })

  it("will not pretend to send with no mail server", async () => {
    mocks.configured = false
    expect(await sendCampaign(draft)).toMatchObject({ ok: false, status: 503 })
  })
})

describe("runCampaign", () => {
  const campaign = {
    subject: "The Ghost Grey drop",
    body: "It's here.",
    content: null,
    ctaLabel: null,
    ctaUrl: null,
    createdAt: new Date(),
  }
  const people = [
    { id: "s1", email: "one@example.in", token: "t1".padEnd(64, "0") },
    { id: "s2", email: "two@example.in", token: "t2".padEnd(64, "0") },
  ]

  beforeEach(() => {
    mocks.db.newsletterCampaign.findUnique.mockResolvedValue(campaign)
    mocks.db.subscriber.findMany.mockResolvedValueOnce(people).mockResolvedValueOnce([])
    mocks.db.newsletterDelivery.createMany.mockResolvedValue({ count: 1 })
  })

  it("sends each person their own unsubscribe link, then marks it sent", async () => {
    mocks.send.mockResolvedValue({ ok: true, delivered: true, messageId: "m" })
    await runCampaign("c1", 0)

    expect(mocks.send).toHaveBeenCalledTimes(2)
    const first = mocks.send.mock.calls[0]![0]
    expect(first.to).toBe("one@example.in")
    expect(first.text).toContain(`token=${people[0]!.token}`)
    expect(first.headers["List-Unsubscribe"]).toContain(
      `/api/public/newsletter/unsubscribe?token=${people[0]!.token}`,
    )
    expect(first.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click")

    expect(mocks.db.newsletterDelivery.update).toHaveBeenCalledTimes(2)
    expect(mocks.db.newsletterCampaign.update).toHaveBeenLastCalledWith({
      where: { id: "c1" },
      data: expect.objectContaining({ status: "SENT" }),
    })
  })

  it("skips anyone another run has already claimed", async () => {
    mocks.db.newsletterDelivery.createMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
    mocks.send.mockResolvedValue({ ok: true, delivered: true, messageId: "m" })
    await runCampaign("c1", 0)
    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(mocks.send.mock.calls[0]![0].to).toBe("two@example.in")
  })

  it("pauses at the daily limit and hands the claim back for Resume", async () => {
    mocks.send.mockResolvedValue({
      ok: false,
      delivered: false,
      error: "550-5.4.5 Daily user sending limit exceeded.",
    })
    await runCampaign("c1", 0)

    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(mocks.db.newsletterDelivery.delete).toHaveBeenCalledTimes(1)
    expect(mocks.db.newsletterCampaign.update).toHaveBeenLastCalledWith({
      where: { id: "c1" },
      data: expect.objectContaining({ status: "PAUSED" }),
    })
  })

  it("records one bad address as failed and carries on", async () => {
    mocks.send
      .mockResolvedValueOnce({ ok: false, delivered: false, error: "550 5.1.1 No such user" })
      .mockResolvedValueOnce({ ok: true, delivered: true, messageId: "m" })
    await runCampaign("c1", 0)

    expect(mocks.send).toHaveBeenCalledTimes(2)
    expect(mocks.db.newsletterDelivery.update.mock.calls[0]![0].data).toMatchObject({
      status: "FAILED",
    })
    expect(mocks.db.newsletterCampaign.update).toHaveBeenLastCalledWith({
      where: { id: "c1" },
      data: expect.objectContaining({ status: "SENT" }),
    })
  })

  it("pauses only when every route says later, not when one still takes mail", async () => {
    // Brevo is spent but Gmail refuses only this address: it fails and the list goes on.
    mocks.send
      .mockResolvedValueOnce({
        ok: false,
        delivered: false,
        error: "brevo-api: Brevo API 429: too_many_requests; smtp: 550 5.1.1 No such user",
        refusals: [
          { via: "brevo-api", error: "Brevo API 429: too_many_requests" },
          { via: "smtp", error: "550 5.1.1 No such user" },
        ],
      })
      .mockResolvedValueOnce({
        ok: false,
        delivered: false,
        error:
          "brevo-api: Brevo API 429: too_many_requests; smtp: 550-5.4.5 Daily user sending limit exceeded.",
        refusals: [
          { via: "brevo-api", error: "Brevo API 429: too_many_requests" },
          { via: "smtp", error: "550-5.4.5 Daily user sending limit exceeded." },
        ],
      })
    await runCampaign("c1", 0)

    expect(mocks.send).toHaveBeenCalledTimes(2)
    expect(mocks.db.newsletterDelivery.update.mock.calls[0]![0].data).toMatchObject({
      status: "FAILED",
    })
    expect(mocks.db.newsletterDelivery.delete).toHaveBeenCalledTimes(1)
    expect(mocks.db.newsletterCampaign.update).toHaveBeenLastCalledWith({
      where: { id: "c1" },
      data: expect.objectContaining({ status: "PAUSED" }),
    })
  })
})

describe("uploadNewsletterImage", () => {
  const form = (file: File) => {
    const f = new FormData()
    f.append("file", file)
    return f
  }
  const picture = async (width: number, height: number, alpha: boolean) =>
    sharp({
      create: {
        width,
        height,
        channels: alpha ? 4 : 3,
        background: alpha ? { r: 255, g: 90, b: 31, alpha: 0.5 } : { r: 255, g: 90, b: 31 },
      },
    })
      [alpha ? "png" : "jpeg"]()
      .toBuffer()

  beforeEach(() => {
    mocks.db.newsletterImage.create.mockResolvedValue({
      id: "0b6f7f3e-4c1a-4d8e-9a55-1f2e3d4c5b6a",
    })
  })

  it("shrinks a big photo to 1200 wide, as a JPEG, and hands back its public address", async () => {
    const buf = await picture(3000, 2000, false)
    const result = await uploadNewsletterImage(
      form(new File([new Uint8Array(buf)], "ride.jpg", { type: "image/jpeg" })),
    )
    expect(result).toMatchObject({
      ok: true,
      data: {
        width: 1200,
        height: 800,
        url: expect.stringContaining(
          "/api/public/newsletter/images/0b6f7f3e-4c1a-4d8e-9a55-1f2e3d4c5b6a",
        ),
      },
    })
    expect(mocks.db.newsletterImage.create.mock.calls[0]![0].data).toMatchObject({
      contentType: "image/jpeg",
      width: 1200,
      height: 800,
    })
  })

  it("keeps transparency as a PNG, and never enlarges a small one", async () => {
    const buf = await picture(300, 200, true)
    await uploadNewsletterImage(
      form(new File([new Uint8Array(buf)], "logo.png", { type: "image/png" })),
    )
    expect(mocks.db.newsletterImage.create.mock.calls[0]![0].data).toMatchObject({
      contentType: "image/png",
      width: 300,
      height: 200,
    })
  })

  it("turns away what is not a picture, or too big to be one we want", async () => {
    const pdf = new File([new Uint8Array([37, 80, 68, 70])], "menu.pdf", {
      type: "application/pdf",
    })
    expect(await uploadNewsletterImage(form(pdf))).toMatchObject({ ok: false, status: 415 })

    const huge = new File([new Uint8Array(8 * 1024 * 1024 + 1)], "huge.jpg", { type: "image/jpeg" })
    expect(await uploadNewsletterImage(form(huge))).toMatchObject({ ok: false, status: 413 })

    const fake = new File([new Uint8Array([1, 2, 3, 4])], "fake.jpg", { type: "image/jpeg" })
    expect(await uploadNewsletterImage(form(fake))).toMatchObject({ ok: false, status: 422 })

    expect(await uploadNewsletterImage(new FormData())).toMatchObject({ ok: false, status: 400 })
    expect(mocks.db.newsletterImage.create).not.toHaveBeenCalled()
  })
})
