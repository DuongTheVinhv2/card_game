// 2D signed distance primitives used to author creature silhouettes.
// Convention: negative inside, positive outside, units = creature space (~10 x 7 box).

export const enum PK {
  Circle = 0,
  Ellipse = 1,
  Capsule = 2,
  Poly = 3,
}

export interface Prim {
  kind: PK;
  /** bone index this primitive is attached to */
  bone: number;
  /** generic params (meaning depends on kind) */
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  g: number;
  h: number;
  /** polygon vertices (x,y interleaved) */
  v: Float64Array | null;
  /** bounding box */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function mk(kind: PK, bone: number): Prim {
  return { kind, bone, a: 0, b: 0, c: 0, d: 0, e: 0, f: 0, g: 0, h: 0, v: null, x0: 0, y0: 0, x1: 0, y1: 0 };
}

export function pCircle(bone: number, x: number, y: number, r: number): Prim {
  const p = mk(PK.Circle, bone);
  p.a = x;
  p.b = y;
  p.c = r;
  p.x0 = x - r;
  p.x1 = x + r;
  p.y0 = y - r;
  p.y1 = y + r;
  return p;
}

export function pEllipse(bone: number, x: number, y: number, rx: number, ry: number, angDeg = 0): Prim {
  const p = mk(PK.Ellipse, bone);
  const a = (angDeg * Math.PI) / 180;
  p.a = x;
  p.b = y;
  p.c = Math.max(rx, 1e-3);
  p.d = Math.max(ry, 1e-3);
  p.e = Math.cos(a);
  p.f = Math.sin(a);
  const R = Math.max(rx, ry);
  p.x0 = x - R;
  p.x1 = x + R;
  p.y0 = y - R;
  p.y1 = y + R;
  return p;
}

/** tapered capsule from (ax,ay) radius ra to (bx,by) radius rb */
export function pCapsule(bone: number, ax: number, ay: number, bx: number, by: number, ra: number, rb = ra): Prim {
  const p = mk(PK.Capsule, bone);
  p.a = ax;
  p.b = ay;
  p.c = bx;
  p.d = by;
  p.e = Math.max(ra, 1e-3);
  p.f = Math.max(rb, 1e-3);
  p.x0 = Math.min(ax - ra, bx - rb);
  p.x1 = Math.max(ax + ra, bx + rb);
  p.y0 = Math.min(ay - ra, by - rb);
  p.y1 = Math.max(ay + ra, by + rb);
  return p;
}

/** closed polygon (flat x,y list), optionally Catmull-Rom smoothed, inflated by r */
export function pPoly(bone: number, pts: number[], r = 0, smooth = 0): Prim {
  const p = mk(PK.Poly, bone);
  const v = smooth > 0 ? catmullClosed(pts, smooth) : pts.slice();
  p.v = new Float64Array(v);
  p.c = r;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < v.length; i += 2) {
    x0 = Math.min(x0, v[i]);
    x1 = Math.max(x1, v[i]);
    y0 = Math.min(y0, v[i + 1]);
    y1 = Math.max(y1, v[i + 1]);
  }
  p.x0 = x0 - r;
  p.y0 = y0 - r;
  p.x1 = x1 + r;
  p.y1 = y1 + r;
  return p;
}

/** Closed Catmull-Rom subdivision of a flat x,y list. */
export function catmullClosed(pts: number[], sub: number): number[] {
  const n = pts.length / 2;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const i0 = (i - 1 + n) % n;
    const i2 = (i + 1) % n;
    const i3 = (i + 2) % n;
    for (let s = 0; s < sub; s++) {
      const t = s / sub;
      out.push(
        cr(pts[i0 * 2], pts[i * 2], pts[i2 * 2], pts[i3 * 2], t),
        cr(pts[i0 * 2 + 1], pts[i * 2 + 1], pts[i2 * 2 + 1], pts[i3 * 2 + 1], t),
      );
    }
  }
  return out;
}

