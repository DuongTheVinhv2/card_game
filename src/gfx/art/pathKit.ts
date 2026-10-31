// Tiny vector-geometry kit used to author the icon set.
// Shapes are lists of closed sub-paths tagged solid / hole. On serialisation every
// solid is oriented clockwise and every hole counter-clockwise, so the resulting
// path data renders correctly with the default NONZERO fill rule (SVG and canvas).

export type Pt = [number, number];
export interface Seg { c1?: Pt; c2?: Pt; p: Pt }

const KAPPA = 0.5522847498;
const D2R = Math.PI / 180;

const fmt = (n: number): string => {
  const v = Math.round(n * 100) / 100;
  return Object.is(v, -0) ? '0' : String(v);
};

function cubicAt(a: Pt, b: Pt, c: Pt, d: Pt, t: number): Pt {
  const u = 1 - t;
  const w0 = u * u * u, w1 = 3 * u * u * t, w2 = 3 * u * t * t, w3 = t * t * t;
  return [w0 * a[0] + w1 * b[0] + w2 * c[0] + w3 * d[0], w0 * a[1] + w1 * b[1] + w2 * c[1] + w3 * d[1]];
}

export class Sub {
  constructor(public start: Pt, public segs: Seg[] = []) {}

  map(f: (p: Pt) => Pt): Sub {
    return new Sub(
      f(this.start),
      this.segs.map((s) => (s.c1 ? { c1: f(s.c1), c2: f(s.c2!), p: f(s.p) } : { p: f(s.p) })),
    );
  }

  reversed(): Sub {
    const pts: Pt[] = [this.start, ...this.segs.map((s) => s.p)];
    const n = this.segs.length;
    const segs: Seg[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const s = this.segs[i];
      const to = pts[i];
      segs.push(s.c1 ? { c1: s.c2!, c2: s.c1, p: to } : { p: to });
    }
    return new Sub(pts[n], segs);
  }

  flatten(steps = 10): Pt[] {
    const out: Pt[] = [this.start];
    let cur = this.start;
    for (const s of this.segs) {
      if (s.c1) for (let i = 1; i <= steps; i++) out.push(cubicAt(cur, s.c1, s.c2!, s.p, i / steps));
      else out.push(s.p);
      cur = s.p;
    }
    return out;
  }

  /** signed area; > 0 means clockwise on screen (y down) */
  area(): number {
    const p = this.flatten(8);
    let a = 0;
    for (let i = 0, n = p.length; i < n; i++) {
      const q = p[i], r = p[(i + 1) % n];
      a += q[0] * r[1] - r[0] * q[1];
    }
    return a / 2;
  }

  d(): string {
    let s = `M${fmt(this.start[0])} ${fmt(this.start[1])}`;
    for (const g of this.segs) {
      if (g.c1) s += `C${fmt(g.c1[0])} ${fmt(g.c1[1])} ${fmt(g.c2![0])} ${fmt(g.c2![1])} ${fmt(g.p[0])} ${fmt(g.p[1])}`;
      else s += `L${fmt(g.p[0])} ${fmt(g.p[1])}`;
    }
    return s + 'Z';
  }
}

export interface Part { sub: Sub; solid: boolean }
export type Shape = Part[];

// ───────────────────────────── primitives ─────────────────────────────

export function polySub(pts: Pt[]): Sub {
  return new Sub(pts[0], pts.slice(1).map((p) => ({ p })));
}
export const poly = (pts: Pt[]): Shape => [{ sub: polySub(pts), solid: true }];

export function circleSub(cx: number, cy: number, r: number): Sub {
  const k = KAPPA * r;
  return new Sub([cx + r, cy], [
    { c1: [cx + r, cy + k], c2: [cx + k, cy + r], p: [cx, cy + r] },
    { c1: [cx - k, cy + r], c2: [cx - r, cy + k], p: [cx - r, cy] },
    { c1: [cx - r, cy - k], c2: [cx - k, cy - r], p: [cx, cy - r] },
    { c1: [cx + k, cy - r], c2: [cx + r, cy - k], p: [cx + r, cy] },
  ]);
}
export const circle = (cx: number, cy: number, r: number): Shape => [{ sub: circleSub(cx, cy, r), solid: true }];

