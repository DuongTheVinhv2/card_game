import { Builder, Flow, P, deg, type AnimCtx, type CreatureDef, type Pose } from '../rig';
import type { Prim } from '../sdf';
import { mulberry32 } from '../rng';
import type { CreatureModule } from './index';

/**
 * VIII. The Mares of Diomedes — two man-eating horses rearing on their hind legs, facing left, the far one
 * offset behind the near one. Manes and tails of living flame, jaws open on bared teeth, forehooves pawing.
 * Stars after Pegasus (Enif at the muzzle, the Great Square on the barrel) and Equuleus for the far mare.
 */

type V2 = [number, number];
/** rest-pose transform (forward kinematics while authoring): maps base-pose coordinates to posed ones */
interface Xf {
  f: (x: number, y: number) => V2;
  a: number;
}
const ID: Xf = { f: (x, y) => [x, y], a: 0 };
/** child transform: rotate about (px,py) (base-pose coords) by angDeg, then apply the parent */
function jt(par: Xf, px: number, py: number, angDeg: number): Xf {
  const c = Math.cos(angDeg * deg);
  const s = Math.sin(angDeg * deg);
  return {
    f: (x, y) => {
      const dx = x - px;
      const dy = y - py;
      return par.f(px + dx * c - dy * s, py + dx * s + dy * c);
    },
    a: par.a + angDeg,
  };
}

/** world placement (translate + uniform scale) composed with a rest-pose transform */
class Pen {
  constructor(
    readonly B: Builder,
    readonly ox: number,
    readonly oy: number,
    readonly s: number,
    readonly xf: Xf = ID,
  ) {}
  via(xf: Xf): Pen {
    return new Pen(this.B, this.ox, this.oy, this.s, xf);
  }
  W(x: number, y: number): V2 {
    const [u, v] = this.xf.f(x, y);
    return [this.ox + u * this.s, this.oy + v * this.s];
  }
  pts(p: number[]): number[] {
    const o: number[] = [];
    for (let i = 0; i < p.length; i += 2) o.push(...this.W(p[i], p[i + 1]));
    return o;
  }
  bone(name: string, parent: number, x: number, y: number): number {
    const [u, v] = this.W(x, y);
    return this.B.bone(name, parent, u, v);
  }
  cap(b: number, ax: number, ay: number, bx: number, by: number, ra: number, rb = ra): Prim {
    const [x0, y0] = this.W(ax, ay);
    const [x1, y1] = this.W(bx, by);
    return this.B.cap(b, x0, y0, x1, y1, ra * this.s, rb * this.s);
  }
  ell(b: number, x: number, y: number, rx: number, ry: number, a = 0): Prim {
    const [u, v] = this.W(x, y);
    return this.B.ell(b, u, v, rx * this.s, ry * this.s, a + this.xf.a);
  }
  poly(b: number, p: number[], r = 0, smooth = 0): Prim {
    return this.B.poly(b, this.pts(p), r * this.s, smooth);
  }
  tube(b: number | number[], p: number[], radii: number[]): Prim[] {
    return this.B.tube(b, this.pts(p), radii.map((r) => r * this.s));
  }
  stroke(p: number[], o: { w?: number; bright?: number; tint?: number; part?: string; taper?: number; flow?: Flow; smooth?: number; z?: number }): void {
    this.B.stroke(this.pts(p), { ...o, w: (o.w ?? 0.025) * this.s });
  }
}

/**
 * Flame tongues rising from a root line (flat x,y, ordered), licking toward `dir` with S-curved, tapering tongues.
 * Returns a closed outline: tongues along the root, then back along the root pushed by `inset` (hidden side).
 * `sway` bends every tongue the same way (wind-swept), `curl` adds random S-bends.
 */
