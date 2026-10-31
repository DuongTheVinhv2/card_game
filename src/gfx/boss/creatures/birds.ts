import { Builder, Flow, P, deg, type AnimCtx, type CreatureDef, type Pose } from '../rig';
import type { Prim } from '../sdf';
import type { CreatureModule } from './index';

/**
 * VI. The Stymphalian Birds — a flock of bronze-feathered raptors flying left, wings raised, blade-like
 * primaries splayed like knives, hooked beaks screeching. After the three bird constellations Heracles shot
 * down (Aquila, Cygnus, Lyra as Vultur Cadens): one dominant bird + smaller ones at different depths.
 */

/** similarity transform helper: authors one bird in its own local frame (body centre = origin, facing left) */
class Pen {
  private readonly c: number;
  private readonly s_: number;
  constructor(
    readonly B: Builder,
    readonly ox: number,
    readonly oy: number,
    readonly s: number,
    readonly aDeg: number,
  ) {
    this.c = Math.cos(aDeg * deg);
    this.s_ = Math.sin(aDeg * deg);
  }
  X(x: number, y: number): number {
    return this.ox + this.s * (x * this.c - y * this.s_);
  }
  Y(x: number, y: number): number {
    return this.oy + this.s * (x * this.s_ + y * this.c);
  }
  pts(p: number[]): number[] {
    const o: number[] = [];
    for (let i = 0; i < p.length; i += 2) o.push(this.X(p[i], p[i + 1]), this.Y(p[i], p[i + 1]));
    return o;
  }
  bone(name: string, parent: number, x: number, y: number): number {
    return this.B.bone(name, parent, this.X(x, y), this.Y(x, y));
  }
  cap(b: number, ax: number, ay: number, bx: number, by: number, ra: number, rb = ra): Prim {
    return this.B.cap(b, this.X(ax, ay), this.Y(ax, ay), this.X(bx, by), this.Y(bx, by), ra * this.s, rb * this.s);
  }
  ell(b: number, x: number, y: number, rx: number, ry: number, a = 0): Prim {
    return this.B.ell(b, this.X(x, y), this.Y(x, y), rx * this.s, ry * this.s, a + this.aDeg);
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
  star(name: string, x: number, y: number, mag: number, part: string, gold = false): number {
    return this.B.star(name, this.X(x, y), this.Y(x, y), mag, { part, gold });
  }
}

interface BirdSpec {
  id: string;
  /** world position of the body centre */
  x: number;
  y: number;
  /** scale (1 = dominant bird) */
  s: number;
  /** nose-up tilt (deg) */
  tilt: number;
  /** raise angle of the near / far wing (deg, 90 = straight up) */
  wingN: number;
  wingF: number;
  z: number;
  bright: number;
  /** dominant bird: talons, open lower beak, extra detail */
  hero: boolean;
}

interface BirdRig {
  s: number;
  root: number;
  neck: number;
  head: number;
  jaw: number;
  wn0: number;
  wn1: number;
  wf0: number;
  wf1: number;
  tail: number;
  legs: number;
  /** key points (world) for stars / anchors */
  beak: [number, number];
  eye: [number, number];
  nWrist: [number, number];
  nTip: [number, number];
  fWrist: [number, number];
  fTip: [number, number];
  shoulder: [number, number];
  centre: [number, number];
  tailTip: [number, number];
  talon: [number, number];
}

// canonical wing: u = span (outward), v = toward the leading edge. Feathers: [u, v, angle(deg), length, baseR]
const SECONDARIES: number[][] = [0, 1, 2, 3, 4, 5, 6].map((i) => [0.1 + i * 0.235, -0.4, -97 + i * 2.2, 0.72 + i * 0.045, 0.165]);
const PRIMARIES: number[][] = [
  [1.62, -0.36, -78, 1.0, 0.16],
  [1.85, -0.3, -66, 1.12, 0.155],
  [2.08, -0.22, -54, 1.22, 0.15],
  [2.3, -0.13, -42, 1.3, 0.14],
  [2.48, -0.04, -30, 1.3, 0.13],
  [2.62, 0.05, -18, 1.15, 0.12],
];
const ARM_WEB = [0.0, 0.16, 0.75, 0.34, 1.5, 0.4, 1.6, -0.5, 0.75, -0.62, 0.0, -0.52];
const HAND_WEB = [1.4, 0.4, 2.05, 0.27, 2.62, -0.02, 2.68, -0.32, 2.1, -0.6, 1.45, -0.6];
const WRIST: [number, number] = [1.5, 0.1];

function addBird(B: Builder, sp: BirdSpec): BirdRig {
  const pen = new Pen(B, sp.x, sp.y, sp.s, sp.tilt);
  const id = sp.id;
  const s = sp.s;
  const W = (x: number, y: number): [number, number] => [pen.X(x, y), pen.Y(x, y)];

  // --- wing geometry (bird-local) ---
  const wingMap = (Sx: number, Sy: number, thDeg: number) => {
    const c = Math.cos(thDeg * deg);
    const sn = Math.sin(thDeg * deg);
    return (u: number, v: number): [number, number] => [Sx + u * c - v * sn, Sy + u * sn + v * c];
  };
  const SN: [number, number] = [-0.3, 0.38];
  const SF: [number, number] = [-0.05, 0.5];
  /** the hand (primaries) sweeps back about the wrist */
  const bend = (m: (u: number, v: number) => [number, number], aDeg: number) => {
    const c = Math.cos(aDeg * deg);
    const sn = Math.sin(aDeg * deg);
    return (u: number, v: number): [number, number] => {
      const du = u - WRIST[0];
      const dv = v - WRIST[1];
      return m(WRIST[0] + du * c - dv * sn, WRIST[1] + du * sn + dv * c);
    };
  };
  const wN = wingMap(SN[0], SN[1], sp.wingN + 7);
  const wF = wingMap(SF[0], SF[1], sp.wingF + 9);
  const wNh = bend(wN, -26);
  const wFh = bend(wF, -26);
  const flat = (m: (u: number, v: number) => [number, number], p: number[]) => {
    const o: number[] = [];
    for (let i = 0; i < p.length; i += 2) o.push(...m(p[i], p[i + 1]));
    return o;
  };
  const feather = (m: (u: number, v: number) => [number, number], f: number[], len = 1) => {
    const [u, v, a, L, r] = f;
    const tu = u + Math.cos(a * deg) * L * len;
    const tv = v + Math.sin(a * deg) * L * len;
    return { a: m(u, v), b: m(tu, tv), r };
  };

  // --- bones ---
  const root = pen.bone(`${id}`, B.ROOT, 0, 0);
  const neck = pen.bone(`${id}Neck`, root, -0.75, 0.32);
  const head = pen.bone(`${id}Head`, neck, -1.3, 0.92);
  const jaw = sp.hero ? pen.bone(`${id}Jaw`, head, -1.74, 0.96) : -1;
  const wn0 = pen.bone(`${id}WingN`, root, SN[0], SN[1]);
  const wn1 = pen.bone(`${id}WingN1`, wn0, ...wN(...WRIST));
  const wf0 = pen.bone(`${id}WingF`, root, SF[0], SF[1]);
  const wf1 = pen.bone(`${id}WingF1`, wf0, ...wF(...WRIST));
  const tail = pen.bone(`${id}Tail`, root, 0.95, -0.12);
  const legs = sp.hero ? pen.bone(`${id}Legs`, root, -0.1, -0.38) : -1;

  type WM = (u: number, v: number) => [number, number];
  const wingPrims = (m: WM, mh: WM, b0: number, b1: number): Prim[] => {
    const out: Prim[] = [pen.poly(b0, flat(m, ARM_WEB), 0.02, 3), pen.poly(b1, flat(mh, HAND_WEB), 0.02, 3)];
    for (const f of SECONDARIES) {
      const q = feather(m, f);
      out.push(pen.cap(b0, q.a[0], q.a[1], q.b[0], q.b[1], q.r, 0.014));
    }
    for (const f of PRIMARIES) {
      const q = feather(mh, f);
      out.push(pen.cap(b1, q.a[0], q.a[1], q.b[0], q.b[1], q.r, 0.012));
    }
    return out;
  };
  const dim = sp.bright;
  const blade = { k: 0.06 * s, flow: Flow.Bristle, thick: 0.12 * s, blend: 0.22 * s, tint: 0.12 };

  // far wing (behind everything of this bird)
  B.part(`${id}WingF`, { ...blade, z: sp.z - 0.45 * s, bright: 0.62 * dim, rim: 0.9, inner: 0.45 }, wingPrims(wF, wFh, wf0, wf1));
  // tail: fan of blades
  {
    const prims: Prim[] = [pen.poly(tail, [0.75, 0.16, 1.3, 0.08, 1.38, -0.3, 0.8, -0.34], 0.03, 2)];
    const fan = [-6, -17, -28, -39, -50];
    const lens = [1.5, 1.62, 1.58, 1.46, 1.3];
    fan.forEach((a, i) => {
      const bx = 1.12;
      const by = -0.08;
      prims.push(pen.cap(tail, bx, by, bx + Math.cos(a * deg) * lens[i], by + Math.sin(a * deg) * lens[i], 0.13, 0.018));
    });
    B.part(`${id}Tail`, { ...blade, z: sp.z - 0.15 * s, bright: 0.9 * dim, k: 0.05 * s }, prims);
  }
  // talons
  if (sp.hero) {
    B.part(
      `${id}Legs`,
      { z: sp.z + 0.1 * s, k: 0.06 * s, thick: 0.12 * s, bright: dim, inner: 0.7, blend: 0.15 * s },
      pen.ell(legs, -0.18, -0.55, 0.32, 0.22, -35),
      pen.cap(legs, -0.28, -0.62, -0.62, -1.12, 0.1, 0.07),
      pen.cap(legs, -0.62, -1.12, -0.98, -1.14, 0.055, 0.035),
      pen.cap(legs, -0.98, -1.14, -1.08, -1.3, 0.035, 0.01),
      pen.cap(legs, -0.62, -1.14, -0.88, -1.38, 0.05, 0.03),
      pen.cap(legs, -0.88, -1.38, -0.93, -1.53, 0.03, 0.01),
      pen.cap(legs, -0.6, -1.12, -0.42, -1.36, 0.05, 0.03),
      pen.cap(legs, -0.42, -1.36, -0.5, -1.48, 0.03, 0.01),
    );
  }
  // body
  B.part(
    `${id}Body`,
    { z: sp.z, k: 0.18 * s, thick: 0.4 * s, bright: dim, blend: 0.2 * s },
    pen.poly(root, [-1.05, 0.05, -0.85, 0.52, -0.3, 0.64, 0.4, 0.52, 1.0, 0.22, 1.18, -0.08, 0.8, -0.36, 0.1, -0.55, -0.55, -0.5, -0.95, -0.28], 0.04, 3),
  );
  // lower beak (behind the upper one)
  if (sp.hero) {
    B.part(
      `${id}Jaw`,
      { z: sp.z + 0.3 * s, k: 0.03 * s, thick: 0.06 * s, bright: dim, inner: 0.9, tint: 0.2 },
      pen.poly(jaw, [-1.72, 0.97, -1.95, 0.93, -2.09, 0.87, -2.05, 0.82, -1.85, 0.83, -1.7, 0.88], 0.014, 2),
    );
  }
  // neck, head, hooked beak, crest of blades
  B.part(
    `${id}Head`,
    { z: sp.z + 0.32 * s, k: 0.08 * s, thick: 0.25 * s, bright: dim, rim: 1.1, inner: 0.85, tint: 0.08, blend: 0.16 * s },
    pen.tube(neck, [-0.8, 0.28, -1.08, 0.62, -1.3, 0.9], [0.38, 0.3, 0.25]),
    pen.ell(head, -1.5, 1.05, 0.33, 0.27, -5),
    pen.poly(head, [-1.66, 1.25, -1.9, 1.25, -2.07, 1.17, -2.19, 1.03, -2.23, 0.88, -2.18, 0.76, -2.12, 0.85, -2.02, 0.93, -1.85, 0.97, -1.7, 0.98], 0.012, 2),
    pen.cap(head, -1.36, 1.22, -0.88, 1.64, 0.075, 0.014),
    pen.cap(head, -1.3, 1.14, -0.78, 1.38, 0.068, 0.012),
    pen.cap(head, -1.28, 1.04, -0.76, 1.08, 0.058, 0.012),
  );
  // near wing (in front of the body)
  B.part(`${id}WingN`, { ...blade, z: sp.z + 0.4 * s, bright: dim, rim: 1.15, inner: 0.7 }, wingPrims(wN, wNh, wn0, wn1));

  // --- detail filaments ---
  const nb = `${id}WingN`;
  const shaft = { part: nb, w: 0.016, bright: 0.85, tint: 0.5, taper: 0.9, smooth: 0, flow: Flow.Bristle };
  for (const f of PRIMARIES) {
    const q = feather(wNh, f, 0.92);
    pen.stroke([...q.a, ...q.b], shaft);
  }
  if (sp.hero) {
    for (const f of SECONDARIES) {
      const q = feather(wN, f, 0.85);
      pen.stroke([...q.a, ...q.b], { ...shaft, bright: 0.6 });
    }
    // covert rows
    pen.stroke([...flat(wN, [0.1, -0.36, 0.8, -0.44, 1.5, -0.4]), ...flat(wNh, [2.1, -0.3, 2.55, -0.12])], { part: nb, w: 0.02, bright: 0.55 });
    pen.stroke([...flat(wN, [0.15, -0.02, 0.8, 0.02, 1.5, 0.06]), ...flat(wNh, [2.1, 0.0])], { part: nb, w: 0.018, bright: 0.4 });
    // face: brow + eye ridge, beak edge
    pen.stroke([-1.8, 1.17, -1.64, 1.2, -1.46, 1.14], { part: `${id}Head`, w: 0.02, bright: 1.2, tint: 0.6, smooth: 4 });
    pen.stroke([-1.84, 0.97, -2.02, 0.93, -2.16, 0.82], { part: `${id}Head`, w: 0.016, bright: 0.8, smooth: 4 });
    // breast feathering
    pen.stroke([-0.95, 0.1, -0.7, -0.15, -0.3, -0.35], { part: `${id}Body`, w: 0.02, bright: 0.4 });
    pen.stroke([-0.6, 0.4, -0.3, 0.1, 0.2, -0.15], { part: `${id}Body`, w: 0.02, bright: 0.35 });
  }
  // tail shafts
  [-6, -28, -50].forEach((a, i) => {
    const L = [1.4, 1.48, 1.2][i];
    pen.stroke([1.12, -0.08, 1.12 + Math.cos(a * deg) * L, -0.08 + Math.sin(a * deg) * L], { part: `${id}Tail`, w: 0.014, bright: 0.6, taper: 0.9, smooth: 0 });
  });

  const tipN = feather(wNh, PRIMARIES[4]).b;
  const tipF = feather(wFh, PRIMARIES[4]).b;
  return {
    s,
    root,
    neck,
    head,
    jaw,
    wn0,
    wn1,
    wf0,
    wf1,
    tail,
    legs,
    beak: W(-2.15, 0.86),
    eye: W(-1.6, 1.09),
    nWrist: W(...wN(...WRIST)),
    nTip: W(...tipN),
    fWrist: W(...wF(...WRIST)),
    fTip: W(...tipF),
    shoulder: W(SN[0], SN[1]),
    centre: W(0.05, 0.02),
    tailTip: W(1.12 + Math.cos(-28 * deg) * 1.45, -0.08 + Math.sin(-28 * deg) * 1.45),
    talon: W(-0.95, -1.25),
  };
}

export function buildBirds(): CreatureDef {
  const B = new Builder();
  // back to front: smaller, farther birds first so the dominant one occludes them
  const crv = addBird(B, { id: 'crv', x: -3.75, y: 2.25, s: 0.3, tilt: -2, wingN: 78, wingF: 54, z: -1.8, bright: 0.5, hero: false });
  const lyra = addBird(B, { id: 'lyr', x: 3.55, y: -2.0, s: 0.52, tilt: 2, wingN: 76, wingF: 50, z: -1.3, bright: 0.66, hero: false });
  const cyg = addBird(B, { id: 'cyg', x: 3.15, y: 0.95, s: 0.58, tilt: 8, wingN: 90, wingF: 64, z: -0.9, bright: 0.74, hero: false });
  const aql = addBird(B, { id: 'aql', x: -1.1, y: -1.2, s: 1.2, tilt: 8, wingN: 86, wingF: 58, z: 0, bright: 1, hero: true });
  const birds = [aql, cyg, lyra, crv];

  // --- key stars ---
  const st = (name: string, p: [number, number], mag: number, part: string) => B.star(name, p[0], p[1], mag, { part });
  // Aquila (dominant): Altair flanked by Tarazed / Alshain along the neck
  st('aqBeak', aql.beak, 0.8, 'aqlHead');
  st('aqEye', aql.eye, 1.05, 'aqlHead');
  B.star('tarazed', aql.eye[0] + 0.42, aql.eye[1] - 0.18, 0.9, { part: 'aqlHead' });
  B.star('altair', aql.shoulder[0] - 0.5, aql.shoulder[1] + 0.05, 1.75, { part: 'aqlHead' });
  B.star('alshain', aql.shoulder[0] - 0.25, aql.shoulder[1] - 0.45, 0.85, { part: 'aqlBody' });
  st('aqHeart', aql.centre, 0.9, 'aqlBody');
  st('aqWrist', aql.nWrist, 0.9, 'aqlWingN');
  st('aqTip', aql.nTip, 1.25, 'aqlWingN');
  st('aqFWrist', aql.fWrist, 0.6, 'aqlWingF');
  st('aqFTip', aql.fTip, 0.85, 'aqlWingF');
  st('okab', aql.tailTip, 1.05, 'aqlTail');
  st('aqTalon', aql.talon, 0.85, 'aqlLegs');
  B.link('aqBeak', 'aqEye', 'tarazed', 'altair', 'alshain', 'aqHeart', 'okab');
  B.link('altair', 'aqWrist', 'aqTip');
  B.link('aqHeart', 'aqFWrist', 'aqFTip');
  B.link('alshain', 'aqTalon');
  // Cygnus: the Northern Cross (Albireo at the beak, Deneb at the tail)
  st('albireo', cyg.beak, 0.95, 'cygHead');
  st('sadr', cyg.centre, 1.0, 'cygBody');
  st('deneb', cyg.tailTip, 1.55, 'cygTail');
  st('gienah', cyg.nTip, 1.0, 'cygWingN');
  st('cygDelta', cyg.fTip, 0.8, 'cygWingF');
  B.link('albireo', 'sadr', 'deneb');
  B.link('gienah', 'sadr', 'cygDelta');
  // Lyra as Vultur Cadens: Vega at the head
  st('vega', lyra.eye, 1.45, 'lyrHead');
  st('sheliak', lyra.centre, 0.75, 'lyrBody');
  st('sulafat', lyra.tailTip, 0.8, 'lyrTail');
  st('lyrWing', lyra.nTip, 0.8, 'lyrWingN');
  B.link('vega', 'sheliak', 'sulafat');
  B.link('sheliak', 'lyrWing');
  // a straggler far behind
  st('crvEye', crv.eye, 0.75, 'crvHead');
  st('crvHeart', crv.centre, 0.6, 'crvBody');
  st('crvWing', crv.nTip, 0.65, 'crvWingN');
  B.link('crvEye', 'crvHeart', 'crvWing');

  B.core = P(aql.centre[0], aql.centre[1]);
  B.head = P(aql.eye[0], aql.eye[1], 0.4);
  B.mouths.push(P(aql.beak[0] - 0.05, aql.beak[1], 0.4), P(cyg.beak[0], cyg.beak[1], -0.6), P(lyra.beak[0], lyra.beak[1], -1.0), P(crv.beak[0], crv.beak[1], -1.4));

  // per bird: flap speed (rad/s), phase, max flap angle (rad; > pi/2 = wings sweep below the body)
  const FLAP = [
    { sp: 2.0, ph: 0.0, depth: 1.0 },
    { sp: 3.0, ph: 2.1, depth: 1.25 },
    { sp: 3.5, ph: 4.4, depth: 1.28 },
    { sp: 4.1, ph: 1.2, depth: 1.3 },
  ];

  return B.build('birds', (p: Pose, c: AnimCtx) => animateFlock(p, c, birds, FLAP));
}

function animateFlock(p: Pose, c: AnimCtx, birds: BirdRig[], FLAP: { sp: number; ph: number; depth: number }[]): void {
  const t = c.t;
  const fwd = Math.max(0, c.lunge);
  const back = Math.max(0, -c.lunge);
  birds.forEach((b, i) => {
    const f = FLAP[i];
    const lead = i === 0;
    // followers react a little less
    const k = lead ? 1 : 0.65;
    const s = b.s;
    // flap cycle (0 = wings raised, 1 = bottom of the downstroke); quick downstroke, slower recovery
    const speed = f.sp * (1 + 0.6 * c.charge + 0.3 * c.roar) * (1 - 0.35 * c.low);
    const w = t * speed + f.ph;
    const cyc = 0.5 - 0.5 * Math.cos(w + 0.45 * Math.sin(w));
    const amp = f.depth * (1 - 0.65 * c.roar - 0.55 * c.guard - 0.5 * c.charge) * (1 - 0.45 * fwd);
    // volley: every bird beats hard, flinging its blade feathers
    const flick = c.volley * (lead ? 1.5 : 1.9);
    const phi = Math.min(2.45, amp * cyc + flick);
    const e = Math.cos(phi);
    // wing rotates about the body axis: projected height = cos(phi); the near wing swings toward the camera
    p.s(b.wn0, 1, e).o(b.wn0, 0, 0, 0.35 * Math.sin(phi) * s);
    p.s(b.wf0, 1, e).o(b.wf0, 0, 0, -0.2 * Math.sin(phi) * s);
    // primaries trail the beat; swept back when diving, droop when weak
    const lag = Math.sin(w - 1.1) * Math.min(1, amp);
    p.r(b.wn1, 0.14 * lag - 0.25 * fwd * k + 0.15 * c.low);
    p.r(b.wf1, 0.12 * lag - 0.2 * fwd * k + 0.12 * c.low);
    p.r(b.wn0, -0.05 * lag - 0.2 * fwd * k + 0.1 * back - 0.1 * c.roar + 0.2 * c.guard + 0.22 * c.low);
    p.r(b.wf0, -0.04 * lag - 0.16 * fwd * k + 0.08 * back - 0.08 * c.roar + 0.14 * c.guard + 0.16 * c.low);
    // body: lifts on the downstroke, dives on the strike
    const bob = (0.14 * cyc * Math.min(1, amp) - 0.06) * s;
    p.o(b.root, -0.25 * fwd * k * s, bob - 0.15 * fwd * k + 0.1 * back - 0.15 * c.low * s, 0);
    p.r(b.root, 0.04 * Math.sin(w + 0.6) * Math.min(1, amp) + 0.16 * fwd * k - 0.08 * back + 0.12 * c.hurt - 0.06 * c.roar + 0.06 * c.low);
    // head: scanning, screeching
    p.r(b.neck, 0.05 * Math.sin(t * 0.8 + i * 2) - 0.2 * c.roar + 0.12 * back - 0.05 * fwd + 0.1 * c.hurt + 0.12 * c.low);
    p.r(b.head, 0.06 * Math.sin(t * 1.3 + i) - 0.18 * c.roar - 0.1 * fwd + 0.08 * c.low);
    if (b.jaw >= 0) {
      const screech = Math.max(0, Math.sin(t * 0.9 + 1.3)) ** 6;
      p.r(b.jaw, 0.06 + 0.22 * screech + 0.42 * c.mouth);
    }
    // tail steering
    p.r(b.tail, 0.06 * Math.sin(t * 1.1 + i * 1.7) + 0.05 * Math.sin(w) * Math.min(1, amp) - 0.1 * fwd * k);
    // talons rake forward on the strike
    if (b.legs >= 0) p.r(b.legs, 0.05 * Math.sin(t * 0.7) - 0.6 * fwd + 0.25 * back + 0.15 * c.hurt);
  });
}

export const CREATURE: CreatureModule = { id: 'birds', build: buildBirds };
