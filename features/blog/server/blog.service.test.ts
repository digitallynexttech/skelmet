import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Releasing posts from the console. What is pinned down here is what reaches
 * Sanity and when: a post that is not ready never does, a scheduled post goes
 * out dated in the future, and the site's cache is only cleared by a change
 * that happened.
 */

const mocks = vi.hoisted(() => {
  const commit = vi.fn()
  const set = vi.fn(() => ({ commit }))
  return {
    env: { configured: true },
    client: {
      fetch: vi.fn(),
      action: vi.fn(),
      patch: vi.fn(() => ({ set })),
    },
    set,
    commit,
    createClient: vi.fn(),
    requirePermission: vi.fn(),
    createAuditLog: vi.fn(),
    revalidateTag: vi.fn(),
  }
})

vi.mock("next-sanity", () => ({ createClient: mocks.createClient }))
vi.mock("next/cache", () => ({ revalidateTag: mocks.revalidateTag }))
vi.mock("@/features/blog/sanity/env", () => ({
  projectId: "abc123",
  dataset: "production",
  apiVersion: "2025-02-19",
  get sanityConfigured() {
    return mocks.env.configured
  },
}))
vi.mock("@/server/action-guard", () => ({
  requirePermission: mocks.requirePermission,
  can: (session: { user: { permissions: string[] } }, scope: string) =>
    session.user.permissions.includes(scope),
}))
vi.mock("@/server/audit", () => ({
  createAuditLog: mocks.createAuditLog,
  getAuditMeta: async () => ({}),
}))

const service = await import("@/features/blog/server/blog.service")
const { ForbiddenError } = await import("@/lib/errors")

const NOW = new Date("2026-09-30T06:00:00.000Z")
const ID = "0a1b2c3d-post"
const DRAFT_ID = `drafts.${ID}`

const doc = (over: object = {}) => ({
  _id: ID,
  _updatedAt: "2026-09-29T10:00:00Z",
  title: "Cleaning a visor",
  slug: "cleaning-a-visor",
  excerpt: "Warm water and a soft cloth.",
  category: "helmet-care",
  publishedAt: "2026-09-20T06:00:00Z",
  author: null,
  hasCover: true,
  hasBody: true,
  ...over,
})
const draft = (over: object = {}) => doc({ _id: DRAFT_ID, ...over })

/** What Sanity holds for the post, and how many other posts share its slug. */
function sanityHas(docs: object[], slugTaken = 0) {
  mocks.client.fetch.mockImplementation(async (query: string) =>
    query.startsWith("count(") ? slugTaken : docs,
  )
}

const edit = (at: string) => ({
  actionType: "sanity.action.document.edit",
  draftId: DRAFT_ID,
  publishedId: ID,
  patch: { set: { publishedAt: at } },
})
const publish = { actionType: "sanity.action.document.publish", draftId: DRAFT_ID, publishedId: ID }

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  mocks.env.configured = true
  process.env.SANITY_API_TOKEN = "sk-editor"
  mocks.createClient.mockReturnValue(mocks.client)
  mocks.requirePermission.mockResolvedValue({
    user: { id: "staff-1", permissions: ["post:read", "post:publish"] },
  })
  mocks.client.action.mockResolvedValue({ transactionId: "t1" })
  mocks.commit.mockResolvedValue({})
  sanityHas([draft()])
})

afterEach(() => {
  vi.useRealTimers()
  delete process.env.SANITY_API_TOKEN
})

