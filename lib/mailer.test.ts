import { afterEach, describe, expect, it, vi } from "vitest"

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
  vi.unstubAllGlobals()
  mocks.createTransport.mockReset()
  mocks.sendMail.mockReset()
})

function brevoApi(status: number, body: unknown) {
  const fetch = vi.fn(
    async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
  )
  vi.stubGlobal("fetch", fetch)
  return fetch
}

/** By host: a message id to accept, or an Error to refuse. */
function smtpServers(hosts: Record<string, string | Error>) {
  const sent: Array<{ host: string; message: Record<string, unknown> }> = []
  mocks.createTransport.mockImplementation((options: { host: string }) => ({
    sendMail: async (message: Record<string, unknown>) => {
      const outcome = hosts[options.host]
      if (outcome === undefined) throw new Error(`no server at ${options.host}`)
      if (outcome instanceof Error) throw outcome
      sent.push({ host: options.host, message })
      return { messageId: outcome }
    },
    close: vi.fn(),
  }))
  return sent
}

const BREVO = {
  BREVO_API_KEY: "xkeysib-test",
  BREVO_SMTP_LOGIN: "relay@smtp-brevo.com",
  BREVO_SMTP_KEY: "xsmtpsib-test",
}
const GMAIL = {
  SMTP_HOST: "smtp.gmail.com",
  SMTP_USER: "skelmetindia@gmail.com",
  SMTP_PASSWORD: "app-password",
}

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
      refusals: [{ via: "smtp", error: "421 try later" }],
    })

    const unconfigured = await mailer({})
    await unconfigured.sendMail({ to: "rider@example.in", subject: "Hi", text: "Hi" })

    const logged = [...error.mock.calls, ...warn.mock.calls].flat().join(" ")
    expect(logged).not.toContain("rider@example.in")
    expect(logged).toContain("r***@example.in")
  })
})

