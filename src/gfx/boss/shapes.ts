// Shared authoring helpers for creature silhouettes (pure functions returning flat x,y point lists).
// Stable API: creature modules import these; keep signatures backward compatible.
import { deg } from './rig';
import { mulberry32 } from './rng';

/**
 * Shaggy outline (manes, fur ruffs, filth): walks an ellipse and alternates notch / shoulder / tip points so the
 * smoothed polygon forms flowing locks swept by (sweepX, sweepY). Angles in degrees (CCW, 0 = +x).
 * Locks are generated clockwise from a0 down to a1 (a1 < a0); the remaining arc stays smooth.
 * Use with `B.poly(bone, pts, 0.03, 3)`.
 */
export function shaggyOutline(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  rotDeg: number,
  a0: number,
  a1: number,
  locks: number,
  len: number,
  sweepX: number,
  sweepY: number,
  seed: number,
): number[] {
  const rnd = mulberry32(seed);
  const rot = rotDeg * deg;
  const pts: number[] = [];
  const pt = (aDeg: number, r: number, sx = 0, sy = 0) => {
    const t = aDeg * deg;
    const ex = Math.cos(t) * rx * r;
    const ey = Math.sin(t) * ry * r;
    pts.push(cx + ex * Math.cos(rot) - ey * Math.sin(rot) + sx, cy + ex * Math.sin(rot) + ey * Math.cos(rot) + sy);
  };
  const span = a0 - a1;
  const step = span / locks;
  for (let i = 0; i < locks; i++) {
    const a = a0 - i * step;
    const l = len * (0.7 + rnd() * 0.6);
    pt(a, 0.93);
    pt(a - step * 0.45, 1.0 + l * 0.35, sweepX * 0.3, sweepY * 0.3);
    pt(a - step * 0.8, 1.0 + l, sweepX * (0.8 + rnd() * 0.4), sweepY * (0.8 + rnd() * 0.4));
  }
  const rest = 360 - span;
  const n = Math.max(2, Math.round(rest / 25));
  for (let i = 0; i <= n; i++) pt(a1 - (rest * i) / n, 0.96);
  return pts;
}

/** points along a circular/elliptic arc (degrees, CCW) — handy for strokes */
export function arcPts(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 8): number[] {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const a = (a0 + ((a1 - a0) * i) / n) * deg;
    out.push(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry);
  }
  return out;
}

/** points along a cubic Bezier p0..p3 (each [x,y]) */
export function bezierPts(p0: number[], p1: number[], p2: number[], p3: number[], n = 10): number[] {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    out.push(a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]);
  }
  return out;
}

/** translate / scale a flat point list (scale about the origin, then offset) */
export function xform(pts: number[], dx: number, dy: number, sx = 1, sy = sx): number[] {
  const out: number[] = [];
  for (let i = 0; i < pts.length; i += 2) out.push(pts[i] * sx + dx, pts[i + 1] * sy + dy);
  return out;
}

/** mirror a flat point list around the vertical line x = ax (reverses order to keep winding) */
export function mirrorX(pts: number[], ax = 0): number[] {
  const out: number[] = [];
  for (let i = pts.length - 2; i >= 0; i -= 2) out.push(2 * ax - pts[i], pts[i + 1]);
  return out;
}
