import { Builder, Flow, P, deg, type CreatureDef } from '../rig';
import type { Prim } from '../sdf';
import type { CreatureModule } from './index';

type V2 = [number, number];

/** local frame -> world: optional X mirror, uniform scale, rotation (deg, CCW), translation */
function frame(ox: number, oy: number, angDeg: number, s = 1, mirror = false) {
  const a = angDeg * deg;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const m = mirror ? -1 : 1;
  const T = (x: number, y: number): V2 => {
    const lx = x * m * s;
    const ly = y * s;
    return [ox + lx * ca - ly * sa, oy + lx * sa + ly * ca];
  };
  const L = (pts: number[]): number[] => {
    const o: number[] = [];
    for (let i = 0; i < pts.length; i += 2) o.push(...T(pts[i], pts[i + 1]));
    return o;
  };
  const A = (localDeg: number) => angDeg + m * localDeg;
  return { T, L, A, s };
}
type Frame = ReturnType<typeof frame>;

/* torso / helmet in torso-local space: waist at the origin, up = +y */
const CUIRASS = [-0.55, 0, -0.6, 0.5, -0.72, 1.0, -0.84, 1.45, -0.86, 1.72, -0.7, 1.9, -0.28, 1.98, 0.28, 1.98, 0.7, 1.9, 0.86, 1.72, 0.84, 1.45, 0.72, 1.0, 0.6, 0.5, 0.55, 0];
const CHEEKS = [-0.4, 2.7, -0.47, 2.36, -0.45, 2.1, -0.32, 1.96, -0.1, 1.96, -0.06, 2.12, 0.06, 2.12, 0.1, 1.96, 0.32, 1.96, 0.45, 2.1, 0.47, 2.36, 0.4, 2.7];
const VISOR = [-0.33, 2.72, 0.33, 2.72, 0.33, 2.58, 0.08, 2.54, 0.07, 2.12, -0.07, 2.12, -0.08, 2.54, -0.33, 2.58];
const CREST = [-0.13, 3.08, -0.26, 3.3, -0.4, 3.54, -0.5, 3.78, -0.47, 3.92, -0.38, 3.9, -0.3, 4.0, -0.2, 3.98, -0.1, 4.08, 0.0, 4.04, 0.1, 4.08, 0.2, 3.98, 0.3, 4.0, 0.38, 3.9, 0.47, 3.92, 0.5, 3.78, 0.4, 3.54, 0.26, 3.3, 0.13, 3.08];

interface Warrior {
  F: Frame;
  torso: Prim[];
  helm: Prim[];
  visor: Prim[];
  head: V2;
  crestTop: V2;
  chest: V2;
}

/** one hoplite torso + crested Corinthian helmet (frontal) */
function warrior(B: Builder, torsoBone: number, headBone: number, crestBone: number, F: Frame): Warrior {
  const s = F.s;
  const torso: Prim[] = [
    B.poly(torsoBone, F.L(CUIRASS), 0.04 * s, 3),
    B.ell(torsoBone, ...F.T(-0.86, 1.7), 0.3 * s, 0.25 * s, F.A(20)),
    B.ell(torsoBone, ...F.T(0.86, 1.7), 0.3 * s, 0.25 * s, F.A(-20)),
    B.cap(headBone, ...F.T(0, 1.9), ...F.T(0, 2.25), 0.21 * s, 0.2 * s),
  ];
  const helm: Prim[] = [
    B.ell(headBone, ...F.T(0, 2.7), 0.4 * s, 0.46 * s, F.A(0)),
    B.poly(headBone, F.L(CHEEKS), 0.02 * s, 0),
    B.poly(crestBone, F.L(CREST), 0.02 * s, 2),
  ];
  const visor: Prim[] = [B.poly(headBone, F.L(VISOR), 0.012 * s, 0)];
  return {
    F,
    torso,
    helm,
    visor,
    head: F.T(0, 2.6),
    crestTop: F.T(0, 3.88),
    chest: F.T(0, 1.25),
  };
}