describe("the three routes", () => {
  const mail = {
    to: "rider@example.in",
    subject: "Your order",
    text: "Thanks",
    html: "<p>Thanks</p>",
    attachments: [
      { filename: "invoice.pdf", content: Buffer.from("%PDF"), contentType: "application/pdf" },
    ],
  }

  it("sends by Brevo's API first, as the no-reply sender, with replies to MAIL_REPLY_TO", async () => {
    const fetch = brevoApi(201, { messageId: "<b1@smtp-relay.mailin.fr>" })
    const sent = smtpServers({ "smtp.gmail.com": "g1" })
    const { sendMail, BREVO_API_URL } = await mailer({
      ...BREVO,
      ...GMAIL,
      MAIL_REPLY_TO: "SKELMET <contact@skelmet.in>",
    })

    expect(await sendMail(mail)).toEqual({
      ok: true,
      delivered: true,
      messageId: "<b1@smtp-relay.mailin.fr>",
      via: "brevo-api",
    })
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(BREVO_API_URL)
    expect((init.headers as Record<string, string>)["api-key"]).toBe("xkeysib-test")
    expect(JSON.parse(init.body as string)).toEqual({
      sender: { name: "SKELMET", email: "no-reply@skelmet.in" },
      to: [{ email: "rider@example.in" }],
      subject: "Your order",
      htmlContent: "<p>Thanks</p>",
      textContent: "Thanks",
      replyTo: { name: "SKELMET", email: "contact@skelmet.in" },
      attachment: [{ name: "invoice.pdf", content: Buffer.from("%PDF").toString("base64") }],
    })
    // No SMTP server dialled.
    expect(mocks.createTransport).not.toHaveBeenCalled()
    expect(sent).toEqual([])
  })

  it("falls back to Brevo's SMTP relay, as the same sender", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    brevoApi(401, { code: "unauthorized", message: "Key not found" })
    const sent = smtpServers({ "smtp-relay.brevo.com": "r1", "smtp.gmail.com": "g1" })
    const { sendMail } = await mailer({ ...BREVO, ...GMAIL })

    expect(await sendMail(mail)).toMatchObject({
      delivered: true,
      messageId: "r1",
      via: "brevo-smtp",
    })
    expect(sent).toHaveLength(1)
    expect(sent[0]!.message.from).toBe("SKELMET <no-reply@skelmet.in>")
    expect(mocks.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp-relay.brevo.com",
        port: 587,
        auth: { user: "relay@smtp-brevo.com", pass: "xsmtpsib-test" },
      }),
    )
  })

  it("falls back to the shop's Gmail last, from the Gmail mailbox", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    brevoApi(429, { code: "too_many_requests", message: "Daily limit reached" })
    const sent = smtpServers({
      "smtp-relay.brevo.com": new Error("421 4.7.0 Daily sending quota exceeded"),
      "smtp.gmail.com": "g1",
    })
    const { sendMail } = await mailer({ ...BREVO, ...GMAIL })

    expect(await sendMail(mail)).toMatchObject({ delivered: true, messageId: "g1", via: "smtp" })
    expect(sent[0]!.message.from).toBe("SKELMET <skelmetindia@gmail.com>")
  })

  it("says which route refused what when none takes it, with no address in it", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    // Brevo quotes the address back, in its own capitals.
    brevoApi(400, { code: "invalid_parameter", message: "email is not valid: Rider@Example.in" })
    smtpServers({
      "smtp-relay.brevo.com": new Error("550 rider@example.in rejected"),
      "smtp.gmail.com": new Error("421 try later"),
    })
    const { sendMail } = await mailer({ ...BREVO, ...GMAIL })

    const result = await sendMail(mail)
    expect(result).toEqual({
      ok: false,
      delivered: false,
      error:
        "brevo-api: Brevo API 400: invalid_parameter: email is not valid: r***@example.in; " +
        "brevo-smtp: 550 r***@example.in rejected; smtp: 421 try later",
      refusals: [
        {
          via: "brevo-api",
          error: "Brevo API 400: invalid_parameter: email is not valid: r***@example.in",
        },
        { via: "brevo-smtp", error: "550 r***@example.in rejected" },
        { via: "smtp", error: "421 try later" },
      ],
    })
    const logged = [...error.mock.calls, ...warn.mock.calls].flat().join(" ").toLowerCase()
    expect(logged).not.toContain("rider@example.in")
  })

  it("never sends twice once Brevo has taken the message", async () => {
    brevoApi(201, "accepted")
    smtpServers({ "smtp.gmail.com": "g1" })
    const { sendMail } = await mailer({ BREVO_API_KEY: "xkeysib-test", ...GMAIL })

    expect(await sendMail(mail)).toEqual({
      ok: true,
      delivered: true,
      messageId: null,
      via: "brevo-api",
    })
    expect(mocks.createTransport).not.toHaveBeenCalled()
  })

  it("sends nothing and says so with no route configured", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const { sendMail, isMailConfigured } = await mailer({})
    expect(isMailConfigured()).toBe(false)
    expect(await sendMail(mail)).toEqual({ ok: true, delivered: false, reason: "unconfigured" })
  })

  it("counts Brevo alone as configured, and its relay only with both login and key", async () => {
    expect((await mailer({ BREVO_API_KEY: "k" })).isMailConfigured()).toBe(true)
    expect((await mailer({ BREVO_SMTP_LOGIN: "l" })).isMailConfigured()).toBe(false)
    expect((await mailer({ BREVO_SMTP_LOGIN: "l", BREVO_SMTP_KEY: "k" })).isMailConfigured()).toBe(
      true,
    )
  })
})

describe("openMailPool", () => {
  it("keeps one pooled SMTP connection for the whole list behind the API", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {})
    brevoApi(503, "Service Unavailable")
    smtpServers({ "smtp.gmail.com": "g1" })
    const { openMailPool } = await mailer({ BREVO_API_KEY: "xkeysib-test", ...GMAIL })

    const pool = await openMailPool()
    for (const to of ["a@example.in", "b@example.in", "c@example.in"]) {
      expect(await pool.send({ to, subject: "Drop", text: "New drop" })).toMatchObject({
        via: "smtp",
      })
    }
    pool.close()
    expect(mocks.createTransport).toHaveBeenCalledTimes(1)
    expect(mocks.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ pool: true, maxConnections: 1 }),
    )
  })
})

describe("parseAddress", () => {
  it("splits a display name from its address", async () => {
    const { parseAddress } = await mailer({})
    expect(parseAddress("SKELMET <no-reply@skelmet.in>")).toEqual({
      name: "SKELMET",
      email: "no-reply@skelmet.in",
    })
    expect(parseAddress('"SKELMET India" <hi@skelmet.in>')).toEqual({
      name: "SKELMET India",
      email: "hi@skelmet.in",
    })
    expect(parseAddress("no-reply@skelmet.in")).toEqual({ email: "no-reply@skelmet.in" })
  })
})
