/**
 * Builds public/product/skull.glb, the hero's 3D skull, from the print file.
 *
 *   node scripts/build-skull-model.mjs [path/to/skelmet.stl]
 *
 * The model used to be generated from photographs, and every generator
 * invented what it could not see: horns for flames, a different eye, lumps
 * on the back of the head, a socket where the bracket goes. The STL the
 * skulls are printed from is the shape itself, so the site's model is that
 * file, turned to the site's axes and cut down to web size:
 *
 * - The slicer's file is Z up with the face along -Y; three.js is Y up with
 *   the camera on +Z. It is welded (STL repeats every vertex per triangle)
 *   and centred.
 * - The file carries the print's own layer lines as fine ripples over every
 *   surface. At a tenth of the triangles they cannot survive, and left in
 *   they came out as streaks along the flames, so they are smoothed away
 *   first. Taubin smoothing - a pull toward the neighbours, then a push back,
 *   so nothing shrinks - takes the ripple out at this density and leaves the
 *   flames, a hundred times larger, as they are.
 * - 1.9 million triangles are simplified to about a tenth. The simplifier is
 *   given the surface normals as well as the positions, so it keeps vertices
 *   where the surface turns, and the vertices left are then relaxed along the
 *   surface to even out the triangles: long, thin ones along a ridge shade as
 *   stripes, however exact their corners are.
 * - One flat colour, the filament's orange, and no textures. The print is
 *   one colour; the light and shade are the scene's job (skull-canvas), and
 *   they go all the way round, so nothing can mismatch between front and back.
 * - Quantised and meshopt-compressed: 94 MB of STL becomes under 1 MB. The
 *   decoder skull-canvas registers on its loader is what reads the result.
 *
 * It also prints the two numbers the code holds for the model's proportions -
 * REST_SILHOUETTE in skull-journey and HALO_REST's radius in skull-interaction -
 * so they can be updated when the print changes.
 *
 * The STL is kept beside the repo, not in it (94 MB every deploy cloned):
 * ../FILES_SKELMET/website-source-media/skelmet.stl by default.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { Document, Logger, NodeIO } from "@gltf-transform/core"
import { EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions"
import { meshopt, quantize, reorder } from "@gltf-transform/functions"
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer"

// fileURLToPath, not pathname: the URL form percent-encodes spaces in the path.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SRC = path.resolve(
  process.argv[2] ?? path.join(ROOT, "../FILES_SKELMET/website-source-media/skelmet.stl"),
)
if (!fs.existsSync(SRC)) throw new Error(`Print file not found: ${SRC}`)
const OUT = path.join(ROOT, "public/product/skull.glb")

/** Blaze Orange as the print renders under the site's lights, sRGB. */
const FILAMENT = [254, 106, 16]
/** Taubin smoothing passes before simplifying: enough to take out the layer lines. */
const SMOOTH_PASSES = 60
/** Share of the triangles kept, and the error allowed, as a share of the model's size. */
const SIMPLIFY_RATIO = 0.1
const SIMPLIFY_ERROR = 0.0004
/** How much a change of surface direction counts against a collapse, beside distance. */
const NORMAL_WEIGHT = 0.5
/**
 * Forward tilt, degrees. Standing on its base the print's face points 9°
 * above level - the jaw sits well ahead of the brow - and a level camera at
 * mid-height sees it looking up. Most of that is taken out so it meets the
 * visitor's eye; the base tilts with it, out of sight.
 */
const PITCH = -7
/** Passes of sliding vertices along the surface toward their neighbours, after simplifying. */
const RELAX_PASSES = 10

// -- Read the STL (binary), weld, turn, centre.
const buf = fs.readFileSync(SRC)
const count = buf.readUInt32LE(80)
if (84 + count * 50 !== buf.length) throw new Error("Expected a binary STL")