export function ellipse(cx: number, cy: number, rx: number, ry: number, rotDeg = 0): Shape {
  const s = circleSub(0, 0, 1).map(([x, y]) => [x * rx, y * ry]);
  return rot([{ sub: s.map(([x, y]) => [x + cx, y + cy]), solid: true }], rotDeg, cx, cy);
}

/** ring = disk with a concentric hole */
export const ring = (cx: number, cy: number, ro: number, ri: number): Shape => [
  { sub: circleSub(cx, cy, ro), solid: true },
  { sub: circleSub(cx, cy, ri), solid: false },
];

export function rrectSub(x: number, y: number, w: number, h: number, r: number): Sub {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (r === 0) return polySub([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
  const k = KAPPA * r;
  const x2 = x + w, y2 = y + h;
  return new Sub([x + r, y], [
    { p: [x2 - r, y] },
    { c1: [x2 - r + k, y], c2: [x2, y + r - k], p: [x2, y + r] },
    { p: [x2, y2 - r] },
    { c1: [x2, y2 - r + k], c2: [x2 - r + k, y2], p: [x2 - r, y2] },
    { p: [x + r, y2] },
    { c1: [x + r - k, y2], c2: [x, y2 - r + k], p: [x, y2 - r] },
    { p: [x, y + r] },
    { c1: [x, y + r - k], c2: [x + r - k, y], p: [x + r, y] },
  ]);
}
export const rrect = (x: number, y: number, w: number, h: number, r = 0): Shape => [{ sub: rrectSub(x, y, w, h, r), solid: true }];
export const rect = (x: number, y: number, w: number, h: number): Shape => rrect(x, y, w, h, 0);

/** cubic segments approximating an elliptical arc; angles in degrees, 0 = east, 90 = south */
export function arcSegs(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number): Seg[] {
  const segs: Seg[] = [];
  const total = a1 - a0;
  const n = Math.max(1, Math.ceil(Math.abs(total) / 90));
  const step = (total / n) * D2R;
  let t1 = a0 * D2R;
  for (let i = 0; i < n; i++) {
    const t2 = t1 + step;
    const k = (4 / 3) * Math.tan((t2 - t1) / 4);
    const c1: Pt = [cx + rx * (Math.cos(t1) - k * Math.sin(t1)), cy + ry * (Math.sin(t1) + k * Math.cos(t1))];
    const c2: Pt = [cx + rx * (Math.cos(t2) + k * Math.sin(t2)), cy + ry * (Math.sin(t2) - k * Math.cos(t2))];
    segs.push({ c1, c2, p: [cx + rx * Math.cos(t2), cy + ry * Math.sin(t2)] });
    t1 = t2;
  }
  return segs;
}
export const polar = (cx: number, cy: number, r: number, deg: number): Pt => [cx + r * Math.cos(deg * D2R), cy + r * Math.sin(deg * D2R)];

/** annular sector (thick arc) between radii ri..ro from a0 to a1 degrees */
export function arcBand(cx: number, cy: number, ro: number, ri: number, a0: number, a1: number): Shape {
  const segs: Seg[] = [...arcSegs(cx, cy, ro, ro, a0, a1), { p: polar(cx, cy, ri, a1) }, ...arcSegs(cx, cy, ri, ri, a1, a0)];
  return [{ sub: new Sub(polar(cx, cy, ro, a0), segs), solid: true }];
}

/** pie slice */
export function pie(cx: number, cy: number, r: number, a0: number, a1: number): Shape {
  return [{ sub: new Sub([cx, cy], [{ p: polar(cx, cy, r, a0) }, ...arcSegs(cx, cy, r, r, a0, a1)]), solid: true }];
}

export function star(cx: number, cy: number, ro: number, ri: number, n: number, rotDeg = -90): Shape {
  const pts: Pt[] = [];
  for (let i = 0; i < n * 2; i++) pts.push(polar(cx, cy, i % 2 ? ri : ro, rotDeg + (i * 180) / n));
  return poly(pts);
}

export function ngon(cx: number, cy: number, r: number, n: number, rotDeg = -90): Shape {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) pts.push(polar(cx, cy, r, rotDeg + (i * 360) / n));
  return poly(pts);
}

/** pointed leaf / lens from base (x1,y1) to tip (x2,y2) with max width w; bulge shifts the widest point (0..1) */
export function leaf(x1: number, y1: number, x2: number, y2: number, w: number, bulge = 0.45): Shape {
  const dx = x2 - x1, dy = y2 - y1;
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const h = w * 0.68;
  const a = bulge * 0.55, b = Math.min(0.95, bulge + 0.4);
  const P = (t: number, s: number): Pt => [x1 + ux * L * t + nx * s, y1 + uy * L * t + ny * s];
  return [{
    sub: new Sub([x1, y1], [
      { c1: P(a, h), c2: P(b, h), p: [x2, y2] },
      { c1: P(b, -h), c2: P(a, -h), p: [x1, y1] },
    ]),
    solid: true,
  }];
}

// ───────────────────────────── svg path parsing ─────────────────────────────

function arcToSegs(p0: Pt, rx: number, ry: number, phiDeg: number, large: boolean, sweep: boolean, p1: Pt): Seg[] {
  if (rx === 0 || ry === 0) return [{ p: p1 }];
  const phi = phiDeg * D2R;
  const cos = Math.cos(phi), sin = Math.sin(phi);
  const dx = (p0[0] - p1[0]) / 2, dy = (p0[1] - p1[1]) / 2;
  const x1p = cos * dx + sin * dy, y1p = -sin * dx + cos * dy;
  rx = Math.abs(rx); ry = Math.abs(ry);
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s; }
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let co = Math.sqrt(Math.max(0, num / den));
  if (large === sweep) co = -co;
  const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (p0[0] + p1[0]) / 2;
  const cy = sin * cxp + cos * cyp + (p0[1] + p1[1]) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;
  const segs = arcSegs(0, 0, rx, ry, t1 / D2R, (t1 + dt) / D2R);
  const tf = (p: Pt): Pt => [cos * p[0] - sin * p[1] + cx, sin * p[0] + cos * p[1] + cy];
  const out = segs.map((s) => ({ c1: tf(s.c1!), c2: tf(s.c2!), p: tf(s.p) }));
  out[out.length - 1].p = p1;
  return out;
}

