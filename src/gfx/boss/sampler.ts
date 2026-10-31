// Turns a CreatureDef into particle attribute buffers (rest pose + skinning + look params).
import type { CreatureDef, PartDef } from './rig';
import { boxDist, primDist, smin } from './sdf';
import { fbm, hashStr, mulberry32, ridged, type Rand } from './rng';

/** Particle types (aB.x in the shader) */
export const enum PT {
  Fill = 0,
  Rim = 1,
  Glow = 2,
  Halo = 3,
  Stroke = 4,
  Sparkle = 5,
}

export function partDist(part: PartDef, x: number, y: number): number {
  let d = 1e9;
  const k = part.k;
  for (const p of part.prims) {
    if (boxDist(x, y, p.x0, p.y0, p.x1, p.y1) > d + k) continue;
    d = smin(d, primDist(p, x, y), k);
  }
  return d;
}

/** Rasterized SDF of one part (bilinear lookups). */
export class Field {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
  readonly res: number;
  readonly nx: number;
  readonly ny: number;
  readonly data: Float32Array;
  readonly margin: number;
  constructor(part: PartDef, res: number, margin: number) {
    this.res = res;
    this.margin = margin;
    this.x0 = part.x0 - margin;
    this.y0 = part.y0 - margin;
    this.nx = Math.max(2, Math.ceil((part.x1 + margin - this.x0) * res) + 1);
    this.ny = Math.max(2, Math.ceil((part.y1 + margin - this.y0) * res) + 1);
    this.x1 = this.x0 + (this.nx - 1) / res;
    this.y1 = this.y0 + (this.ny - 1) / res;
    this.data = new Float32Array(this.nx * this.ny);
    // coarse-to-fine: exact SDF on a coarse lattice; fine cells far from the boundary (all 4 coarse corners farther
    // than the coarse cell diagonal, same sign) are bilinearly interpolated, the rest are evaluated exactly.
    // Safe because the (smooth-)union SDF is 1-Lipschitz.
    const S = 4;
    const cnx = Math.floor((this.nx - 1) / S) + 2;
    const cny = Math.floor((this.ny - 1) / S) + 2;
    const coarse = new Float32Array(cnx * cny);
    const cs = S / res;
    for (let cj = 0; cj < cny; cj++) {
      const y = this.y0 + cj * cs;
      for (let ci = 0; ci < cnx; ci++) coarse[cj * cnx + ci] = partDist(part, this.x0 + ci * cs, y);
    }
    const safe = cs * Math.SQRT2 * 1.15 + 0.02;
    for (let j = 0; j < this.ny; j++) {
      const y = this.y0 + j / res;
      const cj = Math.floor(j / S);
      const ty = (j - cj * S) / S;
      for (let i = 0; i < this.nx; i++) {
        const ci = Math.floor(i / S);
        const tx = (i - ci * S) / S;
        const o = cj * cnx + ci;
        const a = coarse[o];
        const b = coarse[o + 1];
        const c = coarse[o + cnx];
        const d = coarse[o + cnx + 1];
        const far =
          Math.min(Math.abs(a), Math.abs(b), Math.abs(c), Math.abs(d)) > safe && (a > 0) === (b > 0) && (a > 0) === (c > 0) && (a > 0) === (d > 0);
        this.data[j * this.nx + i] = far
          ? a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty
          : partDist(part, this.x0 + i / res, y);
      }
    }
  }
  sample(x: number, y: number): number {
    if (x <= this.x0 || y <= this.y0 || x >= this.x1 || y >= this.y1) {
      return this.margin + boxDist(x, y, this.x0, this.y0, this.x1, this.y1);
    }
    const fx = (x - this.x0) * this.res;
    const fy = (y - this.y0) * this.res;
    const i = Math.floor(fx);
    const j = Math.floor(fy);
    const tx = fx - i;
    const ty = fy - j;
    const nx = this.nx;
    const o = j * nx + i;
    const a = this.data[o];
    const b = this.data[o + 1];
    const c = this.data[o + nx];
    const d = this.data[o + nx + 1];
    return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
  }
}

export interface Skin {
  a: number;
  b: number;
  w: number;
}

