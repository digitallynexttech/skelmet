import { afterEach, describe, expect, it, vi } from "vitest"

/**
 * The mailer's promises: it gives up on a dead mail server in seconds rather
 * than minutes, and it never writes a customer's address into the logs.
 */

const mocks = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
}))

vi.mock("nodemailer", () => ({
  default: { createTransport: mocks.createTransport },
}))

const original = { ...process.env }

async function mailer(env: Record<string, string>) {
  process.env = { NODE_ENV: "test", ...env } as NodeJS.ProcessEnv
  vi.resetModules()
  return import("@/lib/mailer")
}

afterEach(() => {
  process.env = { ...original }
  vi.restoreAllMocks()
  mocks.createTransport.mockReset()
  mocks.sendMail.mockReset()
})

describe("maskEmail", () => {
  it("keeps the first letter and the domain only", async () => {
    const { maskEmail } = await mailer({})
    expect(maskEmail("rider@example.in")).toBe("r***@example.in")
    expect(maskEmail("not-an-address")).toBe("***")
  })
})

describe("sendMail", () => {
  it("gives the mail server seconds, not minutes", async () => {
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail })
    mocks.sendMail.mockResolvedValue({ messageId: "m1" })
    const { sendMail, SMTP_TIMEOUTS } = await mailer({ SMTP_HOST: "smtp.example.in" })

    await sendMail({ to: "rider@example.in", subject: "Hi", text: "Hi" })
    expect(mocks.createTransport).toHaveBeenCalledWith(expect.objectContaining(SMTP_TIMEOUTS))
    expect(SMTP_TIMEOUTS).toEqual({
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    })
  })

  it("never logs the customer's address", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail })
    mocks.sendMail.mockRejectedValue(new Error("421 try later"))

    const failing = await mailer({ SMTP_HOST: "smtp.example.in" })
    expect(await failing.sendMail({ to: "rider@example.in", subject: "Hi", text: "Hi" })).toEqual({
      ok: false,
      delivered: false,
      error: "421 try later",
    })

    const unconfigured = await mailer({})
    await unconfigured.sendMail({ to: "rider@example.in", subject: "Hi", text: "Hi" })

    const logged = [...error.mock.calls, ...warn.mock.calls].flat().join(" ")
    expect(logged).not.toContain("rider@example.in")
    expect(logged).toContain("r***@example.in")
  })
})
