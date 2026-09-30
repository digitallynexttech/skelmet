/**
 * Builds the hero's poster, public/product/hero-skull-poster-<hash>.webp: a
 * frame of the hero mesh at rest, captured from the running site.
 *
 *   pnpm dev                       (or any server running this code)
 *   node scripts/build-hero-poster.mjs [http://localhost:3000]
 *
 * The poster stands in for the 3D skull until the model arrives, and for good
 * for the visitors who never download it (see SkullStage). It used to be the
 * front-on product photo keyed to alpha, and the swap was plain to see: a flat
 * studio shot, smaller than the mesh, gave way to a lit render in the hero's
 * orange and violet. The only picture that matches the mesh is the mesh.
 *
 * So this drives the real component in headless Chrome over the DevTools
 * protocol - Node's own WebSocket, no puppeteer - rather than rebuilding the
 * scene here, which would drift from skull-scene the first time anyone relit
 * it. It waits for the model to take over, stops the clock where the bob
 * crosses its middle, hides everything but the canvas and screenshots the
 * stage with a transparent background.
 *
 * The scene normally draws in a worker, whose clock this script cannot reach.
 * So it takes away the browser's means of handing a canvas to a worker before
 * the page loads, and the scene runs on the page's own thread instead - the
 * same code, the same picture (see skull-renderer).
 *
 * The frame is the whole 4:5 stage, so the poster and the canvas fill the same
 * box and line up at every size with no numbers to keep in step. It is taken
 * at the canvas's own resolution on a desktop: the largest stage (720px, at
 * xl) at skull-canvas's 1.75 pixel ratio cap. WebGL runs on SwiftShader, on
 * the CPU, so the frame does not depend on the machine's graphics card.
 */
import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

import { publishAsset } from "./skull-assets.mjs"

const require = createRequire(import.meta.url)
// fileURLToPath, not pathname: the URL form percent-encodes spaces in the path.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

// sharp ships with Next but is not hoisted, so resolve it out of the store.
const store = path.join(ROOT, "node_modules/.pnpm")
const sharpDir = fs
  .readdirSync(store)
  .filter((d) => d.startsWith("sharp@"))
  .sort()
  .pop()
if (!sharpDir) throw new Error("sharp not found in the pnpm store")
const sharp = require(path.join(store, sharpDir, "node_modules/sharp"))

const BASE = process.argv[2] ?? "http://localhost:3000"

/** At xl the stage is min(720px, 100svh - 180px): 720px tall at this height. */
const VIEWPORT = { width: 1600, height: 1000 }
/** skull-canvas's MAX_PIXEL_RATIO, so one poster pixel is one canvas pixel. */
const SCALE = 1.75
/** Model download, meshopt decode and a software shader compile. */
const LIVE_TIMEOUT_MS = 120_000

const CHROME =
  process.env.CHROME_PATH ??
  [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].find((p) => fs.existsSync(p))
if (!CHROME) throw new Error("No Chrome found: set CHROME_PATH")

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** A minimal DevTools protocol client: commands by id, events to listeners. */
function connect(url) {
  const ws = new WebSocket(url)
  const pending = new Map()
  const listeners = new Set()
  let last = 0
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data)
    if (msg.id === undefined) {
      for (const listener of listeners) listener(msg)
      return
    }
    const call = pending.get(msg.id)
    pending.delete(msg.id)
    if (msg.error) call.reject(new Error(`${call.method}: ${msg.error.message}`))
    else call.resolve(msg.result)
  })
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++last
      pending.set(id, { resolve, reject, method })
      ws.send(JSON.stringify({ id, method, params, sessionId }))
    })
  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () =>
      resolve({ send, on: (listener) => listeners.add(listener), close: () => ws.close() }),
    )
    ws.addEventListener("error", () => reject(new Error(`Could not connect to ${url}`)))
  })
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "skelmet-poster-"))
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--hide-scrollbars",
    "--mute-audio",
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
)
const exited = new Promise((resolve) => chrome.once("exit", resolve))

const endpoint = await new Promise((resolve, reject) => {
  let err = ""
  chrome.stderr.on("data", (chunk) => {
    err += chunk
    const found = err.match(/DevTools listening on (ws:\/\/\S+)/)
    if (found) resolve(found[1])
  })
  chrome.once("exit", (code) => reject(new Error(`Chrome exited (${code}):\n${err}`)))
})