/** 2-bone weights for a point inside `part`: distance-softmax over its primitives grouped by bone. */
export function partWeights(part: PartDef, x: number, y: number, out: Skin): Skin {
  let b1 = -1;
  let d1 = Infinity;
  let b2 = -1;
  let d2 = Infinity;
  // best distance per bone (parts have few bones; linear scan is fine)
  const seen: number[] = [];
  const best: number[] = [];
  for (const p of part.prims) {
    const d = primDist(p, x, y);
    const k = seen.indexOf(p.bone);
    if (k < 0) {
      seen.push(p.bone);
      best.push(d);
    } else if (d < best[k]) best[k] = d;
  }
  for (let i = 0; i < seen.length; i++) {
    const d = best[i];
    if (d < d1) {
      b2 = b1;
      d2 = d1;
      b1 = seen[i];
      d1 = d;
    } else if (d < d2) {
      b2 = seen[i];
      d2 = d;
    }
  }
  out.a = b1 < 0 ? 0 : b1;
  if (b2 < 0) {
    out.b = out.a;
    out.w = 0;
    return out;
  }
  out.b = b2;
  out.w = 0.5 * Math.exp(-Math.max(0, d2 - d1) / Math.max(1e-3, part.blend));
  return out;
}

export interface CreatureSample {
  count: number;
  /** rest position xyz */
  position: Float32Array;
  /** boneA, boneB, weightB */
  skin: Float32Array;
  /** size, bright, tint, seed */
  pa: Float32Array;
  /** type, reveal, flow, phase */
  pb: Float32Array;
  /** indices of silhouette rim particles (FX emitters) */
  rimIdx: Uint32Array;
  fields: Field[];
  bounds: { x0: number; y0: number; x1: number; y1: number };
  area: number;
  rimLen: number;
}

/** top-most part whose field contains (x,y) (with tolerance), else the nearest part. */
export function partAt(def: CreatureDef, fields: Field[], x: number, y: number, tol = 0.02): number {
  let top = -1;
  let topLayer = -Infinity;
  let near = 0;
  let nearD = Infinity;
  for (let i = 0; i < fields.length; i++) {
    const d = fields[i].sample(x, y);
    if (d < tol && def.parts[i].layer > topLayer) {
      top = i;
      topLayer = def.parts[i].layer;
    }
    if (d < nearD) {
      nearD = d;
      near = i;
    }
  }
  return top >= 0 ? top : near;
}

export function skinPoint(def: CreatureDef, fields: Field[], x: number, y: number, part = -1): Skin {
  const pi = part >= 0 ? part : partAt(def, fields, x, y);
  return partWeights(def.parts[pi], x, y, { a: 0, b: 0, w: 0 });
}

class Buf {
  data: Float32Array;
  n = 0;
  constructor(
    readonly stride: number,
    cap = 4096,
  ) {
    this.data = new Float32Array(cap * stride);
  }
  push(a: number, b: number, c: number, d: number): void {
    if ((this.n + 1) * this.stride > this.data.length) {
      const nd = new Float32Array(this.data.length * 2);
      nd.set(this.data);
      this.data = nd;
    }
    const o = this.n * this.stride;
    this.data[o] = a;
    this.data[o + 1] = b;
    this.data[o + 2] = c;
    this.data[o + 3] = d;
    this.n++;
  }
}

/** choose k distinct indices out of n (partial Fisher-Yates); returns all when k >= n */
function pick(n: number, k: number, rnd: Rand): Uint32Array {
  const idx = new Uint32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  const m = Math.min(n, k);
  for (let i = 0; i < m; i++) {
    const j = i + Math.floor(rnd() * (n - i));
    const t = idx[i];
    idx[i] = idx[j];
    idx[j] = t;
  }
  return idx.subarray(0, m);
}

const cache = new Map<string, CreatureSample>();

export function isSampled(id: string, detail: 'full' | 'preview'): boolean {
  return cache.has(`${id}:${detail}`);
}

