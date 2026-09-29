/**
 * Builds the Militia Olive and Ghost Grey lineup cards - colourway-olive-print
 * and colourway-ghost-grey-print.jpg - from the print, seated in the orange
 * photo.
 *
 *   pnpm dev                       (or any server running this code)
 *   node scripts/build-colourway-cards.mjs [http://localhost:3000]
 *
 * The lineup is one product in three colours, and the orange card shows the
 * real one: the hero's 3D skull lands on the photo and sits there, lit as the
 * photo was, over the plate that hides the photographed skull. The olive and
 * grey cards were made from photographs an image model recoloured, and its
 * skulls were its own: a different jaw, softer flames, another eye. These
 * cards are the same skull, seated in the same photo, in the other two
 * filaments - so the row is three of one thing.
 *
 * It drives the real site in headless Chrome, as build-hero-poster does: the
 * model is served recoloured (the request for skull.glb is answered from
 * memory, nothing on disk changes), the skull is flown down to the orange
 * card and left to seat, and the canvas is captured alone - the seated skull,
 * under the studio rig, with nothing else - at the photo's own resolution.
 * That is composited onto the photo with its plate, which is the backdrop
 * with no skull on it.
 *
 * The swatches come from the catalogue, so the cards cannot drift from the
 * dots rendered beside them.
 */
import { spawn } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { NodeIO } from "@gltf-transform/core"
import { EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions"
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer"
import sharp from "sharp"

// fileURLToPath, not pathname: the URL form percent-encodes spaces in the path.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const BASE = process.argv[2] ?? "http://localhost:3000"
const PRODUCT = path.join(ROOT, "public/product")
const MODEL = path.join(PRODUCT, "skull.glb")
/** The photo the skull seats in, and the plate that takes its own skull out. */
const PHOTO = "/product/product-front.jpg"
const PLATE = "/product/product-front-plate.webp"

/**
 * tone: how much darker each filament prints than the orange, applied to the
 * swatch in linear light, which the render follows.
 *
 * The swatches alone are as bright as each other, and rendered straight the
 * olive came out 1.36 times the photographed orange print and the grey 1.49.
 * In colourway-lineup.jpg, where the three real prints stand under one light,
 * the olive's median luminance is 0.54 of the orange's and the grey's 0.95;
 * and the orange skull seated in its own card - the render these must match -
 * is 1.25 times the print. So olive goes to 0.54 x 1.25 = 0.68 of the print
 * and grey to 0.95 x 1.25 = 1.19: 0.50 and 0.80 of what the swatches gave.
 */
const CARDS = [
  { id: "olive", out: "colourway-olive-print.jpg", tone: 0.5 },
  { id: "ghost", out: "colourway-ghost-grey-print.jpg", tone: 0.8 },
]

/** A desktop wide enough for the lineup's three columns, at a card each. */
const VIEWPORT = { width: 1920, height: 1100 }
/** Above skull-canvas's MAX_PIXEL_RATIO, so the canvas draws at its sharpest. */
const SCALE = 2.8
const LIVE_TIMEOUT_MS = 120_000

// -- The swatches, read off the catalogue.
const catalogue = fs.readFileSync(path.join(ROOT, "features/catalog/catalog.ts"), "utf8")
const swatch = (id) => {
  const found = catalogue.match(new RegExp(`id: "${id}",[\\s\\S]*?hex: "(#[0-9A-Fa-f]{6})"`))
  if (!found) throw new Error(`No swatch for ${id} in catalog.ts`)
  return found[1]
}
const toLinear = (v) => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const hexLinear = (hex) => {
  const v = parseInt(hex.slice(1), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255].map(toLinear)
}

// -- The model in each colour, in memory.
await MeshoptDecoder.ready
await MeshoptEncoder.ready
const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder })
const recoloured = new Map()
for (const card of CARDS) {
  const doc = await io.read(MODEL)
  for (const material of doc.getRoot().listMaterials()) {
    material.setBaseColorFactor([...hexLinear(swatch(card.id)).map((c) => c * card.tone), 1])
  }
  recoloured.set(card.id, Buffer.from(await io.writeBinary(doc)).toString("base64"))
}

// -- The backdrop: the photo with its skull taken out.
const backdrop = await sharp(path.join(ROOT, "public", PHOTO))
  .composite([{ input: path.join(ROOT, "public", PLATE) }])
  .png()
  .toBuffer()
const { width: PW, height: PH } = await sharp(backdrop).metadata()