/** Parse SVG path data (M L H V C S Q T A Z, abs + rel) into sub-paths (all closed). */
export function parseSubs(d: string): Sub[] {
  const tok = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [];
  const subs: Sub[] = [];
  let i = 0, cmd = '';
  let cur: Pt = [0, 0], start: Pt = [0, 0];
  let sub: Sub | null = null;
  let lastC2: Pt | null = null, lastQ: Pt | null = null;
  const num = () => parseFloat(tok[i++]);
  const isCmd = (t: string) => /^[a-zA-Z]$/.test(t);
  const ensure = () => { if (!sub) { sub = new Sub([cur[0], cur[1]]); subs.push(sub); } return sub; };
  while (i < tok.length) {
    if (isCmd(tok[i])) cmd = tok[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? cur[0] : 0, oy = rel ? cur[1] : 0;
    let nextC2: Pt | null = null, nextQ: Pt | null = null;
    switch (C) {
      case 'M': {
        const p: Pt = [num() + ox, num() + oy];
        sub = new Sub(p); subs.push(sub);
        cur = p; start = p;
        cmd = rel ? 'l' : 'L';
        break;
      }
      case 'L': { const p: Pt = [num() + ox, num() + oy]; ensure().segs.push({ p }); cur = p; break; }
      case 'H': { const p: Pt = [num() + (rel ? cur[0] : 0), cur[1]]; ensure().segs.push({ p }); cur = p; break; }
      case 'V': { const p: Pt = [cur[0], num() + (rel ? cur[1] : 0)]; ensure().segs.push({ p }); cur = p; break; }
      case 'C': {
        const c1: Pt = [num() + ox, num() + oy], c2: Pt = [num() + ox, num() + oy], p: Pt = [num() + ox, num() + oy];
        ensure().segs.push({ c1, c2, p }); cur = p; nextC2 = c2; break;
      }
      case 'S': {
        const c1: Pt = lastC2 ? [2 * cur[0] - lastC2[0], 2 * cur[1] - lastC2[1]] : [cur[0], cur[1]];
        const c2: Pt = [num() + ox, num() + oy], p: Pt = [num() + ox, num() + oy];
        ensure().segs.push({ c1, c2, p }); cur = p; nextC2 = c2; break;
      }
      case 'Q': {
        const q: Pt = [num() + ox, num() + oy], p: Pt = [num() + ox, num() + oy];
        const c1: Pt = [cur[0] + (2 / 3) * (q[0] - cur[0]), cur[1] + (2 / 3) * (q[1] - cur[1])];
        const c2: Pt = [p[0] + (2 / 3) * (q[0] - p[0]), p[1] + (2 / 3) * (q[1] - p[1])];
        ensure().segs.push({ c1, c2, p }); cur = p; nextQ = q; break;
      }
      case 'T': {
        const q: Pt = lastQ ? [2 * cur[0] - lastQ[0], 2 * cur[1] - lastQ[1]] : [cur[0], cur[1]];
        const p: Pt = [num() + ox, num() + oy];
        const c1: Pt = [cur[0] + (2 / 3) * (q[0] - cur[0]), cur[1] + (2 / 3) * (q[1] - cur[1])];
        const c2: Pt = [p[0] + (2 / 3) * (q[0] - p[0]), p[1] + (2 / 3) * (q[1] - p[1])];
        ensure().segs.push({ c1, c2, p }); cur = p; nextQ = q; break;
      }
      case 'A': {
        const rx = num(), ry = num(), phi = num(), la = num() !== 0, sw = num() !== 0;
        const p: Pt = [num() + ox, num() + oy];
        ensure().segs.push(...arcToSegs(cur, rx, ry, phi, la, sw, p)); cur = p; break;
      }
      case 'Z': {
        if (sub) {
          const last = sub.segs.length ? sub.segs[sub.segs.length - 1].p : sub.start;
          if (Math.hypot(last[0] - start[0], last[1] - start[1]) > 1e-6) sub.segs.push({ p: [start[0], start[1]] });
        }
        cur = start; sub = null; break;
      }
      default:
        throw new Error(`pathKit: unsupported command ${cmd}`);
    }
    lastC2 = nextC2; lastQ = nextQ;
  }
  return subs;
}

/** every sub-path of `d` as a solid */
export const path = (d: string): Shape => parseSubs(d).map((sub) => ({ sub, solid: true }));

/** sample the centre-line of a path into a polyline (first sub-path only unless all = true) */
export function sample(d: string, steps = 14): Pt[] {
  const subs = parseSubs(d);
  const out: Pt[] = [];
  const s = subs[0];
  out.push(s.start);
  let cur = s.start;
  for (const g of s.segs) {
    if (g.c1) for (let k = 1; k <= steps; k++) out.push(cubicAt(cur, g.c1, g.c2!, g.p, k / steps));
    else out.push(g.p);
    cur = g.p;
  }
  return out;
}

export function arcPts(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 24): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (a0 + ((a1 - a0) * i) / n) * D2R;
    out.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return out;
}