export function sampleCreature(def: CreatureDef, detail: 'full' | 'preview'): CreatureSample {
  const key = `${def.id}:${detail}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const s = doSample(def, detail);
  cache.set(key, s);
  return s;
}

export function buildFields(def: CreatureDef, res: number): Field[] {
  return def.parts.map((p) => new Field(p, res, 0.45));
}

function doSample(def: CreatureDef, detail: 'full' | 'preview'): CreatureSample {
  const full = detail === 'full';
  const total = full ? 11200 : 2400;
  const rnd = mulberry32(hashStr(def.id) ^ (full ? 0x9e3779b9 : 0x7f4a7c15));
  const seedN = hashStr(def.id) & 1023;
  const fields = buildFields(def, full ? 24 : 16);
  const parts = def.parts;
  const np = parts.length;

  // global bounds
  let bx0 = Infinity;
  let by0 = Infinity;
  let bx1 = -Infinity;
  let by1 = -Infinity;
  for (const p of parts) {
    bx0 = Math.min(bx0, p.x0);
    by0 = Math.min(by0, p.y0);
    bx1 = Math.max(bx1, p.x1);
    by1 = Math.max(by1, p.y1);
  }
  const pad = 0.4;
  bx0 -= pad;
  by0 -= pad;
  bx1 += pad;
  by1 += pad;
  const bw = bx1 - bx0;
  const bh = by1 - by0;

  // ---- candidate classification (jittered grid: uniform coverage with fewer candidates) ----
  const C0 = full ? 125000 : 42000;
  const cellSz = Math.sqrt((bw * bh) / C0);
  const gnx = Math.max(1, Math.ceil(bw / cellSz));
  const gny = Math.max(1, Math.ceil(bh / cellSz));
  const C = gnx * gny;
  const cw = bw / gnx;
  const ch = bh / gny;
  const band = 0.075;
  const rimC = new Buf(4); // x, y, part, internal
  const fillC = new Buf(4); // x, y, part, d
  const glowC = new Buf(4); // x, y, part, d
  const haloC = new Buf(4);
  const ds = new Float32Array(np);
  let inside = 0;
  let rimRaw = 0;
  // per part: parts drawn in front (occluders) / behind (for internal contours)
  const above: number[][] = parts.map((p, i) => parts.map((_, j) => j).filter((j) => j !== i && parts[j].layer > p.layer));
  const below: number[][] = parts.map((p, i) => parts.map((_, j) => j).filter((j) => j !== i && parts[j].layer < p.layer));
  const layer = parts.map((p) => p.layer);
  const sampleAt = (f: Field, x: number, y: number) => (x < f.x0 || y < f.y0 || x > f.x1 || y > f.y1 ? 9 : f.sample(x, y));
  // coarse union-distance lattice for an exact empty-space skip (the union SDF is 1-Lipschitz)
  const ug = 0.3;
  const unx = Math.ceil(bw / ug) + 1;
  const uny = Math.ceil(bh / ug) + 1;
  const U = new Float32Array(unx * uny);
  for (let j = 0; j < uny; j++) {
    for (let i = 0; i < unx; i++) {
      let m = Infinity;
      for (let k = 0; k < np; k++) m = Math.min(m, sampleAt(fields[k], bx0 + i * ug, by0 + j * ug));
      U[j * unx + i] = m;
    }
  }
  const skipD = 0.2 + band + ug * 0.75;

  for (let gj = 0; gj < gny; gj++) {
    for (let gi = 0; gi < gnx; gi++) {
      const x = bx0 + (gi + rnd()) * cw;
      const y = by0 + (gj + rnd()) * ch;
      if (U[Math.round((y - by0) / ug) * unx + Math.round((x - bx0) / ug)] > skipD) continue;
      let top = -1;
      let topL = -Infinity;
      let dmin = Infinity;
      let near = 0;
      for (let i = 0; i < np; i++) {
        const d = sampleAt(fields[i], x, y);
        ds[i] = d;
        if (d < 0 && layer[i] > topL) {
          topL = layer[i];
          top = i;
        }
        if (d < dmin) {
          dmin = d;
          near = i;
        }
      }
      if (top >= 0) {
        inside++;
        fillC.push(x, y, top, dmin);
        if (dmin < -0.12) haloC.push(x, y, top, dmin);
      } else if (dmin < 0.2) {
        glowC.push(x, y, near, dmin);
      }
      if (dmin > band) continue;
      // rim candidates for every part whose boundary passes here
      for (let i = 0; i < np; i++) {
        const d = ds[i];
        if (d > band || d < -band) continue;
        rimRaw++;
        // project onto a thin inner band (forward-difference gradient)
        const f = fields[i];
        let gx = sampleAt(f, x + 0.02, y) - d;
        let gy = sampleAt(f, x, y + 0.02) - d;
        const gl = Math.sqrt(gx * gx + gy * gy) || 1;
        gx /= gl;
        gy /= gl;
        const target = -Math.pow(rnd(), 2.2) * 0.04;
        const px = x - gx * (d - target);
        const py = y - gy * (d - target);
        let occ = false;
        for (const j of above[i]) {
          if (sampleAt(fields[j], px, py) < -0.012) {
            occ = true;
            break;
          }
        }
        if (occ) continue;
        let inner = 0;
        for (const j of below[i]) {
          if (sampleAt(fields[j], px, py) < -0.05) {
            inner = 1;
            break;
          }
        }
        rimC.push(px, py, i, inner);
      }
    }
  }
  const cellA = (bw * bh) / C;
  const area = inside * cellA;
  const rimLen = (rimC.n * cellA) / (2 * band);

  // ---- budgets ----
  let strokeLen = 0;
  for (const s of def.strokes) strokeLen += polyLen(s.pts) * s.density;
  const nStroke = def.strokes.length ? Math.round(total * Math.min(0.2, 0.05 + strokeLen * 0.004)) : 0;
  const nSparkle = Math.round(total * 0.025);
  const nHalo = Math.round(total * (full ? 0.025 : 0.04));
  const nGlow = Math.round(total * 0.05);
  const rest = total - nStroke - nSparkle - nHalo - nGlow;
  const nRim = Math.round(rest * (full ? 0.5 : 0.56));
  const nFill = rest - nRim;

  const out = {
    position: new Float32Array(total * 3),
    skin: new Float32Array(total * 3),
    pa: new Float32Array(total * 4),
    pb: new Float32Array(total * 4),
  };
  let n = 0;
  const rimList: number[] = [];
  const sk: Skin = { a: 0, b: 0, w: 0 };

  // constellation segments (rest) for reveal ordering
  const segs: number[] = [];
  for (let i = 0; i < def.lines.length; i += 2) {
    const a = def.stars[def.lines[i]];
    const b = def.stars[def.lines[i + 1]];
    segs.push(a.x, a.y, b.x, b.y);
  }
  const lineDist = (x: number, y: number) => {
    let best = Infinity;
    for (let i = 0; i < segs.length; i += 4) {
      const ax = segs[i];
      const ay = segs[i + 1];
      const ex = segs[i + 2] - ax;
      const ey = segs[i + 3] - ay;
      const ee = ex * ex + ey * ey || 1;
      let t = ((x - ax) * ex + (y - ay) * ey) / ee;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const dx = x - ax - ex * t;
      const dy = y - ay - ey * t;
      best = Math.min(best, dx * dx + dy * dy);
    }
    return Math.sqrt(best);
  };
  const revealOf = (x: number, y: number, early: number) => {
    const d = segs.length ? lineDist(x, y) : Math.hypot(x, y);
    return Math.min(1, Math.max(0, Math.min(1, d / 2.2) * 0.72 + rnd() * 0.22 + early));
  };

  const emit = (
    x: number,
    y: number,
    z: number,
    partI: number,
    size: number,
    bright: number,
    tint: number,
    type: PT,
    reveal: number,
    flow: number,
  ) => {
    partWeights(parts[partI], x, y, sk);
    const o3 = n * 3;
    out.position[o3] = x;
    out.position[o3 + 1] = y;
    out.position[o3 + 2] = z;
    out.skin[o3] = sk.a;
    out.skin[o3 + 1] = sk.b;
    out.skin[o3 + 2] = sk.w;
    const o4 = n * 4;
    out.pa[o4] = size;
    out.pa[o4 + 1] = bright;
    out.pa[o4 + 2] = tint;
    out.pa[o4 + 3] = rnd();
    out.pb[o4] = type;
    out.pb[o4 + 1] = reveal;
    out.pb[o4 + 2] = flow;
    out.pb[o4 + 3] = rnd();
    n++;
  };

  const rr = (a: number, b: number) => a + (b - a) * rnd();
  const zIn = (p: PartDef, d: number) => {
    const depth = Math.sqrt(Math.min(1, Math.max(0, -d) / 0.7));
    return p.z + (rnd() * 2 - 1) * p.thick * depth;
  };

  // ---- rim ----
  {
    const sel = pick(rimC.n, nRim, rnd);
    const spacing = rimLen / Math.max(1, sel.length);
    const base = clamp(spacing * (full ? 2.4 : 1.9), 0.038, full ? 0.1 : 0.085);
    for (let k = 0; k < sel.length; k++) {
      const o = sel[k] * 4;
      const x = rimC.data[o];
      const y = rimC.data[o + 1];
      const pi = rimC.data[o + 2];
      const isIn = rimC.data[o + 3] > 0;
      const p = parts[pi];
      const vary = 0.7 + 0.6 * fbm(x * 1.7 + 3, y * 1.7, seedN);
      const bright = p.rim * p.bright * (isIn ? p.inner : 1) * vary;
      const idx = n;
      const hot = !isIn && rnd() < 0.12;
      emit(
        x,
        y,
        p.z + (rnd() - 0.5) * 0.12,
        pi,
        base * (hot ? rr(1.1, 1.6) : rr(0.75, 1.3)),
        bright * (hot ? 1.5 : 1),
        (hot ? 1.6 : 1.1) + p.tint + rnd() * 0.35 + (isIn ? -0.1 : 0),
        PT.Rim,
        revealOf(x, y, -0.08),
        p.flow,
      );
      if (!isIn) rimList.push(idx);
    }
  }

  // ---- fill (nebula body) ----
  {
    // weight candidates by nebula noise & edge proximity, then pick
    const w = new Float32Array(fillC.n);
    let wsum = 0;
    for (let i = 0; i < fillC.n; i++) {
      const o = i * 4;
      const x = fillC.data[o];
      const y = fillC.data[o + 1];
      const p = parts[fillC.data[o + 2]];
      const d = fillC.data[o + 3];
      const edge = Math.exp(d / 0.45);
      const neb = fbm(x * 0.85, y * 0.85, seedN + 7, 3);
      const wisp = ridged(x * 1.3 + 5, y * 1.3, seedN + 3, 2);
      const v = p.fill * (0.18 + 1.2 * Math.max(0, neb - 0.32) + 0.7 * wisp * wisp) * (0.45 + 0.55 * edge);
      w[i] = v;
      wsum += v;
    }
    const meanW = wsum / Math.max(1, fillC.n);
    const prob = nFill / Math.max(1, wsum);
    const spacing = Math.sqrt(area / Math.max(1, nFill));
    const base = clamp(spacing * 1.05, 0.05, 0.16);
    let made = 0;
    const order = pick(fillC.n, fillC.n, rnd);
    for (let k = 0; k < order.length && made < nFill; k++) {
      const i = order[k];
      if (rnd() > w[i] * prob * 1.15) continue;
      const o = i * 4;
      const x = fillC.data[o];
      const y = fillC.data[o + 1];
      const pi = fillC.data[o + 2];
      const d = fillC.data[o + 3];
      const p = parts[pi];
      const edge = Math.exp(d / 0.4);
      const dens = w[i] / meanW;
      emit(
        x,
        y,
        zIn(p, d),
        pi,
        base * (rnd() < 0.08 ? rr(1.6, 2.4) : rr(0.55, 1.3)),
        p.bright * (0.45 + 0.55 * edge) * (0.7 + 0.3 * Math.min(2, dens)) * rr(0.5, 1.2),
        0.12 + 0.75 * edge + p.tint + (rnd() - 0.5) * 0.3,
        PT.Fill,
        revealOf(x, y, 0.05),
        p.flow,
      );
      made++;
    }
    // sparkles: bright pin-points inside the body
    const sel = pick(fillC.n, nSparkle, rnd);
    for (let k = 0; k < sel.length; k++) {
      const o = sel[k] * 4;
      const x = fillC.data[o];
      const y = fillC.data[o + 1];
      const pi = fillC.data[o + 2];
      const p = parts[pi];
      emit(x, y, zIn(p, fillC.data[o + 3]) + 0.05, pi, rr(0.07, 0.14), p.bright * rr(0.6, 1.3), 1.55 + rnd() * 0.4, PT.Sparkle, revealOf(x, y, 0.0), p.flow);
    }
  }

  // ---- outer glow band ----
  {
    const sel = pick(glowC.n, nGlow, rnd);
    for (let k = 0; k < sel.length; k++) {
      const o = sel[k] * 4;
      const x = glowC.data[o];
      const y = glowC.data[o + 1];
      const pi = glowC.data[o + 2];
      const d = glowC.data[o + 3];
      const p = parts[pi];
      emit(x, y, p.z + (rnd() - 0.5) * 0.3, pi, rr(0.07, 0.15), p.bright * Math.exp(-d / 0.07), 0.8 + p.tint, PT.Glow, revealOf(x, y, 0.12), p.flow);
    }
  }

  // ---- halo (large dim nebula puffs) ----
  {
    const sel = pick(haloC.n, nHalo, rnd);
    for (let k = 0; k < sel.length; k++) {
      const o = sel[k] * 4;
      const x = haloC.data[o];
      const y = haloC.data[o + 1];
      const pi = haloC.data[o + 2];
      const p = parts[pi];
      const d = haloC.data[o + 3];
      const sz = Math.min(rr(0.22, 0.46), 0.1 - d * 0.8);
      emit(x, y, p.z + (rnd() - 0.5) * 0.6, pi, sz, p.bright, 0.2 + p.tint * 0.5 + rnd() * 0.35, PT.Halo, revealOf(x, y, 0.15), p.flow);
    }
  }

  // ---- strokes ----
  if (nStroke > 0) {
    const lens = def.strokes.map((s) => polyLen(s.pts) * s.density);
    const sumL = lens.reduce((a, b) => a + b, 0) || 1;
    def.strokes.forEach((s, si) => {
      const cnt = Math.max(2, Math.round((nStroke * lens[si]) / sumL));
      const cum = cumLen(s.pts);
      const L = cum[cum.length - 1] || 1;
      const spacing = L / cnt;
      const base = clamp(spacing * 2.6, 0.04, 0.11);
      for (let k = 0; k < cnt && n < total; k++) {
        const u = (k + rnd()) / cnt;
        const [x0, y0, tx, ty] = atLen(s.pts, cum, u * L);
        const taper = 1 - s.taper * u;
        const off = (rnd() + rnd() + rnd() - 1.5) * 0.66 * s.w * taper;
        const x = x0 - ty * off;
        const y = y0 + tx * off;
        const pi = s.part >= 0 ? s.part : partAt(def, fields, x, y);
        const p = parts[pi];
        emit(x, y, p.z + s.z, pi, base * rr(0.75, 1.25) * (0.6 + 0.4 * taper), s.bright * p.bright * rr(0.7, 1.15), 1.0 + s.tint + rnd() * 0.25, PT.Stroke, revealOf(x, y, -0.12), s.flow || p.flow);
      }
    });
  }

  const count = n;
  return {
    count,
    position: out.position.subarray(0, count * 3),
    skin: out.skin.subarray(0, count * 3),
    pa: out.pa.subarray(0, count * 4),
    pb: out.pb.subarray(0, count * 4),
    rimIdx: Uint32Array.from(rimList),
    fields,
    bounds: { x0: bx0 + pad, y0: by0 + pad, x1: bx1 - pad, y1: by1 - pad },
    area,
    rimLen,
  };
}

function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

function polyLen(p: number[]): number {
  let L = 0;
  for (let i = 2; i < p.length; i += 2) L += Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
  return L;
}

function cumLen(p: number[]): number[] {
  const out = [0];
  for (let i = 2; i < p.length; i += 2) out.push(out[out.length - 1] + Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]));
  return out;
}

/** position + unit tangent at arc length s */
function atLen(p: number[], cum: number[], s: number): [number, number, number, number] {
  let i = 1;
  while (i < cum.length - 1 && cum[i] < s) i++;
  const l0 = cum[i - 1];
  const l1 = cum[i];
  const t = l1 > l0 ? (s - l0) / (l1 - l0) : 0;
  const ax = p[(i - 1) * 2];
  const ay = p[(i - 1) * 2 + 1];
  const bx = p[i * 2];
  const by = p[i * 2 + 1];
  const dx = bx - ax;
  const dy = by - ay;
  const l = Math.hypot(dx, dy) || 1;
  return [ax + dx * t, ay + dy * t, dx / l, dy / l];
}