// -- Chrome.
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

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "skelmet-cards-"))
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
  for (const card of CARDS) {
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

    // The model, in this card's colour, from memory.
    await page("Fetch.enable", { patterns: [{ urlPattern: "*/product/skull.glb*" }] })
    cdp.on((msg) => {
      if (msg.sessionId !== sessionId || msg.method !== "Fetch.requestPaused") return
      void page("Fetch.fulfillRequest", {
        requestId: msg.params.requestId,
        responseCode: 200,
        responseHeaders: [{ name: "content-type", value: "model/gltf-binary" }],
        body: recoloured.get(card.id),
      })
    })

    await page("Page.enable")
    await page("Emulation.setDeviceMetricsOverride", {
      ...VIEWPORT,
      deviceScaleFactor: SCALE,
      mobile: false,
    })
    const loaded = new Promise((resolve) =>
      cdp.on(
        (msg) => msg.sessionId === sessionId && msg.method === "Page.loadEventFired" && resolve(),
      ),
    )
    await page("Page.navigate", { url: new URL("/", BASE).href })
    await loaded

    // The model waits for a sign of a person. A key, not the mouse.
    const nudge = setInterval(() => {
      for (const type of ["keyDown", "keyUp"]) {
        void page("Input.dispatchKeyEvent", {
          type,
          key: "Shift",
          code: "ShiftLeft",
          windowsVirtualKeyCode: 16,
        }).catch(() => {})
      }
    }, 1000)
    await waitFor(
      `(() => {
        const poster = document.querySelector("[data-skull-home] img")
        return !!document.querySelector("canvas") && getComputedStyle(poster).visibility === "hidden"
      })()`,
      "the model to take over",
      LIVE_TIMEOUT_MS,
    ).finally(() => clearInterval(nudge))

    // Down to the orange card, so the skull lands on it.
    const dock = JSON.stringify(`[data-skull-dock="${PHOTO}"]`)
    await evaluate(`(() => {
      const el = document.querySelector(${dock})
      const r = el.getBoundingClientRect()
      const cy = r.top + scrollY + r.height / 2
      window.scrollTo({ top: cy - 0.58 * innerHeight, behavior: "instant" })
    })()`)
    await waitFor(
      `document.querySelector(${dock}).style.getPropertyValue("--skull-dock") === "1.000"`,
      "the skull to seat",
    )
    // The lighting eases from stage to studio over the landing.
    await sleep(2500)

    // The seated skull alone, on nothing.
    const rect = await evaluate(`(() => {
      const c = document.querySelector("canvas")
      let flight = c
      while (flight.parentElement !== document.body) flight = flight.parentElement
      flight.setAttribute("data-cards-capture", "")
      const style = document.createElement("style")
      style.textContent = \`
        html, body { background: transparent !important; }
        body > :not([data-cards-capture]) { visibility: hidden !important; }
        html::before, html::after, body::before, body::after { display: none !important; }
      \`
      document.head.append(style)
      const r = document.querySelector(${dock}).getBoundingClientRect()
      return { x: r.x, y: r.y + scrollY, width: r.width, height: r.height }
    })()`)
    if (Math.abs(rect.width - rect.height) > 1) {
      throw new Error(`Expected a square card, got ${rect.width}x${rect.height}`)
    }
    await page("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } })
    await sleep(250)
    const { data } = await page("Page.captureScreenshot", {
      format: "png",
      clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 1 },
    })
    await page("Emulation.setDefaultBackgroundColorOverride", {})
    await cdp.send("Target.closeTarget", { targetId })

    // The card is the photo's middle, object-cover: as wide as the photo,
    // and as tall, cropped evenly top and bottom.
    const skull = await sharp(Buffer.from(data, "base64")).resize(PW, PW).png().toBuffer()
    const top = Math.round((PH - PW) / 2)

    // Sanity: the skull is there, and it is the colour asked for.
    const { data: px, info } = await sharp(skull)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    let opaque = 0
    const sum = [0, 0, 0]
    for (let p = 0; p < px.length; p += 4) {
      if (px[p + 3] < 200) continue
      opaque++
      for (let k = 0; k < 3; k++) sum[k] += px[p + k]
    }
    const cover = opaque / (info.width * info.height)
    if (cover < 0.1) throw new Error(`Only ${(cover * 100).toFixed(1)}% of the card is skull`)
    const mean = sum.map((v) => Math.round(v / opaque))

    const out = path.join(PRODUCT, card.out)
    await sharp(backdrop)
      .composite([{ input: skull, left: 0, top }])
      .jpeg({ quality: 82, chromaSubsampling: "4:4:4", mozjpeg: true })
      .toFile(out)
    console.log(
      `${card.out.padEnd(26)} ${PW}x${PH}  ${(fs.statSync(out).size / 1024).toFixed(0)} KB  ` +
        `skull ${(cover * 100).toFixed(0)}% of the card, mean rgb(${mean.join(",")}) for swatch ${swatch(card.id)}`,
    )
  }
} finally {
  await cdp.send("Browser.close").catch(() => {})
  cdp.close()
  await exited
  fs.rmSync(profile, { recursive: true, force: true })
}