const key = new Map()
const verts = []
let idx = new Uint32Array(count * 3)
for (let i = 0; i < count * 3; i++) {
  const o = 84 + Math.floor(i / 3) * 50 + 12 + (i % 3) * 12
  // (x, y, z) with Z up and the face along -Y becomes (x, z, -y).
  const x = buf.readFloatLE(o)
  const y = buf.readFloatLE(o + 8)
  const z = -buf.readFloatLE(o + 4)
  const k = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`
  let v = key.get(k)
  if (v === undefined) {
    v = verts.length / 3
    key.set(k, v)
    verts.push(x, y, z)
  }
  idx[i] = v
}
let pos = new Float32Array(verts)

const lo = [Infinity, Infinity, Infinity]
const hi = [-Infinity, -Infinity, -Infinity]
for (let i = 0; i < pos.length; i += 3) {
  for (let k = 0; k < 3; k++) {
    lo[k] = Math.min(lo[k], pos[i + k])
    hi[k] = Math.max(hi[k], pos[i + k])
  }
}
for (let i = 0; i < pos.length; i += 3)
  for (let k = 0; k < 3; k++) pos[i + k] -= (lo[k] + hi[k]) / 2
const size = [0, 1, 2].map((k) => hi[k] - lo[k])

// The jaw stands proud at the bottom front: if the lower third of the head
// sits toward -Z, the file's front was +Y after all, and the model turns about.
let zSum = 0
let zN = 0
for (let i = 0; i < pos.length; i += 3) {
  if (pos[i + 1] < -size[1] / 6) {
    zSum += pos[i + 2]
    zN++
  }
}
if (zSum / zN < 0) {
  for (let i = 0; i < pos.length; i += 3) {
    pos[i] = -pos[i]
    pos[i + 2] = -pos[i + 2]
  }
}

// The tilt, about the width axis through the centre, as three applies rotation.x.
{
  const r = (PITCH * Math.PI) / 180
  const c = Math.cos(r)
  const sn = Math.sin(r)
  for (let i = 0; i < pos.length; i += 3) {
    const y = pos[i + 1]
    const z = pos[i + 2]
    pos[i + 1] = y * c - z * sn
    pos[i + 2] = y * sn + z * c
  }
  // Re-centred: the box has changed shape.
  const lo2 = [Infinity, Infinity, Infinity]
  const hi2 = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < pos.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      lo2[k] = Math.min(lo2[k], pos[i + k])
      hi2[k] = Math.max(hi2[k], pos[i + k])
    }
  }
  for (let i = 0; i < pos.length; i += 3)
    for (let k = 0; k < 3; k++) pos[i + k] -= (lo2[k] + hi2[k]) / 2
  for (let k = 0; k < 3; k++) size[k] = hi2[k] - lo2[k]
}

/** Each vertex's neighbours, packed: neighbours of v are adj[off[v] .. off[v + 1]). */
function neighbours(pos, idx) {
  const n = pos.length / 3
  const deg = new Uint32Array(n)
  for (let t = 0; t < idx.length; t++) deg[idx[t]] += 2
  const off = new Uint32Array(n + 1)
  for (let v = 0; v < n; v++) off[v + 1] = off[v] + deg[v]
  const adj = new Uint32Array(off[n])
  const fill = new Uint32Array(n)
  for (let t = 0; t < idx.length; t += 3) {
    const tri = [idx[t], idx[t + 1], idx[t + 2]]
    for (let k = 0; k < 3; k++) {
      const v = tri[k]
      adj[off[v] + fill[v]++] = tri[(k + 1) % 3]
      adj[off[v] + fill[v]++] = tri[(k + 2) % 3]
    }
  }
  return { off, adj }
}

/** Where each vertex's neighbours are, on average, relative to it. */
function umbrella(pos, { off, adj }, out) {
  const n = pos.length / 3
  for (let v = 0; v < n; v++) {
    const s = off[v]
    const e = off[v + 1]
    if (e === s) {
      out[v * 3] = out[v * 3 + 1] = out[v * 3 + 2] = 0
      continue
    }
    let sx = 0
    let sy = 0
    let sz = 0
    for (let i = s; i < e; i++) {
      const u = adj[i]
      sx += pos[u * 3]
      sy += pos[u * 3 + 1]
      sz += pos[u * 3 + 2]
    }
    const k = e - s
    out[v * 3] = sx / k - pos[v * 3]
    out[v * 3 + 1] = sy / k - pos[v * 3 + 1]
    out[v * 3 + 2] = sz / k - pos[v * 3 + 2]
  }
}

/** Smooth normals, area-weighted, from the triangles as they are. */
function smoothNormals(pos, idx) {
  const n = pos.length / 3
  const acc = new Float64Array(n * 3)
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t]
    const b = idx[t + 1]
    const c = idx[t + 2]
    const ux = pos[b * 3] - pos[a * 3]
    const uy = pos[b * 3 + 1] - pos[a * 3 + 1]
    const uz = pos[b * 3 + 2] - pos[a * 3 + 2]
    const vx = pos[c * 3] - pos[a * 3]
    const vy = pos[c * 3 + 1] - pos[a * 3 + 1]
    const vz = pos[c * 3 + 2] - pos[a * 3 + 2]
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx
    for (const v of [a, b, c]) {
      acc[v * 3] += nx
      acc[v * 3 + 1] += ny
      acc[v * 3 + 2] += nz
    }
  }
  const nor = new Float32Array(n * 3)
  for (let v = 0; v < n; v++) {
    const l = Math.hypot(acc[v * 3], acc[v * 3 + 1], acc[v * 3 + 2]) || 1
    nor[v * 3] = acc[v * 3] / l
    nor[v * 3 + 1] = acc[v * 3 + 1] / l
    nor[v * 3 + 2] = acc[v * 3 + 2] / l
  }
  return nor
}

// -- The layer lines: Taubin smoothing on the full mesh.
{
  const nb = neighbours(pos, idx)
  const delta = new Float32Array(pos.length)
  const step = (f) => {
    umbrella(pos, nb, delta)
    for (let i = 0; i < pos.length; i++) pos[i] += delta[i] * f
  }
  for (let it = 0; it < SMOOTH_PASSES; it++) {
    step(0.5)
    step(-0.53)
  }
}

// -- Simplify, with the normals beside the positions.
await MeshoptSimplifier.ready
{
  const nor = smoothNormals(pos, idx)
  const target = Math.floor((idx.length * SIMPLIFY_RATIO) / 3) * 3
  const [kept] = MeshoptSimplifier.simplifyWithAttributes(
    idx,
    pos,
    3,
    nor,
    3,
    [NORMAL_WEIGHT, NORMAL_WEIGHT, NORMAL_WEIGHT],
    null,
    target,
    SIMPLIFY_ERROR,
  )
  // Only the vertices still referenced, renumbered.
  const map = new Int32Array(pos.length / 3).fill(-1)
  const packed = []
  const out = new Uint32Array(kept.length)
  for (let i = 0; i < kept.length; i++) {
    const v = kept[i]
    if (map[v] < 0) {
      map[v] = packed.length / 3
      packed.push(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2])
    }
    out[i] = map[v]
  }
  pos = new Float32Array(packed)
  idx = out
}

// -- Even out the triangles: each vertex slides toward its neighbours' mean,
// along the surface only, so the shape stays and the slivers go.
{
  const nb = neighbours(pos, idx)
  const delta = new Float32Array(pos.length)
  for (let it = 0; it < RELAX_PASSES; it++) {
    const nor = smoothNormals(pos, idx)
    umbrella(pos, nb, delta)
    for (let v = 0; v < pos.length / 3; v++) {
      const d =
        delta[v * 3] * nor[v * 3] +
        delta[v * 3 + 1] * nor[v * 3 + 1] +
        delta[v * 3 + 2] * nor[v * 3 + 2]
      for (let k = 0; k < 3; k++) pos[v * 3 + k] += (delta[v * 3 + k] - d * nor[v * 3 + k]) * 0.5
    }
  }
}
const nor = smoothNormals(pos, idx)

// -- The document.
const toLinear = (v) => {
  const c = v / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const doc = new Document().setLogger(new Logger(Logger.Verbosity.WARN))
const buffer = doc.createBuffer()
const material = doc
  .createMaterial("filament")
  .setBaseColorFactor([...FILAMENT.map(toLinear), 1])
  .setMetallicFactor(0)
  .setRoughnessFactor(0.6)
const prim = doc
  .createPrimitive()
  .setMaterial(material)
  .setAttribute("POSITION", doc.createAccessor().setType("VEC3").setArray(pos).setBuffer(buffer))
  .setAttribute("NORMAL", doc.createAccessor().setType("VEC3").setArray(nor).setBuffer(buffer))
  .setIndices(doc.createAccessor().setType("SCALAR").setArray(idx).setBuffer(buffer))
doc
  .createScene("Scene")
  .addChild(doc.createNode("skull").setMesh(doc.createMesh("skull").addPrimitive(prim)))

await MeshoptEncoder.ready
await doc.transform(
  // Reordered for the compressor: neighbouring triangles side by side in the
  // buffer is what lets meshopt find them, a third off the file.
  reorder({ encoder: MeshoptEncoder }),
  quantize({ quantizeNormal: 8 }),
  meshopt({ encoder: MeshoptEncoder, level: "high" }),
)

const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder })
await io.write(OUT, doc)

// -- The numbers the code holds. skull-canvas: camera z 5.4, 32° fov, the
// height normalised to SKULL_HEIGHT units, the model lifted by 0.06.
const SKULL_HEIGHT = 2.36 // the same number as skull-canvas
const CAM = 5.4
const T = Math.tan((32 * Math.PI) / 360)
const scale = SKULL_HEIGHT / size[1]
const LIFT = 0.06
let vmin = Infinity
let vmax = -Infinity
let umin = Infinity
let umax = -Infinity
for (let i = 0; i < pos.length; i += 3) {
  const d = (CAM - pos[i + 2] * scale) * T
  const u = (pos[i] * scale) / d
  const v = (pos[i + 1] * scale + LIFT) / d
  vmin = Math.min(vmin, v)
  vmax = Math.max(vmax, v)
  umin = Math.min(umin, u)
  umax = Math.max(umax, u)
}

console.log(`source   ${count} triangles, ${key.size} points once welded`)
console.log(
  `written  ${path.relative(ROOT, OUT)}  ${idx.length / 3} triangles  ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB`,
)
console.log(
  `REST_SILHOUETTE (skull-journey)  height ${((vmax - vmin) / 2).toFixed(3)}  centreX ${((1 + (umin + umax) / 2) / 2).toFixed(3)}  centreY ${((1 - (vmin + vmax) / 2) / 2).toFixed(3)}`,
)
console.log(
  `HALO_REST.r (skull-interaction)  ${(((size[0] / size[1]) * SKULL_HEIGHT) / 2 / 3.096).toFixed(3)}  (width/height ${(size[0] / size[1]).toFixed(3)})`,
)