function flameOutline(root: number[], dir: V2, lens: number[], inset: V2, seed: number, curl = 0.35, sway = 0.25): number[] {
  const rnd = mulberry32(seed);
  const n = root.length / 2;
  const dl = Math.hypot(dir[0], dir[1]) || 1;
  const dx = dir[0] / dl;
  const dy = dir[1] / dl;
  const px = -dy;
  const py = dx;
  const out: number[] = [];
  const U = [0.22, 0.45, 0.68, 0.87];
  for (let i = 0; i < n - 1; i++) {
    const ax = root[i * 2];
    const ay = root[i * 2 + 1];
    const bx = root[i * 2 + 2];
    const by = root[i * 2 + 3];
    const ex = (bx - ax) / 2;
    const ey = (by - ay) / 2;
    const mx = ax + ex;
    const my = ay + ey;
    const L = lens[i % lens.length] * (0.85 + rnd() * 0.3);
    const bend = sway + (rnd() * 2 - 1) * curl;
    const c = (u: number): V2 => {
      const side = L * bend * (0.55 * Math.sin(Math.PI * 1.3 * u) + 0.45 * u * u);
      return [mx + dx * L * u + px * side, my + dy * L * u + py * side];
    };
    const wd = (u: number) => Math.pow(1 - u, 1.1);
    out.push(ax, ay);
    for (const u of U) {
      const [cx, cy] = c(u);
      out.push(cx - ex * wd(u), cy - ey * wd(u));
    }
    const [tx, ty] = c(1);
    out.push(tx, ty);
    for (let k = U.length - 1; k >= 0; k--) {
      const [cx, cy] = c(U[k]);
      out.push(cx + ex * wd(U[k]) * 0.9, cy + ey * wd(U[k]) * 0.9);
    }
  }
  out.push(root[(n - 1) * 2], root[(n - 1) * 2 + 1]);
  for (let i = n - 1; i >= 0; i--) out.push(root[i * 2] + inset[0], root[i * 2 + 1] + inset[1]);
  return out;
}

interface MareSpec {
  id: string;
  x: number;
  y: number;
  s: number;
  z: number;
  bright: number;
  /** extra rearing (deg, + = more upright) */
  rear: number;
  neck: number;
  head: number;
  /** near / far foreleg (upper, lower) rest rotations (deg) */
  foreN: V2;
  foreF: V2;
  seed: number;
  /** brightness of contours crossing parts behind (the near mare's outline must stay crisp over the far one) */
  edge: number;
}

interface MareRig {
  s: number;
  root: number;
  hip: number;
  neck: number;
  head: number;
  jaw: number;
  fn0: number;
  fn1: number;
  fn2: number;
  ff0: number;
  ff1: number;
  hn: number;
  hf: number;
  tail: number[];
  // world key points
  muzzle: V2;
  mouth: V2;
  eye: V2;
  poll: V2;
  withers: V2;
  chest: V2;
  croup: V2;
  stifle: V2;
  hoofN: V2;
  hoofF: V2;
  kneeN: V2;
  kneeF: V2;
  hindHoof: V2;
  hock: V2;
  tailTip: V2;
}

// base-pose joints (near mare, unscaled)
const HIP: V2 = [1.0, -0.75];
const NECK: V2 = [-0.45, 1.45];
const POLL: V2 = [-1.3, 2.95];
const JAW: V2 = [-1.72, 2.47];
const ELBOW_N: V2 = [-0.92, 0.52];
const KNEE_N: V2 = [-2.0, 1.0];
const FET_N: V2 = [-2.25, 0.22];
const ELBOW_F: V2 = [-0.62, 0.75];
const KNEE_F: V2 = [-1.72, 1.48];
const HOCK_N: V2 = [1.05, -2.25];
const HOCK_F: V2 = [1.55, -2.2];
const TAIL: number[] = [1.66, -0.6, 2.2, -0.72, 2.62, -1.2, 2.8, -1.9, 2.74, -2.65];

