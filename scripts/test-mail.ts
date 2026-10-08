/**
 * Sends a real test email to check the mail keys before they go on the server.
 *
 *   pnpm mail:test you@example.com             each configured route on its own, then the chain
 *   pnpm mail:test you@example.com brevo-api   one route: brevo-api, brevo-smtp or smtp
 *   pnpm mail:test you@example.com chain       the chain, as the shop sends
 *
 * Reads .env. Each email says which route carried it, and carries a small PDF,
 * as an invoice does. A route is tested alone by switching the other routes'
 * keys off for that run, so each runs in a process of its own: the mailer
 * reads its settings once.
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import { register } from "node:module"

const ROUTES = ["brevo-api", "brevo-smtp", "smtp"] as const
type Run = (typeof ROUTES)[number] | "chain"

/** What switching a route off unsets. */
const KEYS: Record<(typeof ROUTES)[number], string[]> = {
  "brevo-api": ["BREVO_API_KEY"],
  "brevo-smtp": ["BREVO_SMTP_LOGIN", "BREVO_SMTP_KEY"],
  smtp: ["SMTP_HOST"],
}

const [to, which = "each"] = process.argv.slice(2)
if (!to || !to.includes("@")) {
  console.error(
    "Usage: pnpm mail:test you@example.com [each | chain | brevo-api | brevo-smtp | smtp]",
  )
  process.exit(1)
}

if (which === "each") {
  // One process per run, the same command with the run named.
  for (const run of [...ROUTES, "chain"]) {
    spawnSync("pnpm", ["mail:test", to, run], { stdio: "inherit", shell: true })
  }
  process.exit(0)
}

if (![...ROUTES, "chain"].includes(which)) {
  console.error(`No route called "${which}". Routes: ${ROUTES.join(", ")}, or chain.`)
  process.exit(1)
}
const run = which as Run

if (fs.existsSync(".env")) process.loadEnvFile(".env")
const missing = (route: (typeof ROUTES)[number]) =>
  route === "brevo-smtp"
    ? !process.env.BREVO_SMTP_LOGIN || !process.env.BREVO_SMTP_KEY
    : !process.env[KEYS[route][0]!]

if (run !== "chain") {
  if (missing(run)) {
    console.log(`${run.padEnd(10)}  not configured in .env, skipped`)
    process.exit(0)
  }
  for (const other of ROUTES) {
    if (other !== run) for (const key of KEYS[other]) delete process.env[key]
  }
}

// `server-only` is Next's marker, with no package of its own outside Next:
// stand in an empty module for it, as the tests do (test/stubs/server-only.ts).
register(
  "data:text/javascript,export async function resolve(s, c, next) { return s === 'server-only' ? { url: 'data:text/javascript,', shortCircuit: true } : next(s, c) }",
)

// After the env is settled: the mailer reads it on first use.
const { sendMail } = await import("@/lib/mailer")

// The smallest PDF a mail client will open, standing in for an invoice.
const pdf = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 200 100]/Parent 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
)
const when = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })

const result = await sendMail({
  to,
  subject: `SKELMET mail test: ${run}`,
  text: `This is a test from the SKELMET site, sent by the "${run}" run at ${when} IST.\n\nIf it arrived, that route works. The From line shows which sender it used, and a reply shows where replies go.`,
  html: `<p>This is a test from the SKELMET site, sent by the <strong>${run}</strong> run at ${when} IST.</p><p>If it arrived, that route works. The From line shows which sender it used, and a reply shows where replies go.</p>`,
  attachments: [{ filename: "attachment-test.pdf", content: pdf, contentType: "application/pdf" }],
})

if (result.delivered) {
  console.log(`${run.padEnd(10)}  sent via ${result.via}, message id ${result.messageId ?? "-"}`)
} else if (result.ok) {
  console.log(`${run.padEnd(10)}  nothing configured, nothing sent`)
} else {
  console.log(`${run.padEnd(10)}  FAILED: ${result.error}`)
  process.exitCode = 1
}