// ───────────────────────────── strokes ─────────────────────────────

export type Cap = 'round' | 'butt' | 'square' | 'point';
export type Width = number | ((t: number) => number);

function dedupe(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    const l = out[out.length - 1];
    if (!l || Math.hypot(p[0] - l[0], p[1] - l[1]) > 1e-4) out.push(p);
  }
  return out;
}

/** Offset a smooth polyline into a filled outline. Width may vary along the stroke (t = 0..1 by length). */
export function stroke(ptsIn: Pt[], width: Width, cap: Cap = 'round', capEnd?: Cap): Shape {
  const pts = dedupe(ptsIn);
  const n = pts.length;
  if (n < 2) return [];
  const capE = capEnd ?? cap;
  const L: number[] = [0];
  for (let i = 1; i < n; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const tot = L[n - 1] || 1;
  const W = (i: number) => (typeof width === 'number' ? width : width(L[i] / tot));
  const left: Pt[] = [], right: Pt[] = [];
  const tans: Pt[] = [];
  for (let i = 0; i < n; i++) {
    let tin: Pt | null = null, tout: Pt | null = null;
    if (i > 0) { const dx = pts[i][0] - pts[i - 1][0], dy = pts[i][1] - pts[i - 1][1], l = Math.hypot(dx, dy); tin = [dx / l, dy / l]; }
    if (i < n - 1) { const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], l = Math.hypot(dx, dy); tout = [dx / l, dy / l]; }
    let t: Pt;
    let sc = 1;
    if (tin && tout) {
      const sx = tin[0] + tout[0], sy = tin[1] + tout[1], sl = Math.hypot(sx, sy);
      t = sl < 1e-6 ? tin : [sx / sl, sy / sl];
      const c = t[0] * tin[0] + t[1] * tin[1];
      sc = 1 / Math.max(c, 0.3);
    } else t = (tin || tout)!;
    tans.push(t);
    const nx = -t[1], ny = t[0];
    const h = (W(i) / 2) * sc;
    left.push([pts[i][0] + nx * h, pts[i][1] + ny * h]);
    right.push([pts[i][0] - nx * h, pts[i][1] - ny * h]);
  }
  const capPts = (p: Pt, t: Pt, h: number, kind: Cap, end: boolean): Pt[] => {
    const nx = -t[1], ny = t[0];
    const out: Pt[] = [];
    if (kind === 'round') {
      for (let k = 1; k < 12; k++) {
        const f = (k / 12) * Math.PI;
        const c = Math.cos(f), s = Math.sin(f);
        if (end) out.push([p[0] + (nx * c + t[0] * s) * h, p[1] + (ny * c + t[1] * s) * h]);
        else out.push([p[0] + (-nx * c - t[0] * s) * h, p[1] + (-ny * c - t[1] * s) * h]);
      }
    } else if (kind === 'square') {
      if (end) {
        out.push([p[0] + nx * h + t[0] * h, p[1] + ny * h + t[1] * h]);
        out.push([p[0] - nx * h + t[0] * h, p[1] - ny * h + t[1] * h]);
      } else {
        out.push([p[0] - nx * h - t[0] * h, p[1] - ny * h - t[1] * h]);
        out.push([p[0] + nx * h - t[0] * h, p[1] + ny * h - t[1] * h]);
      }
    } else if (kind === 'point') {
      out.push(end ? [p[0] + t[0] * h * 1.6, p[1] + t[1] * h * 1.6] : [p[0] - t[0] * h * 1.6, p[1] - t[1] * h * 1.6]);
    }
    return out;
  };
  const outline: Pt[] = [
    ...left,
    ...capPts(pts[n - 1], tans[n - 1], W(n - 1) / 2, capE, true),
    ...right.reverse(),
    ...capPts(pts[0], tans[0], W(0) / 2, cap, false),
  ];
  return poly(outline);
}