function addMare(B: Builder, sp: MareSpec): MareRig {
  const id = sp.id;
  const s = sp.s;
  const pen = new Pen(B, sp.x, sp.y, s);
  const bodyX = jt(ID, HIP[0], HIP[1], -sp.rear);
  const neckX = jt(bodyX, NECK[0], NECK[1], sp.neck);
  const headX = jt(neckX, POLL[0], POLL[1], sp.head);
  const fn0X = jt(bodyX, ELBOW_N[0], ELBOW_N[1], sp.foreN[0]);
  const fn1X = jt(fn0X, KNEE_N[0], KNEE_N[1], sp.foreN[1]);
  const ff0X = jt(bodyX, ELBOW_F[0], ELBOW_F[1], sp.foreF[0]);
  const ff1X = jt(ff0X, KNEE_F[0], KNEE_F[1], sp.foreF[1]);
  const pb = pen.via(bodyX);
  const pn = pen.via(neckX);
  const ph = pen.via(headX);
  const pfn0 = pen.via(fn0X);
  const pfn1 = pen.via(fn1X);
  const pff0 = pen.via(ff0X);
  const pff1 = pen.via(ff1X);

  // --- bones ---
  const root = pen.bone(id, B.ROOT, 0.95, -3.25);
  const hip = pb.bone(`${id}Hip`, root, HIP[0], HIP[1]);
  const neck = pb.bone(`${id}Neck`, hip, NECK[0], NECK[1]);
  const head = pn.bone(`${id}Head`, neck, POLL[0], POLL[1]);
  const jaw = ph.bone(`${id}Jaw`, head, JAW[0], JAW[1]);
  const fn0 = pb.bone(`${id}ForeN`, hip, ELBOW_N[0], ELBOW_N[1]);
  const fn1 = pfn0.bone(`${id}ForeN1`, fn0, KNEE_N[0], KNEE_N[1]);
  const fn2 = pfn1.bone(`${id}ForeN2`, fn1, FET_N[0], FET_N[1]);
  const ff0 = pb.bone(`${id}ForeF`, hip, ELBOW_F[0], ELBOW_F[1]);
  const ff1 = pff0.bone(`${id}ForeF1`, ff0, KNEE_F[0], KNEE_F[1]);
  const hn = pen.bone(`${id}HindN`, root, HOCK_N[0], HOCK_N[1]);
  const hf = pen.bone(`${id}HindF`, root, HOCK_F[0], HOCK_F[1]);
  const tailW = pb.pts(TAIL);
  const tail: number[] = [];
  {
    let par = hip;
    for (let i = 0; i < 3; i++) {
      const k = i === 0 ? 0 : i + 1;
      par = B.bone(`${id}Tail${i}`, par, tailW[k * 2], tailW[k * 2 + 1]);
      tail.push(par);
    }
  }
  const tailBones = [tail[0], tail[0], tail[1], tail[2]];

  const dim = sp.bright;
  const far = { z: sp.z - 0.5 * s, bright: 0.58 * dim, rim: 0.85, inner: 0.4, thick: 0.18 * s, k: 0.1 * s, blend: 0.14 * s };
  const hoof = (p: Pen, b: number, x: number, y: number, ang: number) => p.poly(b, rotPts([x - 0.17, y + 0.1, x + 0.15, y + 0.1, x + 0.2, y - 0.14, x - 0.24, y - 0.14], x, y, ang), 0.03, 0);

  // --- far forelimb (raised high, pawing) ---
  B.part(
    `${id}ForeFar`,
    far,
    pb.cap(ff0, ELBOW_F[0], ELBOW_F[1], KNEE_F[0], KNEE_F[1], 0.26, 0.15),
    pff1.cap(ff1, KNEE_F[0], KNEE_F[1], -2.28, 0.92, 0.13, 0.095),
    pff1.cap(ff1, -2.28, 0.92, -2.3, 0.66, 0.095, 0.1),
    hoof(pff1, ff1, -2.28, 0.55, -20),
  );
  // --- far hind leg ---
  B.part(
    `${id}HindFar`,
    far,
    pb.cap(hip, 1.45, -0.85, 1.0, -1.45, 0.5, 0.3),
    pen.cap(hf, 1.0, -1.42, HOCK_F[0], HOCK_F[1], 0.27, 0.15),
    pen.cap(hf, HOCK_F[0], HOCK_F[1], 1.32, -2.95, 0.12, 0.1),
    pen.cap(hf, 1.32, -2.95, 1.18, -3.12, 0.1, 0.1),
    hoof(pen, hf, 1.12, -3.2, 0),
  );
  // --- tail of flame ---
  {
    const prims: Prim[] = [...pb.tube(tailBones, TAIL, [0.18, 0.26, 0.3, 0.26, 0.12])];
    const fl = flameOutline(
      [1.75, -0.48, 2.2, -0.55, 2.6, -0.82, 2.88, -1.25, 3.0, -1.7, 3.0, -2.15, 2.9, -2.6, 2.75, -2.95],
      [1, 0.55],
      [0.7, 0.85, 0.95, 0.9, 0.8, 0.68, 0.5],
      [-0.3, 0.0],
      sp.seed + 11,
      0.35,
      -0.35,
    );
    prims.push(pb.poly(tail[1], fl, 0.015, 2));
    B.part(`${id}Tail`, { z: sp.z - 0.2 * s, k: 0.12 * s, thick: 0.2 * s, bright: 0.95 * dim, flow: Flow.Flame, tint: 0.1, blend: 0.3 * s, inner: Math.max(0.5, sp.edge * 0.9), rim: 1.1 }, prims);
  }
  // --- mane of flame (behind the neck: the neck hides its roots) ---
  {
    const root = [-1.18, 3.06, -0.9, 2.96, -0.6, 2.75, -0.3, 2.45, -0.08, 2.08, 0.06, 1.7, 0.16, 1.35];
    const fl = flameOutline(root, [1, 0.75], [0.8, 1.0, 1.1, 1.05, 0.92, 0.72], [-0.32, -0.06], sp.seed + 5, 0.35, -0.3);
    B.part(
      `${id}Mane`,
      { z: sp.z + 0.05 * s, k: 0.1 * s, thick: 0.25 * s, bright: dim, flow: Flow.Flame, tint: 0.15, blend: 0.3 * s, rim: 1.25, inner: Math.max(0.5, sp.edge * 0.9), fill: 1.15 },
      pn.poly(neck, fl, 0.015, 2),
      pn.cap(head, -1.25, 3.18, -0.9, 3.42, 0.1, 0.04),
    );
  }
  // --- barrel: hindquarters, belly, deep chest ---
  B.part(
    `${id}Body`,
    { z: sp.z, k: 0.3 * s, thick: 0.55 * s, bright: dim, blend: 0.25 * s, inner: Math.max(0.55, sp.edge) },
    pb.poly(
      hip,
      [1.5, -0.33, 1.09, 0.11, 0.65, 0.52, 0.3, 1.4, -0.41, 1.42, -0.95, 1.27, -1.19, 0.54, -0.83, -0.2, -0.24, -0.75, 0.33, -1.12, 0.77, -1.35, 1.23, -1.36, 1.55, -1.1, 1.64, -0.73],
      0.05,
      3,
    ),
    pb.ell(hip, 1.12, -0.72, 0.62, 0.66, -30),
  );
  // --- near hind leg (haunch + bent hock, planted) ---
  B.part(
    `${id}HindNear`,
    { z: sp.z + 0.3 * s, k: 0.14 * s, inner: 0.62, thick: 0.35 * s, bright: dim, blend: 0.16 * s },
    pb.cap(hip, 1.12, -0.78, 0.5, -1.48, 0.6, 0.34),
    pen.cap(hn, 0.5, -1.48, HOCK_N[0], HOCK_N[1], 0.3, 0.16),
    pen.ell(hn, 1.12, -2.2, 0.15, 0.13),
    pen.cap(hn, HOCK_N[0], HOCK_N[1], 0.75, -2.95, 0.13, 0.11),
    pen.cap(hn, 0.75, -2.95, 0.58, -3.12, 0.105, 0.1),
    hoof(pen, hn, 0.52, -3.2, 0),
  );
  // --- neck (arched) ---
  B.part(
    `${id}Neck`,
    { z: sp.z + 0.15 * s, k: 0.2 * s, thick: 0.4 * s, bright: dim, inner: Math.max(0.6, sp.edge), blend: 0.3 * s },
    pn.poly(neck, [0.22, 1.34, 0.06, 2.05, -0.32, 2.66, -0.82, 3.02, -1.22, 3.14, -1.6, 2.75, -1.5, 2.3, -1.32, 1.82, -1.02, 1.3, -0.4, 1.2], 0.04, 3),
  );
  // --- lower jaw (open, behind the head) ---
  B.part(
    `${id}Jaw`,
    { z: sp.z + 0.32 * s, k: 0.06 * s, thick: 0.15 * s, bright: dim, inner: 0.85, tint: 0.05 },
    ph.poly(jaw, [-1.72, 2.5, -2.08, 2.3, -2.42, 2.12, -2.55, 2.03, -2.47, 1.94, -2.1, 2.03, -1.75, 2.18, -1.55, 2.38], 0.03, 3),
    ...[0, 1, 2, 3].map((i) => {
      const x = -2.4 + i * 0.13;
      const y = 2.08 + i * 0.065;
      return ph.poly(jaw, [x - 0.04, y, x + 0.04, y + 0.02, x - 0.01, y + 0.13], 0.008, 0);
    }),
  );
  // --- head: long wedge skull, flared nostril, pinned ears, bared teeth ---
  B.part(
    `${id}Head`,
    { z: sp.z + 0.36 * s, k: 0.1 * s, thick: 0.3 * s, bright: dim, rim: 1.12, inner: 0.95, tint: 0.08, fill: 1.1, blend: 0.15 * s },
    ph.ell(head, -1.52, 2.88, 0.38, 0.32, -25),
    ph.poly(head, [-1.36, 3.24, -1.85, 3.08, -2.3, 2.8, -2.56, 2.6, -2.66, 2.42, -2.56, 2.31, -2.15, 2.39, -1.85, 2.45, -1.52, 2.6], 0.03, 3),
    ph.cap(head, -1.28, 3.16, -0.98, 3.56, 0.1, 0.022),
    ...[0, 1, 2, 3].map((i) => {
      const x = -2.5 + i * 0.14;
      const y = 2.34 + i * 0.022;
      return ph.poly(head, [x - 0.045, y + 0.02, x + 0.045, y + 0.02, x, y - 0.13], 0.008, 0);
    }),
  );
  // --- near foreleg (pawing, in front) ---
  B.part(
    `${id}ForeNear`,
    { z: sp.z + 0.42 * s, k: 0.12 * s, inner: 0.65, thick: 0.32 * s, bright: dim, blend: 0.14 * s },
    pb.cap(fn0, ELBOW_N[0] + 0.12, ELBOW_N[1] + 0.12, KNEE_N[0], KNEE_N[1], 0.3, 0.16),
    pfn0.cap(fn1, KNEE_N[0], KNEE_N[1], FET_N[0], FET_N[1], 0.14, 0.1),
    pfn1.cap(fn2, FET_N[0], FET_N[1], -2.18, -0.02, 0.105, 0.1),
    hoof(pfn1, fn2, -2.14, -0.12, 12),
  );

  // --- detail filaments ---
  const hd = `${id}Head`;
  ph.stroke([-1.85, 2.98, -1.74, 3.0, -1.62, 2.93], { part: hd, w: 0.024, bright: 1.6, tint: 0.8, smooth: 4 });
  ph.stroke([-2.4, 2.68, -2.5, 2.6, -2.48, 2.5], { part: hd, w: 0.02, bright: 1.0, smooth: 4 });
  ph.stroke([-1.6, 2.6, -1.9, 2.5, -2.2, 2.44, -2.55, 2.36], { part: hd, w: 0.016, bright: 0.7, smooth: 4 });
  ph.stroke([-1.45, 3.1, -1.9, 2.92, -2.3, 2.7], { part: hd, w: 0.016, bright: 0.45, smooth: 4 });
  // neck & chest musculature
  pn.stroke([-1.2, 1.45, -0.95, 2.1, -0.85, 2.7], { part: `${id}Neck`, w: 0.02, bright: 0.4 });
  pb.stroke([-0.55, 1.1, -0.35, 0.45, -0.45, -0.1], { part: `${id}Body`, w: 0.022, bright: 0.38 });
  pb.stroke([0.25, 0.45, 0.35, -0.2, 0.05, -0.6], { part: `${id}Body`, w: 0.02, bright: 0.3 });
  pb.stroke([0.65, -0.1, 1.15, -0.35, 1.45, -0.9], { part: `${id}HindNear`, w: 0.022, bright: 0.45 });
  pfn0.stroke([-1.15, 0.45, -1.55, 0.6, -1.9, 0.85], { part: `${id}ForeNear`, w: 0.018, bright: 0.45 });
  // flame wisps in mane and tail
  const flame = { w: 0.02, bright: 0.9, tint: 0.4, flow: Flow.Flame, taper: 0.8 };
  pn.stroke([-0.85, 3.0, -0.45, 3.35, -0.05, 3.5], { ...flame, part: `${id}Mane` });
  pn.stroke([-0.35, 2.55, 0.05, 2.85, 0.45, 2.95], { ...flame, part: `${id}Mane` });
  pn.stroke([0.0, 1.95, 0.4, 2.2, 0.75, 2.25], { ...flame, part: `${id}Mane` });
  pb.stroke([2.1, -0.6, 2.55, -0.45, 2.95, -0.15], { ...flame, part: `${id}Tail` });
  pb.stroke([2.75, -1.3, 3.2, -1.2, 3.5, -0.95], { ...flame, part: `${id}Tail` });
  pb.stroke([2.85, -2.1, 3.25, -2.05, 3.5, -1.8], { ...flame, part: `${id}Tail` });

  return {
    s,
    root,
    hip,
    neck,
    head,
    jaw,
    fn0,
    fn1,
    fn2,
    ff0,
    ff1,
    hn,
    hf,
    tail,
    muzzle: ph.W(-2.55, 2.55),
    mouth: ph.W(-2.4, 2.25),
    eye: ph.W(-1.74, 2.97),
    poll: ph.W(-1.3, 3.12),
    withers: pb.W(0.1, 1.25),
    chest: pb.W(-0.85, 0.85),
    croup: pb.W(1.3, -0.35),
    stifle: pb.W(0.5, -1.4),
    hoofN: pfn1.W(-2.14, -0.12),
    hoofF: pff1.W(-2.28, 0.55),
    kneeN: pfn0.W(KNEE_N[0], KNEE_N[1]),
    kneeF: pff0.W(KNEE_F[0], KNEE_F[1]),
    hindHoof: pen.W(0.52, -3.2),
    hock: pen.W(HOCK_N[0], HOCK_N[1]),
    tailTip: pb.W(2.8, -2.4),
  };
}

