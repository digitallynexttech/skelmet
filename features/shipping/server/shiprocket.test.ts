import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

/**
 * Logging in to Shiprocket. A refused login pauses the next ones, because
 * Shiprocket locks the API user after repeated failures and an attempt made
 * while it is locked can restart the lock.
 */

const LOGIN = "https://apiv2.shiprocket.in/v1/external/auth/login"

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })

/**
 * A fetch that answers logins with `logins`, in order, and everything else
 * with an empty 200. A Response body reads once, so each call builds its own.
 */
function shiprocket(...logins: Array<() => Response>) {
  const queue = [...logins]
  return vi.fn(async (url: string | URL) => {
    if (String(url) === LOGIN) {
      const next = queue.shift()
      if (!next) throw new Error("unexpected login")
      return next()
    }
    return json(200, { tracking_data: {} })
  })
}

const refusedLogin = () =>
  json(400, { message: "User blocked due to too many failed login attempts." })
const goodLogin = () => json(200, { token: "t0k3n" })

/** A fresh copy, so the token, the pause and the env cache start empty. */
async function client() {
  vi.resetModules()
  return import("@/features/shipping/server/shiprocket")
}

const logins = (fetchMock: ReturnType<typeof shiprocket>) =>
  fetchMock.mock.calls.filter(([url]) => String(url) === LOGIN).length

beforeEach(() => {
  process.env.SHIPROCKET_EMAIL = "api-user@example.com"
  process.env.SHIPROCKET_PASSWORD = "secret"
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2026-09-25T12:00:00Z"))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  delete process.env.SHIPROCKET_EMAIL
  delete process.env.SHIPROCKET_PASSWORD
})

describe("logging in to Shiprocket", () => {
  it("does not ask again straight after a refused login", async () => {
    const fetchMock = shiprocket(refusedLogin)
    vi.stubGlobal("fetch", fetchMock)
    const sr = await client()

    await expect(sr.trackAwb("123")).rejects.toThrow(/User blocked/)
    await expect(sr.trackAwb("123")).rejects.toThrow(/Not trying again for 15 min/)
    await expect(sr.trackAwb("123")).rejects.toMatchObject({ status: 503 })

    expect(logins(fetchMock)).toBe(1)
  })

  it("asks again once the pause is over, and carries on when it works", async () => {
    const fetchMock = shiprocket(refusedLogin, goodLogin)
    vi.stubGlobal("fetch", fetchMock)
    const sr = await client()

    await expect(sr.trackAwb("123")).rejects.toThrow(/User blocked/)

    vi.setSystemTime(new Date("2026-09-25T12:14:00Z"))
    await expect(sr.trackAwb("123")).rejects.toThrow(/Not trying again for 1 min/)

    vi.setSystemTime(new Date("2026-09-25T12:15:01Z"))
    await expect(sr.trackAwb("123")).resolves.toEqual({ tracking_data: {} })
    await expect(sr.trackAwb("456")).resolves.toEqual({ tracking_data: {} })

    // One refused login, one good one, and the token reused after that.
    expect(logins(fetchMock)).toBe(2)
  })

  it("does not pause when Shiprocket itself is failing", async () => {
    const fetchMock = shiprocket(() => json(503, { message: "Service unavailable" }), goodLogin)
    vi.stubGlobal("fetch", fetchMock)
    const sr = await client()

    await expect(sr.trackAwb("123")).rejects.toThrow(/could not log in just now/)
    await expect(sr.trackAwb("123")).resolves.toEqual({ tracking_data: {} })

    expect(logins(fetchMock)).toBe(2)
  })
})

describe("looking a pincode up", () => {
  /** Logs in, and answers the postcode lookup with `answer`. */
  function postcode(answer: () => Response) {
    return vi.fn(async (url: string | URL) => {
      if (String(url) === LOGIN) return goodLogin()
      if (String(url).includes("/open/postcode/details?postcode=")) return answer()
      throw new Error(`unexpected request: ${String(url)}`)
    })
  }

  it("gives the city and state Shiprocket files the pincode under", async () => {
    vi.stubGlobal(
      "fetch",
      postcode(() =>
        json(200, {
          success: true,
          postcode_details: { postcode: "110044", city: "South Delhi", state: "Delhi" },
        }),
      ),
    )
    const sr = await client()

    await expect(sr.postcodeDetails("110044")).resolves.toEqual({
      city: "South Delhi",
      state: "Delhi",
    })
  })

  it("is null for a pincode Shiprocket does not know, which it reports as an error", async () => {
    vi.stubGlobal(
      "fetch",
      postcode(() =>
        json(500, { message: "City/State not found for this pincode : 123456", code: 403 }),
      ),
    )
    const sr = await client()

    await expect(sr.postcodeDetails("123456")).resolves.toBeNull()
  })

  it("still fails when Shiprocket itself does", async () => {
    vi.stubGlobal(
      "fetch",
      postcode(() => json(503, { message: "Service unavailable" })),
    )
    const sr = await client()

    await expect(sr.postcodeDetails("110044")).rejects.toThrow(/Service unavailable/)
  })
})