/** closed stroke (band) along a closed polyline: outer solid + inner hole */
export function strokeClosed(ptsIn: Pt[], width: number): Shape {
  let pts = dedupe(ptsIn);
  if (Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-4) pts = pts.slice(0, -1);
  const n = pts.length;
  const a: Pt[] = [], b: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    let dx = p1[0] - p0[0], dy = p1[1] - p0[1], l = Math.hypot(dx, dy);
    const tin: Pt = [dx / l, dy / l];
    dx = p2[0] - p1[0]; dy = p2[1] - p1[1]; l = Math.hypot(dx, dy);
    const tout: Pt = [dx / l, dy / l];
    const sx = tin[0] + tout[0], sy = tin[1] + tout[1], sl = Math.hypot(sx, sy) || 1;
    const t: Pt = [sx / sl, sy / sl];
    const sc = 1 / Math.max(t[0] * tin[0] + t[1] * tin[1], 0.3);
    const h = (width / 2) * sc;
    a.push([p1[0] - t[1] * h, p1[1] + t[0] * h]);
    b.push([p1[0] + t[1] * h, p1[1] - t[0] * h]);
  }
  const A = polySub(a), B = polySub(b);
  const outerIsA = Math.abs(A.area()) > Math.abs(B.area());
  return [{ sub: outerIsA ? A : B, solid: true }, { sub: outerIsA ? B : A, solid: false }];
}

/** stroke an svg centre-line path */
export const strokeD = (d: string, width: Width, cap: Cap = 'round', capEnd?: Cap, steps = 16): Shape =>
  stroke(sample(d, steps), width, cap, capEnd);

/** polyline with sharp corners: union of round-capped segments (robust for any angle) */
export function lines(pts: Pt[], width: number, cap: Cap = 'round'): Shape {
  const out: Shape = [];
  for (let i = 0; i < pts.length - 1; i++) out.push(...stroke([pts[i], pts[i + 1]], width, cap));
  return out;
}