function rotPts(p: number[], cx: number, cy: number, angDeg: number): number[] {
  const c = Math.cos(angDeg * deg);
  const s = Math.sin(angDeg * deg);
  const o: number[] = [];
  for (let i = 0; i < p.length; i += 2) {
    const dx = p[i] - cx;
    const dy = p[i + 1] - cy;
    o.push(cx + dx * c - dy * s, cy + dx * s + dy * c);
  }
  return o;
}

export function buildMares(): CreatureDef {
  const B = new Builder();
  // far mare first (lower layers), offset back and up, rearing higher with her head tossed
  const farM = addMare(B, { id: 'mf', x: 0.95, y: 0.28, s: 0.76, z: -0.9, bright: 0.64, rear: 5, neck: -8, head: -40, foreN: [-30, 22], foreF: [-14, -8], seed: 7, edge: 0 });
  const nearM = addMare(B, { id: 'mn', x: -1.5, y: -0.2, s: 0.86, z: 0, bright: 1, rear: 0, neck: 0, head: 0, foreN: [0, 0], foreF: [0, 0], seed: 3, edge: 0.95 });
  const mares = [nearM, farM];

  const st = (name: string, p: V2, mag: number, part: string, gold = false) => B.star(name, p[0], p[1], mag, { part, gold });
  // Pegasus on the near mare: Enif at the muzzle, the Great Square on the barrel
  st('enif', nearM.muzzle, 1.25, 'mnHead');
  st('mnEye', nearM.eye, 1.15, 'mnHead');
  st('biham', nearM.poll, 0.85, 'mnHead');
  st('homam', [nearM.withers[0] - 0.55, nearM.withers[1] + 0.75], 0.9, 'mnNeck');
  st('scheat', nearM.withers, 1.1, 'mnBody');
  st('markab', nearM.chest, 1.45, 'mnBody');
  st('algenib', nearM.stifle, 1.0, 'mnHindNear');
  st('alpheratz', nearM.croup, 1.3, 'mnBody');
  st('mnKnee', nearM.kneeN, 0.8, 'mnForeNear');
  st('mnHoof', nearM.hoofN, 1.0, 'mnForeNear');
  st('matar', nearM.kneeF, 0.7, 'mnForeFar');
  st('mnHock', nearM.hock, 0.75, 'mnHindNear');
  st('mnHindHoof', nearM.hindHoof, 0.85, 'mnHindNear');
  st('mnTail', nearM.tailTip, 0.9, 'mnTail');
  B.link('enif', 'mnEye', 'biham', 'homam', 'scheat');
  B.link('scheat', 'markab', 'algenib', 'alpheratz', 'scheat');
  B.link('markab', 'mnKnee', 'mnHoof');
  B.link('scheat', 'matar');
  B.link('algenib', 'mnHock', 'mnHindHoof');
  B.link('alpheratz', 'mnTail');
  // Equuleus on the far mare
  st('kitalpha', farM.muzzle, 1.0, 'mfHead');
  st('mfEye', farM.eye, 1.0, 'mfHead');
  st('mfPoll', farM.poll, 0.7, 'mfHead');
  st('mfWithers', farM.withers, 0.8, 'mfBody');
  st('mfHoof', farM.hoofN, 0.85, 'mfForeNear');
  st('mfCroup', farM.croup, 0.8, 'mfBody');
  st('mfTail', farM.tailTip, 0.75, 'mfTail');
  B.link('kitalpha', 'mfEye', 'mfPoll', 'mfWithers', 'mfCroup', 'mfTail');
  B.link('mfWithers', 'mfHoof');

  B.core = P(nearM.chest[0] + 0.5, nearM.chest[1] - 0.3);
  B.head = P(nearM.eye[0], nearM.eye[1], 0.4);
  B.mouths.push(P(nearM.mouth[0], nearM.mouth[1], 0.45), P(farM.mouth[0], farM.mouth[1], -0.5));

  return B.build('mares', (p: Pose, c: AnimCtx) => animateMares(p, c, mares));
}

