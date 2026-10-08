import { describe, expect, it } from "vitest"

import { strugglesWithModel } from "@/components/marketing/skull-interaction"

describe("which devices get the 3D skull", () => {
  it("gives it to every iPhone: Safari reports no memory and always 4 cores", () => {
    expect(strugglesWithModel({ touch: true, memory: undefined, cores: 4 })).toBe(false)
  })

  it("gives it to a 4 or 6 GB Android phone, which both report 4", () => {
    expect(strugglesWithModel({ touch: true, memory: 4, cores: 8 })).toBe(false)
    expect(strugglesWithModel({ touch: true, memory: 8, cores: 8 })).toBe(false)
  })

  it("keeps it from a phone with 2 GB or less, or four cores or fewer", () => {
    expect(strugglesWithModel({ touch: true, memory: 2, cores: 8 })).toBe(true)
    expect(strugglesWithModel({ touch: true, memory: 1, cores: 8 })).toBe(true)
    expect(strugglesWithModel({ touch: true, memory: 4, cores: 4 })).toBe(true)
  })

  it("never holds it back from a computer, however modest", () => {
    expect(strugglesWithModel({ touch: false, memory: 2, cores: 2 })).toBe(false)
  })

  it("takes a phone that reports nothing to be capable", () => {
    expect(strugglesWithModel({ touch: true, memory: undefined, cores: undefined })).toBe(false)
  })
})