/** straight segment */
export const seg = (x1: number, y1: number, x2: number, y2: number, width: number, cap: Cap = 'round', capEnd?: Cap): Shape =>
  stroke([[x1, y1], [x2, y2]], width, cap, capEnd);

// ───────────────────────────── transforms ─────────────────────────────

export function mapShape(s: Shape, f: (p: Pt) => Pt): Shape {
  return s.map((p) => ({ sub: p.sub.map(f), solid: p.solid }));
}
export function rot(s: Shape, deg: number, cx = 50, cy = 50): Shape {
  if (!deg) return s;
  const c = Math.cos(deg * D2R), sn = Math.sin(deg * D2R);
  return mapShape(s, ([x, y]) => [cx + (x - cx) * c - (y - cy) * sn, cy + (x - cx) * sn + (y - cy) * c]);
}
export const move = (s: Shape, dx: number, dy: number): Shape => mapShape(s, ([x, y]) => [x + dx, y + dy]);
export const scale = (s: Shape, sx: number, sy = sx, cx = 50, cy = 50): Shape =>
  mapShape(s, ([x, y]) => [cx + (x - cx) * sx, cy + (y - cy) * sy]);
export const mirrorX = (s: Shape, ax = 50): Shape => mapShape(s, ([x, y]) => [2 * ax - x, y]);
export const mirrorY = (s: Shape, ay = 50): Shape => mapShape(s, ([x, y]) => [x, 2 * ay - y]);
/** shape plus its mirror image around x = ax */
export const sym = (s: Shape, ax = 50): Shape => [...s, ...mirrorX(s, ax)];
export const invert = (s: Shape): Shape => s.map((p) => ({ sub: p.sub, solid: !p.solid }));
export const join = (...s: Shape[]): Shape => s.flat();

// ───────────────────────────── clipping ─────────────────────────────

/** Sutherland–Hodgman clip of every part of `s` against a CONVEX clip shape (first sub-path used). */
export function clipConvex(s: Shape, clip: Shape): Shape {
  let cp = clip[0].sub.flatten(8);
  if (clip[0].sub.area() < 0) cp = cp.slice().reverse();
  // clockwise on screen; inside = right-hand side test with y-down => cross >= 0
  const inside = (p: Pt, a: Pt, b: Pt) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0;
  const inter = (p: Pt, q: Pt, a: Pt, b: Pt): Pt => {
    const x1 = p[0], y1 = p[1], x2 = q[0], y2 = q[1], x3 = a[0], y3 = a[1], x4 = b[0], y4 = b[1];
    const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(den) < 1e-9) return q;
    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
    return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
  };
  const out: Shape = [];
  for (const part of s) {
    let poly = part.sub.flatten(10);
    for (let i = 0; i < cp.length && poly.length; i++) {
      const a = cp[i], b = cp[(i + 1) % cp.length];
      const input = poly;
      poly = [];
      for (let j = 0; j < input.length; j++) {
        const P = input[j], Q = input[(j + 1) % input.length];
        const pin = inside(P, a, b), qin = inside(Q, a, b);
        if (pin) {
          poly.push(P);
          if (!qin) poly.push(inter(P, Q, a, b));
        } else if (qin) poly.push(inter(P, Q, a, b));
      }
    }
    if (poly.length >= 3) out.push({ sub: polySub(poly), solid: part.solid });
  }
  return out;
}

// ───────────────────────────── assembly ─────────────────────────────

export class IconB {
  parts: Part[] = [];
  /** add shapes (respecting their own solid/hole roles) */
  add(...shapes: Shape[]): this {
    for (const s of shapes) this.parts.push(...s);
    return this;
  }
  /** cut shapes out (roles inverted) */
  cut(...shapes: Shape[]): this {
    for (const s of shapes) this.parts.push(...invert(s));
    return this;
  }
  /** add a shape n times (to survive n overlapping cuts) */
  addN(n: number, ...shapes: Shape[]): this {
    for (let i = 0; i < n; i++) this.add(...shapes);
    return this;
  }
  cutN(n: number, ...shapes: Shape[]): this {
    for (let i = 0; i < n; i++) this.cut(...shapes);
    return this;
  }
  d(): string {
    return this.parts
      .map((p) => {
        const a = p.sub.area();
        const sub = (p.solid ? a < 0 : a > 0) ? p.sub.reversed() : p.sub;
        return sub.d();
      })
      .join('');
  }
}
