import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import SKULL_ASSETS from "@/components/marketing/skull-assets.json"
import { SKULL_MODEL, SKULL_POSTER } from "@/components/marketing/skull-interaction"

/**
 * The model and poster are cached for a month, so each must be named by its
 * content. Replacing one by hand, without the build scripts, fails here.
 */
describe("the hero skull's files", () => {
  const files = Object.entries(SKULL_ASSETS)

  it("exist where the site asks for them", () => {
    expect(SKULL_MODEL).toBe(SKULL_ASSETS.model)
    expect(SKULL_POSTER).toBe(SKULL_ASSETS.poster)
    for (const [, url] of files) {
      expect(fs.existsSync(path.join(process.cwd(), "public", url)), url).toBe(true)
    }
  })

  it("are named by their contents, so a changed file is a new URL", () => {
    for (const [, url] of files) {
      const bytes = fs.readFileSync(path.join(process.cwd(), "public", url))
      const hash = crypto.createHash("sha256").update(bytes).digest("hex").slice(0, 10)
      expect(path.basename(url), `${url} was replaced without being renamed`).toContain(`-${hash}.`)
    }
  })
})