const cdp = await connect(endpoint)
try {
  const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" })
  const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true })
  const page = (method, params) => cdp.send(method, params, sessionId)
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await page("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text)
    }
    return result.value
  }
  const waitFor = async (expression, what, timeout = 30_000) => {
    const until = Date.now() + timeout
    for (;;) {
      const value = await evaluate(expression)
      if (value) return value
      if (Date.now() > until) throw new Error(`Timed out waiting for ${what}`)
      await sleep(250)
    }
  }

  await page("Page.enable")
  await page("Emulation.setDeviceMetricsOverride", {
    ...VIEWPORT,
    deviceScaleFactor: SCALE,
    mobile: false,
  })
  // The scene on the page's thread, where its clock can be stopped below.
  await page("Page.addScriptToEvaluateOnNewDocument", {
    source: "delete HTMLCanvasElement.prototype.transferControlToOffscreen",
  })
  const loaded = new Promise((resolve) =>
    cdp.on(
      (msg) => msg.sessionId === sessionId && msg.method === "Page.loadEventFired" && resolve(),
    ),
  )
  await page("Page.navigate", { url: new URL("/", BASE).href })
  await loaded

  // The poster's bob, which the mesh keeps time with: when it began and how
  // long one lasts, read off the animation rather than copied from the source.
  const bob = await waitFor(
    `(() => {
      const a = document.querySelector("[data-skull-home] img")?.getAnimations()[0]
      const start = a?.startTime
      return typeof start === "number" && { start, period: a.effect.getTiming().duration }
    })()`,
    "the poster's bob",
  )

  // The model waits for a sign of a person. A key, not the mouse: the mesh
  // turns to face the cursor, and the poster has to face the camera.
  for (const type of ["keyDown", "keyUp"]) {
    await page("Input.dispatchKeyEvent", {
      type,
      key: "Shift",
      code: "ShiftLeft",
      windowsVirtualKeyCode: 16,
    })
  }
  await waitFor(
    `(() => {
      const poster = document.querySelector("[data-skull-home] img")
      return !!document.querySelector("canvas") && getComputedStyle(poster).visibility === "hidden"
    })()`,
    "the model to take over",
    LIVE_TIMEOUT_MS,
  )

  // Stop the clock where the bob's cosine crosses zero, so the frame sits
  // exactly on the rest line the poster bobs about. Later than now, or the
  // canvas's idle throttle would read it as too soon to draw.
  await evaluate(`(() => {
    const { start, period } = ${JSON.stringify(bob)}
    const k = Math.ceil((performance.now() + 500 - start - period / 4) / (period / 2))
    const at = start + period / 4 + k * (period / 2)
    performance.now = () => at
  })()`)
  await sleep(2000)

  // Only the canvas, on nothing.
  const clip = await evaluate(`(() => {
    // The box that is flown down the page, and the body's child it sits in.
    const flight = document.querySelector("[data-skull-flight]")
    let top = flight
    while (top.parentElement !== document.body) top = top.parentElement
    top.setAttribute("data-poster-capture", "")
    const style = document.createElement("style")
    style.textContent = \`
      html, body { background: transparent !important; }
      body > :not([data-poster-capture]) { visibility: hidden !important; }
      html::before, html::after, body::before, body::after { display: none !important; }
    \`
    document.head.append(style)
    const home = document.querySelector("[data-skull-home]").getBoundingClientRect()
    const box = flight.getBoundingClientRect()
    return {
      x: home.x,
      y: home.y,
      width: home.width,
      height: home.height,
      scrolled: scrollY,
      off: Math.max(...["x", "y", "width", "height"].map((k) => Math.abs(box[k] - home[k]))),
    }
  })()`)
  if (clip.scrolled !== 0) throw new Error(`The page scrolled (${clip.scrolled}px)`)
  // The poster is drawn in the stage box; the canvas has to be there too.
  if (clip.off > 0.5) throw new Error(`The canvas is ${clip.off}px off the stage`)

  await page("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } })
  await sleep(250)
  const { data } = await page("Page.captureScreenshot", {
    format: "png",
    clip: { x: clip.x, y: clip.y, width: clip.width, height: clip.height, scale: 1 },
  })

  const png = Buffer.from(data, "base64")
  const { data: raw, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  let opaque = 0
  for (let p = 3; p < raw.length; p += 4) if (raw[p] > 128) opaque++
  const cover = opaque / (info.width * info.height)
  // The skull fills about half the stage. Much less and WebGL drew nothing.
  if (cover < 0.2) throw new Error(`Only ${(cover * 100).toFixed(1)}% of the frame is skull`)

  const out = await sharp(png).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toBuffer()
  // Named by its contents, as the model is: see skull-assets.mjs.
  const OUT = publishAsset("poster", "hero-skull-poster", ".webp", out)

  console.log(`stage    ${clip.width}x${clip.height} css px at ${SCALE}x`)
  console.log(`frame    ${info.width}x${info.height}  skull ${(cover * 100).toFixed(1)}%`)
  console.log(`written  ${path.relative(ROOT, OUT)}  ${(out.length / 1024).toFixed(1)} KB`)
} finally {
  await cdp.send("Browser.close").catch(() => {})
  cdp.close()
  await exited
  fs.rmSync(profile, { recursive: true, force: true })
}
