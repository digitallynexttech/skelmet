import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const env = vi.hoisted(() => ({ configured: true }))

vi.mock("@/features/blog/sanity/env", () => ({
  projectId: "abc123",
  dataset: "production",
  apiVersion: "2025-02-19",
  get sanityConfigured() {
    return env.configured
  },
}))

const { forgetKnownPosts, isUnknownPost } = await import("@/features/blog/server/known-posts")

const fetchMock = vi.fn()
/** Sanity's answer; a bare slug is dated long ago. */
const answer = (posts: unknown) => ({
  ok: true,
  json: async () => ({
    result: Array.isArray(posts)
      ? posts.map((p) =>
          typeof p === "string" ? { slug: p, publishedAt: "2026-09-01T00:00:00Z" } : p,
        )
      : posts,
  }),
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-09-30T06:00:00Z"))
  env.configured = true
  forgetKnownPosts()
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(answer(["visor-care", "garage-setup"]))
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  delete process.env.SANITY_API_TOKEN
})

describe("isUnknownPost", () => {
  it("lets a post through and refuses an address that is not one", async () => {
    expect(await isUnknownPost("/blog/visor-care")).toBe(false)
    expect(await isUnknownPost("/blog/made-up")).toBe(true)
  })

  it("only judges /blog/<slug>: the list and everything else are not its business", async () => {
    for (const path of ["/blog", "/blog/", "/blog/visor-care/extra", "/product/x", "/"]) {
      expect(await isUnknownPost(path), path).toBe(false)
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("refuses an address no slug could be, without asking Sanity", async () => {
    for (const path of ["/blog/Has-Capitals", "/blog/a.b", "/blog/%2e%2e", "/blog/a--b"]) {
      expect(await isUnknownPost(path), path).toBe(true)
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("asks the project's API CDN for published posts, once for many requests", async () => {
    await Promise.all([
      isUnknownPost("/blog/visor-care"),
      isUnknownPost("/blog/garage-setup"),
      isUnknownPost("/blog/visor-care"),
    ])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toMatch(
      /^https:\/\/abc123\.apicdn\.sanity\.io\/v2025-02-19\/data\/query\/production\?/,
    )
    expect((url as URL).searchParams.get("perspective")).toBe("published")
    expect(init.headers).toEqual({})
  })

  it("reads a private dataset from the API itself, with the token", async () => {
    process.env.SANITY_API_TOKEN = "sk-secret"
    await isUnknownPost("/blog/visor-care")
    const [url, init] = fetchMock.mock.calls[0]!
    expect((url as URL).host).toBe("abc123.api.sanity.io")
    expect(init.headers).toEqual({ Authorization: "Bearer sk-secret" })
  })

  it("keeps the list for a minute", async () => {
    await isUnknownPost("/blog/visor-care")
    vi.advanceTimersByTime(59_000)
    await isUnknownPost("/blog/visor-care")
    expect(fetchMock).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(2_000)
    await isUnknownPost("/blog/visor-care")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("looks again for a post it has not heard of, but not on every request", async () => {
    await isUnknownPost("/blog/visor-care")

    // Published a moment ago: not in the list, and the list is seconds old.
    vi.advanceTimersByTime(5_000)
    expect(await isUnknownPost("/blog/just-published")).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    fetchMock.mockResolvedValue(answer(["visor-care", "garage-setup", "just-published"]))
    vi.advanceTimersByTime(6_000)
    expect(await isUnknownPost("/blog/just-published")).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("refuses a scheduled post until its moment, and knows it from then on without asking again", async () => {
    // Now is 06:00 UTC; this one is dated 06:30.
    fetchMock.mockResolvedValue(
      answer(["visor-care", { slug: "coming-soon", publishedAt: "2026-09-30T06:30:00Z" }]),
    )
    expect(await isUnknownPost("/blog/coming-soon")).toBe(true)

    vi.advanceTimersByTime(29 * 60_000)
    expect(await isUnknownPost("/blog/coming-soon")).toBe(true)

    // 06:30:30. Sanity cannot be reached, and it does not need to be.
    fetchMock.mockRejectedValue(new Error("down"))
    vi.advanceTimersByTime(90_000)
    expect(await isUnknownPost("/blog/coming-soon")).toBe(false)
  })

  it("refuses a published post that has no date at all", async () => {
    fetchMock.mockResolvedValue(
      answer([{ slug: "no-date" }, { slug: "bad-date", publishedAt: "soon" }]),
    )
    expect(await isUnknownPost("/blog/no-date")).toBe(true)
    expect(await isUnknownPost("/blog/bad-date")).toBe(true)
  })

  it("keeps the posts it knew when Sanity stops answering", async () => {
    await isUnknownPost("/blog/visor-care")
    vi.advanceTimersByTime(120_000)

    for (const broken of [
      () => fetchMock.mockRejectedValue(new Error("timeout")),
      () => fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) }),
      () => fetchMock.mockResolvedValue(answer("not a list")),
    ]) {
      broken()
      expect(await isUnknownPost("/blog/visor-care")).toBe(false)
      expect(await isUnknownPost("/blog/made-up")).toBe(true)
    }
  })

  it("leaves it to the page when Sanity has never answered", async () => {
    fetchMock.mockRejectedValue(new Error("down"))
    expect(await isUnknownPost("/blog/visor-care")).toBe(false)
  })

  it("has no posts at all without a Sanity project, and asks nobody", async () => {
    env.configured = false
    expect(await isUnknownPost("/blog/visor-care")).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