/** Open Catmull-Rom through a flat x,y list (endpoints duplicated). */
export function catmullOpen(pts: number[], sub: number): number[] {
  const n = pts.length / 2;
  if (n < 2) return pts.slice();
  const out: number[] = [];
  const P = (i: number, k: number) => pts[Math.max(0, Math.min(n - 1, i)) * 2 + k];
  for (let i = 0; i < n - 1; i++) {
    for (let s = 0; s < sub; s++) {
      const t = s / sub;
      out.push(cr(P(i - 1, 0), P(i, 0), P(i + 1, 0), P(i + 2, 0), t), cr(P(i - 1, 1), P(i, 1), P(i + 1, 1), P(i + 2, 1), t));
    }
  }
  out.push(pts[(n - 1) * 2], pts[(n - 1) * 2 + 1]);
  return out;
}

function cr(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

export function primDist(p: Prim, x: number, y: number): number {
  switch (p.kind) {
    case PK.Circle: {
      const dx = x - p.a;
      const dy = y - p.b;
      return Math.sqrt(dx * dx + dy * dy) - p.c;
    }
    case PK.Ellipse: {
      const dx = x - p.a;
      const dy = y - p.b;
      // rotate into ellipse frame
      const qx = dx * p.e + dy * p.f;
      const qy = -dx * p.f + dy * p.e;
      const k0 = Math.sqrt((qx / p.c) * (qx / p.c) + (qy / p.d) * (qy / p.d));
      const k1 = Math.sqrt((qx / (p.c * p.c)) * (qx / (p.c * p.c)) + (qy / (p.d * p.d)) * (qy / (p.d * p.d)));
      if (k1 < 1e-9) return -Math.min(p.c, p.d);
      return (k0 * (k0 - 1)) / k1;
    }
    case PK.Capsule:
      return unevenCapsule(x, y, p.a, p.b, p.c, p.d, p.e, p.f);
    case PK.Poly:
    default:
      return polyDist(p.v!, x, y) - p.c;
  }
}

function unevenCapsule(px: number, py: number, ax: number, ay: number, bx: number, by: number, ra: number, rb: number): number {
  px -= ax;
  py -= ay;
  bx -= ax;
  by -= ay;
  const h = bx * bx + by * by;
  const b = ra - rb;
  if (h <= b * b + 1e-9) {
    // degenerate: one circle swallows the other
    const da = Math.sqrt(px * px + py * py) - ra;
    const db = Math.sqrt((px - bx) * (px - bx) + (py - by) * (py - by)) - rb;
    return Math.min(da, db);
  }
  let qx = (px * by - py * bx) / h;
  const qy = (px * bx + py * by) / h;
  qx = Math.abs(qx);
  const cx = Math.sqrt(h - b * b);
  const cy = b;
  const k = cx * qy - cy * qx;
  const m = cx * qx + cy * qy;
  const n = qx * qx + qy * qy;
  if (k < 0) return Math.sqrt(h * n) - ra;
  if (k > cx) return Math.sqrt(h * (n + 1 - 2 * qy)) - rb;
  return m - ra;
}

function polyDist(v: Float64Array, px: number, py: number): number {
  const n = v.length >> 1;
  let d = (px - v[0]) * (px - v[0]) + (py - v[1]) * (py - v[1]);
  let s = 1;
  for (let i = 0, j = n - 1; i < n; j = i, i++) {
    const vix = v[i * 2];
    const viy = v[i * 2 + 1];
    const vjx = v[j * 2];
    const vjy = v[j * 2 + 1];
    const ex = vjx - vix;
    const ey = vjy - viy;
    const wx = px - vix;
    const wy = py - viy;
    const ee = ex * ex + ey * ey;
    let t = ee > 0 ? (wx * ex + wy * ey) / ee : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const bx = wx - ex * t;
    const by = wy - ey * t;
    const dd = bx * bx + by * by;
    if (dd < d) d = dd;
    const c1 = py >= viy;
    const c2 = py < vjy;
    const c3 = ex * wy > ey * wx;
    if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) s = -s;
  }
  return s * Math.sqrt(d);
}

/** polynomial smooth min */
export function smin(a: number, b: number, k: number): number {
  if (k <= 0) return a < b ? a : b;
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/** Lower bound of the distance from (x,y) to a box (0 inside). */
export function boxDist(x: number, y: number, x0: number, y0: number, x1: number, y1: number): number {
  const dx = Math.max(x0 - x, 0, x - x1);
  const dy = Math.max(y0 - y, 0, y - y1);
  return Math.sqrt(dx * dx + dy * dy);
}