function animateMares(p: Pose, c: AnimCtx, mares: MareRig[]): void {
  const t = c.t;
  const fwd = Math.max(0, c.lunge);
  const back = Math.max(0, -c.lunge);
  mares.forEach((m, i) => {
    const lead = i === 0;
    const k = lead ? 1 : 0.7;
    const ph = lead ? 0 : 2.2;
    // rearing cycle: rise, hang, settle
    const rc = Math.sin(t * 0.85 + ph);
    const rise = 0.5 + 0.5 * rc;
    const rearA = -0.06 * rc * (1 - 0.6 * c.guard) - 0.12 * back * k + 0.1 * fwd * k - 0.08 * c.roar + 0.08 * c.low + 0.1 * c.hurt + 0.05 * c.guard;
    p.r(m.hip, rearA + 0.012 * c.breath);
    p.o(m.root, -0.2 * fwd * k, 0.05 * rise + 0.12 * back - 0.1 * c.low, 0);
    // hind legs keep the hooves planted
    p.r(m.hn, -rearA * 0.6);
    p.r(m.hf, -rearA * 0.6);
    // head tossing, jaws snapping
    const toss = Math.sin(t * 1.7 + ph * 1.3) * 0.5 + Math.sin(t * 2.9 + ph) * 0.25;
    p.r(m.neck, 0.05 * rc + 0.04 * toss - 0.18 * c.roar + 0.14 * back - 0.08 * fwd * k + 0.1 * c.hurt + 0.12 * c.low + 0.1 * c.guard);
    p.r(m.head, 0.1 * toss * (1 - 0.7 * c.guard) - 0.2 * c.roar - 0.14 * fwd * k + 0.12 * back + 0.08 * c.low + 0.22 * c.guard);
    const snap = Math.max(0, Math.sin(t * 2.3 + ph * 2)) ** 4;
    p.r(m.jaw, 0.06 + 0.18 * snap + 0.45 * c.mouth);
    // forehooves pawing the air (alternating), strike = stamping down
    const paw = Math.sin(t * 3.0 + ph);
    const paw2 = Math.sin(t * 3.0 + ph + 2.4);
    p.r(m.fn0, 0.18 * paw * (1 - fwd) - 0.35 * back * k + 0.55 * fwd * k + 0.2 * c.low);
    p.r(m.fn1, -0.3 * Math.max(0, paw) * (1 - c.guard) - 0.25 * back + 0.35 * fwd * k + 0.45 * c.guard);
    p.r(m.fn2, -0.25 * Math.max(0, Math.sin(t * 3.0 + ph - 0.7)));
    p.r(m.ff0, 0.16 * paw2 * (1 - fwd) - 0.3 * back * k + 0.5 * fwd * k + 0.15 * c.low);
    p.r(m.ff1, -0.28 * Math.max(0, paw2) * (1 - c.guard) - 0.2 * back + 0.3 * fwd * k + 0.4 * c.guard);
    // flaming tail lashing
    p.wave(m.tail, 0.07 * (1 + c.charge + 0.5 * c.roar), t, 1.8 + 2 * c.charge, 0.8, 0.4);
    p.r(m.tail[0], -0.1 * c.roar + 0.08 * back);
  });
}

export const CREATURE: CreatureModule = { id: 'mares', build: buildMares };
