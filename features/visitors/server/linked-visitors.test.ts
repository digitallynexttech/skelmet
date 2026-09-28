import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  db: {
    visitor: { findMany: vi.fn() },
    visitorSession: { findMany: vi.fn() },
  },
}))
vi.mock("@/server/db", () => ({ db: mocks.db }))

import { findLinkedVisitors, networkKey } from "@/features/visitors/server/linked-visitors"

describe("networkKey", () => {
  it("keeps an IPv4 address whole", () => {
    expect(networkKey("49.36.10.7")).toBe("v4:49.36.10.7")
    expect(networkKey("::ffff:49.36.10.7")).toBe("v4:49.36.10.7")
  })

  it("takes the /64 of an IPv6 address, however it is written", () => {
    const a = networkKey("2405:201:4021:20de:eea2:e627:f16b:f46")
    expect(a).toBe("v6:2405:0201:4021:20de")
    // Same connection, another address on it.
    expect(networkKey("2405:201:4021:20de::9")).toBe(a)
    expect(networkKey("2405:0201:4021:20DE:0:0:0:1")).toBe(a)
    // Zeros compressed inside the prefix.
    expect(networkKey("2405:201::1")).toBe("v6:2405:0201:0000:0000")
  })

  it("is null for anything that is not an address", () => {
    expect(networkKey(null)).toBeNull()
    expect(networkKey("")).toBeNull()
    expect(networkKey("unknown")).toBeNull()
    expect(networkKey("1::2::3")).toBeNull()
    expect(networkKey("1:2:3")).toBeNull()
  })
})

const at = (iso: string) => new Date(iso)
const other = (over: Record<string, unknown>) => ({
  id: "b",
  name: null,
  email: null,
  browser: "Chrome",
  os: "Android",
  deviceType: "mobile",
  deviceModel: null,
  lastSeenAt: at("2026-09-28T12:10:00Z"),
  anonymous: false,
  ...over,
})
const subject = {
  id: "a",
  email: null,
  phone: null,
  os: "Android",
  deviceType: "mobile",
  sessions: [
    {
      ip: "2405:201:4021:20de:eea2:e627:f16b:f46",
      startedAt: at("2026-09-28T12:04:00Z"),
      lastSeenAt: at("2026-09-28T12:05:00Z"),
    },
  ],
}

describe("findLinkedVisitors", () => {
  beforeEach(() => {
    mocks.db.visitor.findMany.mockReset().mockResolvedValue([])
    mocks.db.visitorSession.findMany.mockReset().mockResolvedValue([])
  })

  it("links Chrome and Brave on one phone: same /64, same system, minutes apart", async () => {
    mocks.db.visitorSession.findMany.mockResolvedValue([
      {
        ip: "2405:201:4021:20de:1111:2222:3333:4444",
        startedAt: at("2026-09-28T12:09:00Z"),
        visitor: other({ browser: "Brave" }),
      },
    ])
    const linked = await findLinkedVisitors(subject)
    expect(linked).toHaveLength(1)
    expect(linked[0]).toMatchObject({ id: "b", reason: "network" })
    expect(linked[0]!.because).toMatch(/^Same connection and device type, 4 min apart/)
  })

  it("does not link a different kind of device, or a visit far apart in time", async () => {
    mocks.db.visitorSession.findMany.mockResolvedValue([
      {
        ip: "2405:201:4021:20de::5",
        startedAt: at("2026-09-28T12:09:00Z"),
        visitor: other({ id: "laptop", os: "Windows", deviceType: "desktop" }),
      },
      {
        ip: "2405:201:4021:20de::6",
        startedAt: at("2026-09-29T12:09:00Z"),
        visitor: other({ id: "tomorrow" }),
      },
      {
        ip: "2405:201:4021:9999::6",
        startedAt: at("2026-09-28T12:09:00Z"),
        visitor: other({ id: "neighbour" }),
      },
      {
        ip: "2405:201:4021:20de::7",
        startedAt: at("2026-09-28T12:09:00Z"),
        visitor: other({ id: "refused", anonymous: true }),
      },
    ])
    expect(await findLinkedVisitors(subject)).toEqual([])
  })

  it("puts the same email ahead of a shared connection, and says which", async () => {
    mocks.db.visitor.findMany.mockResolvedValue([
      other({ id: "c", email: "Rider@Example.in", lastSeenAt: at("2026-09-20T10:00:00Z") }),
    ])
    mocks.db.visitorSession.findMany.mockResolvedValue([
      {
        ip: "2405:201:4021:20de::5",
        startedAt: at("2026-09-28T12:09:00Z"),
        visitor: other({}),
      },
    ])
    const linked = await findLinkedVisitors({ ...subject, email: "rider@example.in" })
    expect(linked.map((l) => [l.id, l.reason])).toEqual([
      ["c", "contact"],
      ["b", "network"],
    ])
    expect(linked[0]!.because).toBe("Same email typed at checkout")
  })

  it("calls a shared IPv4 address only a hint", async () => {
    mocks.db.visitorSession.findMany.mockResolvedValue([
      { ip: "49.36.10.7", startedAt: at("2026-09-28T12:05:30Z"), visitor: other({}) },
    ])
    const linked = await findLinkedVisitors({
      ...subject,
      sessions: [{ ...subject.sessions[0]!, ip: "49.36.10.7" }],
    })
    expect(linked[0]!.because).toMatch(/shared mobile network/)
  })
})