/** leaf-bladed spear from butt (ax,ay) to tip (bx,by) */
function spear(B: Builder, bone: number, ax: number, ay: number, bx: number, by: number, blade = 0.42): Prim[] {
  const dx = bx - ax;
  const dy = by - ay;
  const L = Math.hypot(dx, dy);
  const ux = dx / L;
  const uy = dy / L;
  const nx = -uy;
  const ny = ux;
  const bl = blade;
  const w = 0.1;
  const P0 = (u: number, v: number): V2 => [bx - ux * (bl - u) + nx * v, by - uy * (bl - u) + ny * v];
  return [
    B.cap(bone, ax, ay, bx - ux * bl * 0.9, by - uy * bl * 0.9, 0.04, 0.04),
    B.poly(bone, [...P0(0, 0.035), ...P0(bl * 0.35, w), ...P0(bl, 0), ...P0(bl * 0.35, -w), ...P0(0, -0.035)], 0.01, 0),
    // butt spike
    B.cap(bone, ax, ay, ax - ux * 0.12, ay - uy * 0.12, 0.05, 0.02),
  ];
}

/** X. Geryon — frontal three-bodied giant: three hoplite torsos fanned from one waist, crested helms, six arms, spears + shields. */
export function buildGeryon(): CreatureDef {
  const B = new Builder();
  B.facing = 0;
  const R = B.ROOT;
  const pelvis = B.bone('pelvis', R, 0, -0.55);
  // legs hang from the root so the planted feet stay put when the pelvis sways
  const thighs: number[] = [];
  const shins: number[] = [];
  for (const s of [-1, 1]) {
    const th = B.bone(s < 0 ? 'thighL' : 'thighR', R, s * 0.45, -1.0);
    thighs.push(th);
    shins.push(B.bone(s < 0 ? 'shinL' : 'shinR', th, s * 1.25, -2.15));
  }
  // torsos: centre (upright, in front) + two fanned out behind
  const TILT = 44;
  const SIDE_S = 0.93;
  const torsoC = B.bone('torsoC', pelvis, 0, -0.5);
  const headC = B.bone('headC', torsoC, 0, 1.45);
  const crestC = B.bone('crestC', headC, 0, 2.5);
  const FC = frame(0, -0.5, 0, 1);
  const side = [-1, 1].map((s) => {
    const F = frame(s * 0.42, -0.5, -s * TILT, SIDE_S);
    const torso = B.bone(s < 0 ? 'torsoL' : 'torsoR', pelvis, s * 0.42, -0.5);
    const head = B.bone(s < 0 ? 'headL' : 'headR', torso, ...F.T(0, 1.95));
    const crest = B.bone(s < 0 ? 'crestL' : 'crestR', head, ...F.T(0, 3.0));
    return { s, F, torso, head, crest };
  });

  // arms
  // centre warrior: both arms raised, brandishing spears
  const armC = [-1, 1].map((s) => {
    const up = B.bone(s < 0 ? 'armCLu' : 'armCRu', torsoC, s * 0.86, 1.15);
    const fore = B.bone(s < 0 ? 'armCLf' : 'armCRf', up, s * 1.32, 1.72);
    return { s, up, fore };
  });
  // side warriors: outer arm holds a round shield out, inner arm levels a spear low
  const armS = side.map((sd) => {
    const s = sd.s;
    const sh = sd.F.T(s * 0.86, 1.7);
    const shU = B.bone(s < 0 ? 'shieldLu' : 'shieldRu', sd.torso, ...sh);
    const shF = B.bone(s < 0 ? 'shieldLf' : 'shieldRf', shU, s * 2.78, -0.08);
    const spU = B.bone(s < 0 ? 'lowLu' : 'lowRu', sd.torso, s * 0.66, 0.42);
    const spF = B.bone(s < 0 ? 'lowLf' : 'lowRf', spU, s * 1.42, -0.42);
    return { s, sh, shU, shF, spU, spF };
  });

  /* ---------------- legs (behind the skirt) ---------------- */
  for (const [i, s] of [-1, 1].entries()) {
    B.part(
      s < 0 ? 'legL' : 'legR',
      { z: -0.1, k: 0.12, thick: 0.35, inner: 0.6, blend: 0.12 },
      B.cap(thighs[i], s * 0.45, -0.95, s * 1.25, -2.15, 0.42, 0.28),
      B.cap(shins[i], s * 1.25, -2.15, s * 1.72, -3.0, 0.27, 0.16),
      B.ell(shins[i], s * 1.95, -3.12, 0.36, 0.13, s * 8),
    );
    // greaves (bronze shin guards): internal contour at the knee
    B.part(
      s < 0 ? 'greaveL' : 'greaveR',
      { z: -0.05, k: 0.08, thick: 0.25, inner: 0.9, rim: 1.05, tint: 0.15 },
      B.ell(shins[i], s * 1.27, -2.15, 0.25, 0.22, 0),
      B.cap(shins[i], s * 1.33, -2.3, s * 1.7, -2.95, 0.28, 0.18),
    );
  }

  /* ---------------- side warriors (behind the centre one) ---------------- */
  const W: Record<string, Warrior> = {};
  for (const [i, sd] of side.entries()) {
    const s = sd.s;
    const tag = s < 0 ? 'L' : 'R';
    const a = armS[i];
    // shield arm (behind the torso so the shoulder line stays clean)
    B.part(
      `shieldArm${tag}`,
      { z: -0.3, k: 0.1, thick: 0.25, inner: 0.6, bright: 0.85 },
      B.cap(a.shU, ...a.sh, s * 2.78, -0.08, 0.24, 0.19),
      B.cap(a.shF, s * 2.78, -0.08, s * 3.4, 0.3, 0.18, 0.15),
    );
    const w = warrior(B, sd.torso, sd.head, sd.crest, sd.F);
    W[tag] = w;
    B.part(`torso${tag}`, { z: -0.25, k: 0.12, thick: 0.5, inner: 0.6, bright: 0.95 }, ...w.torso);
    B.part(`helm${tag}`, { z: -0.2, k: 0.08, thick: 0.35, inner: 0.85, tint: 0.1, bright: 1.0, rim: 1.1 }, ...w.helm);
    B.part(`visor${tag}`, { z: -0.15, k: 0.02, thick: 0.1, fill: 0.04, bright: 0.8, inner: 1.3 }, ...w.visor);
    // low spear arm, emerging from behind the centre warrior
    B.part(
      `lowArm${tag}`,
      { z: -0.05, k: 0.08, thick: 0.3, inner: 0.7, bright: 0.95 },
      B.cap(a.spU, s * 0.66, 0.42, s * 1.42, -0.42, 0.22, 0.18),
      B.cap(a.spF, s * 1.42, -0.42, s * 2.02, -0.88, 0.17, 0.14),
      B.ell(a.spF, s * 2.06, -0.94, 0.15, 0.14),
      ...spear(B, a.spF, s * 1.4, -0.3, s * 3.75, -2.85),
    );
  }

  /* ---------------- centre warrior ---------------- */
  const wc = warrior(B, torsoC, headC, crestC, FC);
  W.C = wc;
  B.part('torsoC', { z: 0.1, k: 0.12, thick: 0.55, inner: 0.6 }, ...wc.torso);
  B.part('helmC', { z: 0.15, k: 0.08, thick: 0.4, inner: 0.9, tint: 0.12, rim: 1.15 }, ...wc.helm);
  B.part('visorC', { z: 0.2, k: 0.02, thick: 0.1, fill: 0.04, bright: 0.85, inner: 1.35 }, ...wc.visor);
  for (const a of armC) {
    const s = a.s;
    B.part(
      s < 0 ? 'armCL' : 'armCR',
      { z: 0.2, k: 0.08, thick: 0.3, inner: 0.75 },
      B.cap(a.up, s * 0.86, 1.15, s * 1.32, 1.72, 0.23, 0.18),
      B.cap(a.fore, s * 1.32, 1.72, s * 1.16, 2.36, 0.17, 0.14),
      B.ell(a.fore, s * 1.15, 2.42, 0.15, 0.14),
      ...spear(B, a.fore, s * 0.95, 1.55, s * 1.5, 3.42),
    );
  }
  // war skirt (pteruges) + belt, in front of the waist where the three bodies join
  B.part(
    'skirt',
    { z: 0.3, k: 0.04, thick: 0.3, inner: 0.85, flow: Flow.Wisp, tint: 0.05 },
    B.poly(pelvis, [-0.64, -0.4, 0.64, -0.4, 0.8, -0.82, 1.02, -1.36, 0.84, -1.46, 0.62, -1.32, 0.4, -1.5, 0.15, -1.36, -0.15, -1.36, -0.4, -1.5, -0.62, -1.32, -0.84, -1.46, -1.02, -1.36, -0.8, -0.82], 0.02, 0),
    B.cap(pelvis, -0.68, -0.42, 0.68, -0.42, 0.1, 0.1),
  );
  // round shields (aspis), held out to the sides
  for (const a of armS) {
    const s = a.s;
    B.part(
      s < 0 ? 'shieldL' : 'shieldR',
      { z: 0.35, k: 0.02, thick: 0.2, inner: 1.0, rim: 1.2, tint: 0.15, fill: 0.85 },
      B.circle(a.shF, s * 3.72, 0.32, 0.95),
      B.circle(a.shF, s * 3.72, 0.32, 0.16),
    );
  }

  /* ---------------- detail filaments ---------------- */
  for (const tag of ['L', 'C', 'R']) {
    const w = W[tag];
    const F = w.F;
    const part = `torso${tag}`;
    // sculpted cuirass: pecs + abdominal line
    B.stroke(F.L([-0.62, 1.48, -0.3, 1.32, 0.0, 1.38, 0.3, 1.32, 0.62, 1.48]), { part, w: 0.022, bright: 0.6 });
    B.stroke(F.L([0, 1.25, 0, 0.75, 0, 0.25]), { part, w: 0.018, bright: 0.45 });
    B.stroke(F.L([-0.45, 0.85, 0.0, 0.78, 0.45, 0.85]), { part, w: 0.016, bright: 0.35 });
    B.stroke(F.L([-0.42, 0.42, 0.0, 0.36, 0.42, 0.42]), { part, w: 0.016, bright: 0.3 });
    // crest horsehair
    const cp = `helm${tag}`;
    for (const k of [-0.36, -0.18, 0, 0.18, 0.36]) B.stroke(F.L([0, 3.28, k * 0.5, 3.6, k, 3.97]), { part: cp, w: 0.014, bright: 0.65, flow: Flow.Wisp });
    // brow ridge of the helm
    B.stroke(F.L([-0.36, 2.84, 0.0, 2.92, 0.36, 2.84]), { part: cp, w: 0.018, bright: 0.8 });
    // eyes burning in the dark slit
    B.stroke(F.L([-0.25, 2.65, -0.13, 2.645]), { part: `visor${tag}`, w: 0.026, bright: 2.2, tint: 0.9, smooth: 0 });
    B.stroke(F.L([0.13, 2.645, 0.25, 2.65]), { part: `visor${tag}`, w: 0.026, bright: 2.2, tint: 0.9, smooth: 0 });
  }
  // skirt strips
  for (const x of [-0.62, -0.3, 0.0, 0.3, 0.62]) B.stroke([x * 0.9, -0.55, x * 1.25, -1.3], { part: 'skirt', w: 0.014, bright: 0.45, smooth: 0 });
  // shield rims + blazons
  for (const a of armS) {
    const s = a.s;
    const pn = s < 0 ? 'shieldL' : 'shieldR';
    const ring: number[] = [];
    for (let k = 0; k <= 28; k++) {
      const t = (k / 28) * Math.PI * 2;
      ring.push(s * 3.72 + Math.cos(t) * 0.8, 0.32 + Math.sin(t) * 0.8);
    }
    B.stroke(ring, { part: pn, w: 0.02, bright: 0.75, smooth: 0 });
    // blazon: a triskelion
    for (let k = 0; k < 3; k++) {
      const t0 = (k / 3) * Math.PI * 2 + 0.3;
      const pts: number[] = [];
      for (let j = 0; j <= 5; j++) {
        const rr = 0.18 + j * 0.09;
        const tt = t0 + j * 0.22;
        pts.push(s * 3.72 + Math.cos(tt) * rr * s, 0.32 + Math.sin(tt) * rr);
      }
      B.stroke(pts, { part: pn, w: 0.02, bright: 0.65, taper: 0.6 });
    }
  }

  /* ---------------- key stars ---------------- */
  B.star('heart', 0, 0.55, 1.6, { part: 'torsoC' });
  B.star('waist', 0, -0.45, 1.0, { part: 'skirt' });
  for (const tag of ['L', 'C', 'R']) {
    const w = W[tag];
    B.star(`helm${tag}`, ...w.F.T(0, 2.82), tag === 'C' ? 1.25 : 1.05, { part: `helm${tag}` });
    B.star(`crest${tag}`, ...w.crestTop, 0.85, { part: `helm${tag}` });
    if (tag !== 'C') B.star(`chest${tag}`, ...w.chest, 0.9, { part: `torso${tag}` });
  }
  for (const a of armC) {
    const tag = a.s < 0 ? 'L' : 'R';
    B.star(`fistC${tag}`, a.s * 1.15, 2.42, 0.75, { part: `armC${tag}` });
    B.star(`tipC${tag}`, a.s * 1.47, 3.32, 0.95, { part: `armC${tag}` });
  }
  for (const a of armS) {
    const tag = a.s < 0 ? 'L' : 'R';
    B.star(`boss${tag}`, a.s * 3.72, 0.32, 1.35, { part: `shield${tag}` });
    B.star(`hand${tag}`, a.s * 2.06, -0.94, 0.7, { part: `lowArm${tag}` });
    B.star(`tip${tag}`, a.s * 3.67, -2.75, 0.9, { part: `lowArm${tag}` });
    B.star(`knee${tag}`, a.s * 1.27, -2.15, 0.75, { part: `greave${tag}` });
    B.star(`foot${tag}`, a.s * 1.92, -3.1, 0.85, { part: `leg${tag}` });
  }
  B.link('crestC', 'helmC', 'heart', 'waist');
  for (const tag of ['L', 'R']) {
    B.link(`crest${tag}`, `helm${tag}`, `chest${tag}`, 'waist');
    B.link(`chest${tag}`, `boss${tag}`);
    B.link(`chest${tag}`, `hand${tag}`, `tip${tag}`);
    B.link('heart', `fistC${tag}`, `tipC${tag}`);
    B.link('waist', `knee${tag}`, `foot${tag}`);
  }

  B.core = P(0, 0.55);
  B.head = P(...wc.head, 0.5);
  // mouth 0 (roar / heavy impact) = the centre helm; volleys are hurled from the four spear points
  B.mouths.push(P(...wc.F.T(0, 2.3), 0.5), P(-1.47, 3.32, 0.4), P(1.47, 3.32, 0.4), P(-3.67, -2.75, 0.4), P(3.67, -2.75, 0.4));

  return B.build('geryon', (p, c) => {
    const t = c.t;
    const br = c.breath;
    const fwd = Math.max(0, c.lunge);
    const back = Math.max(0, -c.lunge);
    const sway = 0.85;
    // six-armed barrage: pulse 0 hurls the raised spears, pulse 1 thrusts the low spears, pulse 2 both
    const hurl = c.volley * (c.pulseIdx === 1 ? 0.25 : 1);
    const thrust = c.volley * (c.pulseIdx === 0 ? 0.25 : 1);
    // pelvis: settle / brace
    p.o(pelvis, 0, 0.025 * br - 0.12 * back + 0.05 * fwd - 0.1 * c.low, 0);
    // centre torso: breathe, lean back on the wind-up, drive forward on the strike
    p.s(torsoC, 1 + 0.012 * br, 1 + 0.02 * br);
    p.r(torsoC, 0.025 * Math.sin(t * sway) + 0.03 * c.hurt);
    p.r(headC, 0.04 * Math.sin(t * 0.55 + 0.5) - 0.06 * c.low);
    p.r(crestC, 0.05 * Math.sin(t * 1.3));
    // side torsos sway out of phase; fan out on the wind-up / roar, close in on the strike, droop when low
    for (const sd of side) {
      const s = sd.s;
      const ph = s < 0 ? 2.1 : 4.2;
      p.s(sd.torso, 1 + 0.012 * Math.sin(t * 1.3 + ph), 1 + 0.02 * Math.sin(t * 1.3 + ph));
      p.r(sd.torso, -s * (0.055 * Math.sin(t * sway + ph) + 0.1 * back + 0.08 * c.roar - 0.12 * fwd + 0.05 * c.hurt + 0.12 * c.low - 0.05 * c.guard));
      p.r(sd.head, -s * (0.07 * Math.sin(t * 0.6 + ph) + 0.12 * c.roar) + s * 0.1 * c.low);
      p.r(sd.crest, 0.05 * Math.sin(t * 1.2 + ph));
    }
    // raised spears: brandish; cock back on the wind-up, hurl down on the strike
    for (const a of armC) {
      const s = a.s;
      const ph = s < 0 ? 0 : 1.7;
      p.r(a.up, -s * (0.07 * Math.sin(t * 1.1 + ph) + 0.25 * back - 0.55 * fwd + 0.15 * c.roar + 0.25 * c.low - 0.3 * hurl));
      p.r(a.fore, -s * (0.06 * Math.sin(t * 1.1 + ph + 0.8) + 0.2 * back - 0.5 * fwd + 0.1 * c.charge - 0.35 * hurl));
    }
    // shields rise to cover the side heads on guard ("Shield Wall"); low spears thrust out on the strike
    for (const a of armS) {
      const s = a.s;
      const ph = s < 0 ? 0.9 : 2.6;
      p.r(a.shU, -s * (0.06 * Math.sin(t * 0.9 + ph) + 0.1 * back - 0.06 * fwd - 0.55 * c.guard + 0.12 * c.low));
      p.r(a.shF, -s * (0.05 * Math.sin(t * 0.9 + ph + 0.6) - 0.35 * c.guard));
      p.r(a.spU, -s * (0.06 * Math.sin(t * 1.0 + ph + 1.4) + 0.15 * back - 0.25 * fwd - 0.28 * thrust));
      p.r(a.spF, -s * (0.05 * Math.sin(t * 1.0 + ph + 2.0) + 0.1 * back - 0.3 * fwd - 0.2 * thrust));
    }
    // legs: wide stance, knees bend on the wind-up
    for (const [i, th] of thighs.entries()) {
      const s = i === 0 ? -1 : 1;
      // brace: knees bow outward on the wind-up, the shins compensate so the feet stay planted
      p.r(th, s * (0.008 * br + 0.06 * back));
      p.r(shins[i], -s * (0.008 * br + 0.08 * back));
    }
  });
}

/** auto-registered by ./index.ts */
export const CREATURE: CreatureModule = { id: 'geryon', build: buildGeryon };