describe("listManagedPosts", () => {
  it("lists every post with where it stands, drafts included", async () => {
    sanityHas([
      doc({ _id: "live-1" }),
      doc({ _id: "drafts.draft-1" }),
      doc({ _id: "sched-1", publishedAt: "2026-10-05T04:30:00Z" }),
    ])
    const result = await service.listManagedPosts()
    expect(result).toMatchObject({
      ok: true,
      data: { counts: { DRAFT: 1, SCHEDULED: 1, LIVE: 1 }, canPublish: true },
    })
    // Drafts are only readable raw, with the token, and never from a cache.
    expect(mocks.client.fetch).toHaveBeenCalledWith(
      expect.stringContaining('_type == "post"'),
      {},
      { perspective: "raw", cache: "no-store" },
    )
    expect(mocks.createClient).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "abc123", token: "sk-editor", useCdn: false }),
    )
  })

  it("tells someone who may only look that they may not publish", async () => {
    mocks.requirePermission.mockResolvedValue({ user: { id: "s", permissions: ["post:read"] } })
    const result = await service.listManagedPosts()
    expect(result.ok && result.data.canPublish).toBe(false)
  })

  it("says what is missing instead of failing, with no project or no token", async () => {
    mocks.env.configured = false
    expect(await service.listManagedPosts()).toMatchObject({ ok: false, status: 503 })

    mocks.env.configured = true
    delete process.env.SANITY_API_TOKEN
    const result = await service.listManagedPosts()
    expect(result).toMatchObject({ ok: false, status: 503 })
    expect(result.ok === false && result.error).toMatch(/SANITY_API_TOKEN/)
    expect(mocks.client.fetch).not.toHaveBeenCalled()
  })

  it("is for staff who may see posts", async () => {
    mocks.requirePermission.mockRejectedValue(new ForbiddenError("You do not have access to that."))
    expect(await service.listManagedPosts()).toMatchObject({ ok: false, status: 403 })
    expect(mocks.requirePermission).toHaveBeenCalledWith("post:read")
  })
})

describe("publishPost", () => {
  it("dates a draft now and publishes it, in one transaction", async () => {
    const result = await service.publishPost(ID)
    expect(result).toEqual({ ok: true, data: { id: ID, status: "LIVE" } })
    expect(mocks.client.action).toHaveBeenCalledTimes(1)
    expect(mocks.client.action).toHaveBeenCalledWith([edit(NOW.toISOString()), publish])
    expect(mocks.requirePermission).toHaveBeenCalledWith("post:publish")
  })

  it("clears what the site has cached, and writes it in the audit log", async () => {
    await service.publishPost(ID)
    expect(mocks.revalidateTag).toHaveBeenCalledWith("blog", { expire: 0 })
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "post:publish", module: "post", entityId: ID }),
    )
  })

  it("never publishes a draft that is not finished", async () => {
    sanityHas([draft({ hasCover: false, hasBody: false })])
    const result = await service.publishPost(ID)
    expect(result).toMatchObject({ ok: false, status: 422 })
    expect(result.ok === false && result.error).toMatch(/needs a cover image and a body/)
    expect(mocks.client.action).not.toHaveBeenCalled()
    expect(mocks.revalidateTag).not.toHaveBeenCalled()
  })

  it("refuses an address another published post already has", async () => {
    sanityHas([draft()], 1)
    const result = await service.publishPost(ID)
    expect(result).toMatchObject({ ok: false, status: 409 })
    expect(mocks.client.action).not.toHaveBeenCalled()
  })

  it("publishes edits to a live post without moving its date", async () => {
    sanityHas([doc(), draft({ title: "Cleaning a visor, properly" })])
    expect(await service.publishPost(ID)).toMatchObject({ ok: true, data: { status: "LIVE" } })
    expect(mocks.client.action).toHaveBeenCalledWith([publish])
  })

  it("brings a scheduled post forward by moving its date to now", async () => {
    sanityHas([doc({ publishedAt: "2026-10-05T04:30:00Z" })])
    expect(await service.publishPost(ID)).toMatchObject({ ok: true, data: { status: "LIVE" } })
    expect(mocks.client.patch).toHaveBeenCalledWith(ID)
    expect(mocks.set).toHaveBeenCalledWith({ publishedAt: NOW.toISOString() })
    expect(mocks.client.action).not.toHaveBeenCalled()
  })

  it("has nothing to do for a post that is already live and unedited", async () => {
    sanityHas([doc()])
    expect(await service.publishPost(ID)).toMatchObject({ ok: false, status: 409 })
    expect(mocks.client.patch).not.toHaveBeenCalled()
  })

  it("answers 404 for a post Sanity does not have", async () => {
    sanityHas([])
    expect(await service.publishPost(ID)).toMatchObject({ ok: false, status: 404 })
  })

  it("will not be pointed at a draft, a version or anything that is not a post id", async () => {
    for (const id of [DRAFT_ID, "versions.r1.abc", "a b", "", "../x"]) {
      expect(await service.publishPost(id), id).toMatchObject({ ok: false, status: 422 })
    }
    expect(mocks.client.fetch).not.toHaveBeenCalled()
  })

  it("reports a token that may only read, and changes nothing here", async () => {
    mocks.client.action.mockRejectedValue(
      Object.assign(new Error("Forbidden"), { statusCode: 403 }),
    )
    const result = await service.publishPost(ID)
    expect(result).toMatchObject({ ok: false, status: 502 })
    expect(result.ok === false && result.error).toMatch(/Editor role/)
    expect(mocks.revalidateTag).not.toHaveBeenCalled()
    expect(mocks.createAuditLog).not.toHaveBeenCalled()
  })
})

