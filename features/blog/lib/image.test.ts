import { describe, expect, it, vi } from "vitest"

vi.mock("@/features/blog/sanity/env", () => ({
  projectId: "abc123",
  dataset: "production",
  apiVersion: "2025-02-19",
  sanityConfigured: true,
}))

const { imageDimensions, imageUrl, sanityLoader } = await import("@/features/blog/lib/image")

const image = { asset: { _ref: "image-0123456789abcdef-2400x1600-jpg" } }

describe("imageUrl", () => {
  it("addresses the file on the project's image CDN, at the width asked for", () => {
    const url = new URL(imageUrl(image, { width: 1200 })!)
    expect(url.origin + url.pathname).toBe(
      "https://cdn.sanity.io/images/abc123/production/0123456789abcdef-2400x1600.jpg",
    )
    expect(url.searchParams.get("w")).toBe("1200")
    expect(url.searchParams.get("h")).toBeNull()
    expect(url.searchParams.get("auto")).toBe("format")
  })

  it("crops to a shape when given a height", () => {
    const url = new URL(imageUrl(image, { width: 1280, height: 720 })!)
    expect(url.searchParams.get("w")).toBe("1280")
    expect(url.searchParams.get("h")).toBe("720")
    expect(url.searchParams.get("fit")).toBe("crop")
  })

  it("is null when there is no picture", () => {
    expect(imageUrl(undefined, { width: 800 })).toBeNull()
    expect(imageUrl(null, { width: 800 })).toBeNull()
    expect(imageUrl({}, { width: 800 })).toBeNull()
  })
})

describe("imageDimensions", () => {
  it("reads the original's size out of its reference", () => {
    expect(imageDimensions(image)).toEqual({ width: 2400, height: 1600 })
  })

  it("is null for a reference that carries none", () => {
    expect(imageDimensions({ asset: { _ref: "file-abc-pdf" } })).toBeNull()
    expect(imageDimensions(undefined)).toBeNull()
  })
})

describe("sanityLoader", () => {
  it("asks for the width the screen needs", () => {
    const url = new URL(sanityLoader({ src: imageUrl(image, { width: 1440 })!, width: 640 }))
    expect(url.searchParams.get("w")).toBe("640")
    expect(url.searchParams.get("h")).toBeNull()
    expect(url.searchParams.get("q")).toBe("75")
  })

  it("keeps a crop's shape at every width", () => {
    const src = imageUrl(image, { width: 1280, height: 720 })!
    for (const width of [320, 640, 1080, 1920]) {
      const url = new URL(sanityLoader({ src, width, quality: 80 }))
      expect(url.searchParams.get("w")).toBe(String(width))
      expect(url.searchParams.get("h")).toBe(String(Math.round((width * 9) / 16)))
      expect(url.searchParams.get("fit")).toBe("crop")
      expect(url.searchParams.get("q")).toBe("80")
    }
  })
})

describe("without a Sanity project", () => {
  it("has no pictures rather than a broken address", async () => {
    vi.resetModules()
    vi.doMock("@/features/blog/sanity/env", () => ({
      projectId: "",
      dataset: "production",
      apiVersion: "2025-02-19",
      sanityConfigured: false,
    }))
    const unconfigured = await import("@/features/blog/lib/image")
    expect(unconfigured.imageUrl(image, { width: 800 })).toBeNull()
  })
})
