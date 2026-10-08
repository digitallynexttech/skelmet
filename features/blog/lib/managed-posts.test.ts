import { describe, expect, it } from "vitest"

import {
  listOf,
  managedPost,
  managedPosts,
  missingFor,
  type RawPost,
} from "@/features/blog/lib/managed-posts"

const NOW = Date.parse("2026-09-30T06:00:00Z")

const doc = (over: Partial<RawPost> = {}): RawPost => ({
  _id: "abc",
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
const draft = (over: Partial<RawPost> = {}) => doc({ _id: "drafts.abc", ...over })

describe("managedPost", () => {
  it("is a draft until it has been published", () => {
    const post = managedPost("abc", draft(), null, NOW)
    expect(post).toMatchObject({ id: "abc", status: "DRAFT", hasChanges: false, missing: [] })
  })

  it("is live once published with a date that has passed", () => {
    expect(managedPost("abc", null, doc(), NOW)).toMatchObject({
      status: "LIVE",
      hasChanges: false,
      publishedAt: "2026-09-20T06:00:00Z",
    })
  })

  it("is scheduled while its date is still to come", () => {
    const post = managedPost("abc", null, doc({ publishedAt: "2026-10-05T04:30:00Z" }), NOW)
    expect(post).toMatchObject({ status: "SCHEDULED", publishedAt: "2026-10-05T04:30:00Z" })
    // Live once it passes, with no change in Sanity.
    expect(
      managedPost("abc", null, doc({ publishedAt: "2026-10-05T04:30:00Z" }), NOW + 6 * 86_400_000)
        .status,
    ).toBe("LIVE")
  })

  it("is not live when published without a date the site can read", () => {
    expect(managedPost("abc", null, doc({ publishedAt: null }), NOW).status).toBe("SCHEDULED")
  })

  it("shows the editor's latest words, and says a live post has edits waiting", () => {
    const post = managedPost(
      "abc",
      draft({ title: "Cleaning a visor, properly", _updatedAt: "2026-09-30T05:00:00Z" }),
      doc(),
      NOW,
    )
    expect(post).toMatchObject({
      status: "LIVE",
      hasChanges: true,
      title: "Cleaning a visor, properly",
      updatedAt: "2026-09-30T05:00:00Z",
      // The date in force is the published one.
      publishedAt: "2026-09-20T06:00:00Z",
    })
  })

  it("names a post with no title rather than showing a blank row", () => {
    expect(managedPost("abc", draft({ title: "  " }), null, NOW).title).toBe("Untitled")
  })
})

describe("missingFor", () => {
  it("passes a draft with everything the site shows", () => {
    expect(missingFor(draft())).toEqual([])
  })

  it("lists what a draft still needs", () => {
    expect(
      missingFor(
        draft({
          title: "",
          slug: null,
          excerpt: " ",
          category: null,
          hasCover: false,
          hasBody: false,
        }),
      ),
    ).toEqual(["a title", "a slug", "an excerpt", "a category", "a cover image", "a body"])
  })

  it("refuses a slug the site would answer 404 for", () => {
    expect(missingFor(draft({ slug: "Cleaning A Visor" }))).toEqual([
      "a slug of lower-case letters, numbers and hyphens",
    ])
  })

  it("does not hold a published post with no draft to a draft's checks", () => {
    expect(managedPost("abc", null, doc({ hasCover: false }), NOW).missing).toEqual([])
  })
})

describe("listOf", () => {
  it("reads as a sentence would", () => {
    expect(listOf([])).toBe("")
    expect(listOf(["a title"])).toBe("a title")
    expect(listOf(["a title", "a body"])).toBe("a title and a body")
    expect(listOf(["a title", "a slug", "a body"])).toBe("a title, a slug and a body")
  })
})

describe("managedPosts", () => {
  it("makes one post of a draft and its published document", () => {
    const posts = managedPosts([doc(), draft()], NOW)
    expect(posts).toHaveLength(1)
    expect(posts[0]).toMatchObject({ id: "abc", status: "LIVE", hasChanges: true })
  })

  it("lists the most recently edited first", () => {
    const posts = managedPosts(
      [
        doc({ _id: "old", _updatedAt: "2026-09-01T00:00:00Z" }),
        doc({ _id: "drafts.new", _updatedAt: "2026-09-30T00:00:00Z" }),
        doc({ _id: "mid", _updatedAt: "2026-09-15T00:00:00Z" }),
      ],
      NOW,
    )
    expect(posts.map((p) => p.id)).toEqual(["new", "mid", "old"])
  })

  it("leaves out documents that are versions of a post, not posts", () => {
    const posts = managedPosts([doc(), doc({ _id: "versions.release1.abc" })], NOW)
    expect(posts.map((p) => p.id)).toEqual(["abc"])
  })
})