describe("schedulePost", () => {
  const AT = "2026-10-05T04:30:00.000Z"

  it("publishes a draft dated at the chosen time, which keeps it off the site until then", async () => {
    const result = await service.schedulePost(ID, { at: AT })
    expect(result).toEqual({ ok: true, data: { id: ID, status: "SCHEDULED" } })
    expect(mocks.client.action).toHaveBeenCalledWith([edit(AT), publish])
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "post:schedule", meta: { at: AT, status: "SCHEDULED" } }),
    )
  })

  it("takes a time written with an offset, and stores it as the same moment", async () => {
    await service.schedulePost(ID, { at: "2026-10-05T10:00:00+05:30" })
    expect(mocks.client.action).toHaveBeenCalledWith([edit(AT), publish])
  })

  it("moves the date of a post that is already scheduled", async () => {
    sanityHas([doc({ publishedAt: "2026-10-01T04:30:00Z" })])
    expect(await service.schedulePost(ID, { at: AT })).toMatchObject({
      ok: true,
      data: { status: "SCHEDULED" },
    })
    expect(mocks.set).toHaveBeenCalledWith({ publishedAt: AT })
  })

  it("refuses a time that has passed, is too far off, or is not a time", async () => {
    for (const at of ["2026-09-30T05:59:00.000Z", "2028-01-01T00:00:00.000Z", "tomorrow", ""]) {
      expect(await service.schedulePost(ID, { at }), at).toMatchObject({ ok: false, status: 422 })
    }
    expect(await service.schedulePost(ID, {})).toMatchObject({ ok: false, status: 422 })
    expect(mocks.client.fetch).not.toHaveBeenCalled()
  })

  it("holds a scheduled draft to the same checks as one published now", async () => {
    sanityHas([draft({ excerpt: "" })])
    expect(await service.schedulePost(ID, { at: AT })).toMatchObject({ ok: false, status: 422 })
    expect(mocks.client.action).not.toHaveBeenCalled()
  })
})

describe("unpublishPost", () => {
  it("takes a published post back to a draft", async () => {
    sanityHas([doc()])
    expect(await service.unpublishPost(ID)).toEqual({ ok: true, data: { id: ID, status: "DRAFT" } })
    expect(mocks.client.action).toHaveBeenCalledWith({
      actionType: "sanity.action.document.unpublish",
      draftId: DRAFT_ID,
      publishedId: ID,
    })
    expect(mocks.revalidateTag).toHaveBeenCalledWith("blog", { expire: 0 })
  })

  it("has nothing to take down when the post was never published", async () => {
    sanityHas([draft()])
    expect(await service.unpublishPost(ID)).toMatchObject({ ok: false, status: 409 })
    expect(mocks.client.action).not.toHaveBeenCalled()
  })

  it("needs the permission to publish", async () => {
    mocks.requirePermission.mockRejectedValue(new ForbiddenError("You do not have access to that."))
    expect(await service.unpublishPost(ID)).toMatchObject({ ok: false, status: 403 })
    expect(mocks.client.action).not.toHaveBeenCalled()
  })
})
