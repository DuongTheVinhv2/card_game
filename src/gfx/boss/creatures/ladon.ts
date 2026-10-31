import { Builder, Flow, P, deg, pulse, type CreatureDef } from '../rig';
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
  return { T, L, A, s, m };
}

/** scalloped cloud outline (foliage clumps) */
function cloud(cx: number, cy: number, rx: number, ry: number, bumps: number, depth: number, phase: number): number[] {
  const out: number[] = [];
  const n = bumps * 4;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2 + phase;
    const b = Math.abs(Math.sin((i / n) * Math.PI * bumps));
    const k = 1 - depth + depth * Math.sqrt(b);
    out.push(cx + Math.cos(t) * rx * k, cy + Math.sin(t) * ry * k);
  }
  return out;
}

interface DragonHead {
  head: Prim[];
  jaw: Prim[];
  eyes: V2[];
  mouth: V2;
  center: V2;
  brows: number[][];
  fangs: number[][];
  jawFangs: number[][];
}

/** horned dragon head in profile (snout toward -x before mirroring), origin at the neck joint */
function dragonHead(B: Builder, head: number, jaw: number, ox: number, oy: number, ang: number, s: number, mirror: boolean, gape: number): DragonHead {
  const F = frame(ox, oy, ang, s, mirror);
  const r = (v: number) => v * s;
  const g = gape * deg;
  // the lower jaw is authored already agape: rotate its local points about the hinge
  const G = (pts: number[]) => {
    const o: number[] = [];
    for (let i = 0; i < pts.length; i += 2) {
      const dx = pts[i] + 0.25;
      const dy = pts[i + 1] + 0.12;
      o.push(-0.25 + dx * Math.cos(g) - dy * Math.sin(g), -0.12 + dx * Math.sin(g) + dy * Math.cos(g));
    }
    return o;
  };
  const headP: Prim[] = [
    // bulky wedge skull + heavy snout
    B.poly(head, F.L([0.14, 0.26, -0.1, 0.46, -0.4, 0.5, -0.62, 0.4, -0.86, 0.31, -1.08, 0.27, -1.22, 0.19, -1.27, 0.06, -1.21, -0.06, -0.95, -0.1, -0.6, -0.14, -0.25, -0.2, 0.12, -0.2]), r(0.025), 3),
    // brow ridge
    B.ell(head, ...F.T(-0.52, 0.45), r(0.21), r(0.1), F.A(-12)),
    // swept-back horns
    B.cap(head, ...F.T(-0.3, 0.48), ...F.T(0.34, 0.84), r(0.11), r(0.05)),
    B.cap(head, ...F.T(0.34, 0.84), ...F.T(0.72, 0.9), r(0.05), r(0.01)),
    B.cap(head, ...F.T(-0.08, 0.34), ...F.T(0.58, 0.5), r(0.08), r(0.012)),
    // cheek spike
    B.tri(head, ...F.T(0.02, -0.04), ...F.T(0.06, -0.24), ...F.T(0.44, -0.3), r(0.008)),
    // upper fang
    B.tri(head, ...F.T(-1.14, -0.05), ...F.T(-1.05, -0.07), ...F.T(-1.1, -0.32), r(0.008)),
  ];
  const jawP: Prim[] = [
    B.poly(jaw, F.L(G([-0.22, -0.15, -0.6, -0.2, -0.95, -0.24, -1.14, -0.28, -1.12, -0.39, -0.8, -0.47, -0.45, -0.47, -0.1, -0.34])), r(0.02), 3),
    B.poly(jaw, F.L(G([-1.06, -0.27, -0.98, -0.26, -1.03, -0.05])), r(0.008), 0),
  ];
  return {
    head: headP,
    jaw: jawP,
    eyes: [F.T(-0.62, 0.27)],
    mouth: F.T(...(G([-0.98, -0.2]) as V2)),
    center: F.T(-0.5, 0.05),
    brows: [F.L([-0.86, 0.33, -0.64, 0.4, -0.4, 0.39])],
    fangs: [F.L([-1.1, -0.06, -1.1, -0.3])],
    jawFangs: [F.L(G([-1.02, -0.26, -1.02, -0.07]))],
  };
}

interface NeckSpec {
  name: string;
  /** helix angle where the neck leaves the coil */
  th: number;
  pts: number[];
  ang: number;
  s: number;
  mirror: boolean;
  gape: number;
  z: number;
  radii: number[];
}

/** XI. Ladon — the many-headed serpent-dragon coiled around the Tree of the Hesperides, guarding its golden apples. */
export function buildLadon(): CreatureDef {
  const B = new Builder();
  B.facing = 0;
  const R = B.ROOT;
  const tree = B.bone('tree', R, 0, -3.0);
  const brL = B.bone('branchL', tree, -0.25, 1.2);
  const brR = B.bone('branchR', tree, 0.25, 1.2);
  const brC = B.bone('branchC', tree, 0.0, 1.3);

  /* ---------------- serpent coil (helix around the trunk) ---------------- */
  const RX = 0.95;
  const th0 = Math.PI / 2;
  const th1 = 6 * Math.PI;
  const y0 = -2.72;
  const y1 = 0.72;
  const helix = (th: number): V2 => [RX * Math.sin(th), y0 + ((y1 - y0) * (th - th0)) / (th1 - th0)];
  const radAt = (th: number) => 0.34 - (0.07 * (th - th0)) / (th1 - th0);
  // coil bones hang from the tree independently (offsets must not accumulate up the helix);
  // they pivot on the trunk axis so scaling X constricts the coil around the trunk
  const NCOIL = 6;
  const coil: number[] = [];
  const coilY: number[] = [];
  for (let i = 0; i < NCOIL; i++) {
    coilY.push(helix(th0 + ((th1 - th0) * i) / NCOIL)[1]);
    coil.push(B.bone(`coil${i}`, tree, 0, coilY[i]));
  }
  const coilIdx = (th: number) => Math.max(0, Math.min(NCOIL - 1, Math.floor(((th - th0) / (th1 - th0)) * NCOIL)));
  const coilBone = (th: number) => coil[coilIdx(th)];
  const front: Prim[] = [];
  const back: Prim[] = [];
  const STEPS = 66;
  for (let i = 0; i < STEPS; i++) {
    const ta = th0 + ((th1 - th0) * i) / STEPS;
    const tb = th0 + ((th1 - th0) * (i + 1)) / STEPS;
    const tm = (ta + tb) / 2;
    const [ax, ay] = helix(ta);
    const [bx, by] = helix(tb);
    const prim = B.cap(coilBone(tm), ax, ay, bx, by, radAt(ta), radAt(tb));
    (Math.cos(tm) > 0 ? front : back).push(prim);
  }
  // tail: leaves the bottom coil to the right and trails along the roots, tip curling up
  const tailPts = [RX, y0, 1.7, -3.0, 2.55, -3.12, 3.3, -3.0, 3.75, -2.62, 3.7, -2.25];
  const tail = B.chain('tail', tree, tailPts);

  /* ---------------- necks + heads ---------------- */
  // heads branch off the coil where it turns around the trunk, spiralling up the tree; the main head crowns the coil
  const edge = (k: number) => helix(Math.PI / 2 + k * Math.PI);
  const [eR1x, eR1y] = edge(2); // right turn, low
  const [eL1x, eL1y] = edge(3); // left turn, middle
  const [eR2x, eR2y] = edge(4); // right turn, high
  const [eL2x, eL2y] = edge(5); // left turn, top
  const specs: NeckSpec[] = [
    { name: 'E', th: 2.5 * Math.PI, pts: [eR1x + 0.15, eR1y + 0.02, 1.75, eR1y + 0.2, 2.4, eR1y + 0.72, 2.95, eR1y + 0.85], ang: -8, s: 1.08, mirror: true, gape: 20, z: 0.28, radii: [0.23, 0.18, 0.15, 0.14] },
    { name: 'B', th: 3.5 * Math.PI, pts: [eL1x - 0.15, eL1y + 0.02, -1.75, eL1y + 0.25, -2.35, eL1y + 0.8, -2.95, eL1y + 0.92], ang: 6, s: 1.1, mirror: false, gape: 22, z: 0.3, radii: [0.23, 0.18, 0.15, 0.14] },
    { name: 'D', th: 4.5 * Math.PI, pts: [eR2x + 0.15, eR2y + 0.02, 1.7, eR2y + 0.3, 2.15, eR2y + 0.9, 2.72, eR2y + 1.15], ang: 10, s: 1.02, mirror: true, gape: 18, z: 0.32, radii: [0.22, 0.17, 0.145, 0.135] },
    { name: 'A', th: 5.5 * Math.PI, pts: [eL2x - 0.15, eL2y + 0.02, -1.6, eL2y + 0.35, -1.95, eL2y + 0.92, -2.5, eL2y + 1.18], ang: -12, s: 1.02, mirror: false, gape: 20, z: 0.34, radii: [0.22, 0.17, 0.145, 0.135] },
    { name: 'C', th: 6 * Math.PI - 1e-3, pts: [0.0, 0.66, -0.34, 1.02, -0.3, 1.38, 0.06, 1.62], ang: 14, s: 1.25, mirror: true, gape: 24, z: 0.55, radii: [0.3, 0.27, 0.24, 0.22] },
  ];
  const necks = specs.map((sp) => {
    // necks hang from the tree (not the coil bones, whose X-scale would squash the heads); their bases follow the coil in animate()
    const chain = B.chain(`neck${sp.name}`, tree, sp.pts);
    const n = sp.pts.length / 2;
    const hx = sp.pts[(n - 1) * 2];
    const hy = sp.pts[(n - 1) * 2 + 1];
    const head = B.bone(`head${sp.name}`, chain[chain.length - 1], hx, hy);
    const jaw = B.bone(`jaw${sp.name}`, head, ...frame(hx, hy, sp.ang, sp.s, sp.mirror).T(-0.25, -0.12));
    return { sp, chain, head, jaw, hx, hy, ci: coilIdx(sp.th), bx: sp.pts[0], by: sp.pts[1] };
  });

  /* ---------------- parts (back to front) ---------------- */
  // foliage of the Tree of the Hesperides
  const lobes: [number, number, number, number, number][] = [
    [-2.92, 2.7, 1.0, 0.5, 6],
    [-1.42, 3.0, 1.0, 0.46, 6],
    [0.0, 3.12, 0.95, 0.38, 6],
    [1.44, 3.02, 1.0, 0.46, 6],
    [2.94, 2.72, 1.0, 0.48, 6],
  ];
  B.part(
    'canopy',
    { z: -0.6, k: 0.18, thick: 0.45, flow: Flow.Wisp, bright: 0.55, fill: 0.7, inner: 0.45, rim: 0.85, tint: -0.25, blend: 0.4 },
    ...lobes.map(([cx, cy, rx, ry, nb], i) => B.poly(cx < -0.5 ? brL : cx > 0.5 ? brR : brC, cloud(cx, cy, rx, ry, nb, 0.1, i * 0.7), 0.02, 2)),
  );
  B.part('coilBack', { z: -0.35, k: 0.06, thick: 0.3, bright: 0.62, rim: 0.95, inner: 0.4, tint: 0.05, blend: 0.3 }, ...back);
  B.part(
    'tree',
    { z: -0.2, k: 0.16, thick: 0.45, inner: 0.45, bright: 0.45, rim: 0.75, tint: -0.32, fill: 0.8, blend: 0.3 },
    // gnarled trunk forking straight into the crown
    B.poly(
      tree,
      [-1.85, -3.3, -1.2, -3.08, -0.72, -2.8, -0.5, -2.36, -0.42, -1.6, -0.37, -0.6, -0.38, 0.3, -0.4, 1.0, -0.42, 1.5, -0.56, 1.86, -0.82, 2.2, -1.0, 2.52, -0.72, 2.58, -0.46, 2.22, -0.22, 2.02, -0.14, 2.42, 0.0, 2.72, 0.14, 2.42, 0.22, 2.02, 0.46, 2.22, 0.74, 2.58, 1.02, 2.52, 0.84, 2.2, 0.58, 1.86, 0.44, 1.5, 0.4, 1.0, 0.38, 0.3, 0.37, -0.6, 0.42, -1.6, 0.5, -2.36, 0.74, -2.8, 1.22, -3.06, 1.8, -3.28, 0.95, -3.22, 0.42, -3.34, 0.0, -3.22, -0.42, -3.36, -0.95, -3.22],
      0.03,
      3,
    ),
  );
  // golden apples
  const apples: [number, number, number][] = [
    [-3.35, 2.22, brL],
    [-2.42, 2.3, brL],
    [-1.5, 2.55, brL],
    [-0.62, 2.72, brC],
    [0.62, 2.78, brC],
    [1.52, 2.58, brR],
    [2.45, 2.32, brR],
    [3.38, 2.26, brR],
  ];
  B.part(
    'apples',
    { z: 0.0, k: 0.01, thick: 0.12, rim: 1.4, tint: 0.55, fill: 1.4, inner: 1.2 },
    ...apples.map(([x, y, b]) => B.circle(b, x, y, 0.13)),
    ...apples.map(([x, y, b]) => B.cap(b, x, y + 0.1, x + 0.03, y + 0.2, 0.018, 0.012)),
  );
  B.part('coilFront', { z: 0.2, k: 0.06, thick: 0.35, rim: 1.25, inner: 1.0, bright: 1.1, blend: 0.3, tint: 0.22 }, ...front);
  B.part('tail', { z: 0.25, k: 0.05, thick: 0.25, inner: 0.9, rim: 1.15, bright: 1.05, tint: 0.18, blend: 0.2 }, B.tube(tail, tailPts, [0.32, 0.24, 0.17, 0.1, 0.06, 0.03]));

  const heads: Record<string, DragonHead> = {};
  for (const n of necks) {
    const sp = n.sp;
    const hd = dragonHead(B, n.head, n.jaw, n.hx, n.hy, sp.ang, sp.s, sp.mirror, sp.gape);
    heads[sp.name] = hd;
    // the main head (crowning the coil) glows a little hotter
    const hi = sp.name === 'C' ? 1.15 : 1;
    B.part(`jaw${sp.name}`, { z: sp.z, k: 0.04, thick: 0.2, inner: 1.0, rim: 1.2 * hi, bright: 1.1, tint: 0.2 * hi }, ...hd.jaw);
    B.part(
      `neck${sp.name}`,
      { z: sp.z + 0.05, k: 0.1, thick: 0.3, inner: 0.95 * hi, rim: 1.25 * hi, bright: 1.1, tint: 0.25 * hi, fill: 1.1 * hi, blend: 0.18 },
      B.tube(n.chain, sp.pts, sp.radii),
      ...hd.head,
    );
  }

  /* ---------------- detail filaments ---------------- */
  // leafy texture: a soft arc of foliage inside each clump of the crown
  for (const [cx, cy, rx, ry] of lobes) {
    const arc: number[] = [];
    for (let j = 0; j <= 8; j++) {
      const a = (Math.PI * (0.18 + 0.64 * (j / 8)));
      arc.push(cx + Math.cos(a) * rx * 0.68, cy + Math.sin(a) * ry * 0.5 - ry * 0.08);
    }
    B.stroke(arc, { part: 'canopy', w: 0.022, bright: 0.7, flow: Flow.Wisp, smooth: 0 });
  }
  // bark
  B.stroke([-0.2, -2.9, -0.15, -2.0, -0.22, -1.2, -0.15, -0.3, -0.2, 0.6, -0.15, 1.1], { part: 'tree', w: 0.016, bright: 0.25 });
  B.stroke([0.18, -2.7, 0.22, -1.8, 0.16, -0.9, 0.22, 0.1, 0.18, 1.0], { part: 'tree', w: 0.014, bright: 0.22 });
  // belly scales along the front crossings of the coil
  for (let k = 0; k < 3; k++) {
    const ta = 1.5 * Math.PI + k * 2 * Math.PI;
    const span = k === 2 ? 0.5 : 1;
    const pts: number[] = [];
    for (let j = 0; j <= 10; j++) {
      const th = ta + Math.PI * span * (j / 10);
      const [x, y] = helix(th);
      pts.push(x, y - radAt(th) * 0.35);
    }
    B.stroke(pts, { part: 'coilFront', w: 0.02, bright: 0.55, smooth: 0 });
  }
  for (const n of necks) {
    const hd = heads[n.sp.name];
    const pn = `neck${n.sp.name}`;
    B.stroke(n.sp.pts, { part: pn, w: 0.02, bright: 0.6, smooth: 6 });
    for (const b of hd.brows) B.stroke(b, { part: pn, w: 0.02, bright: 1.0, smooth: 3 });
    for (const f of hd.fangs) B.stroke(f, { part: pn, w: 0.014, bright: 1.5, tint: 0.7, smooth: 0, taper: 0.8 });
    for (const f of hd.jawFangs) B.stroke(f, { part: `jaw${n.sp.name}`, w: 0.014, bright: 1.3, tint: 0.7, smooth: 0, taper: 0.8 });
  }

  /* ---------------- key stars ---------------- */
  apples.forEach(([x, y], i) => B.star(`apple${i}`, x, y, i === 3 || i === 4 ? 1.35 : 1.15, { gold: true, part: 'apples', z: 0.2 }));
  B.star('root', 0, -3.05, 0.9, { part: 'tree' });
  B.star('tailtip', 3.72, -2.3, 0.75, { part: 'tail' });
  B.star('coil1', ...helix(2 * Math.PI), 1.0, { part: 'coilFront' });
  B.star('coil2', ...helix(4 * Math.PI), 1.1, { part: 'coilFront' });
  B.star('heart', ...helix(5.8 * Math.PI), 1.5, { part: 'coilFront' });
  for (const n of necks) {
    const nm = n.sp.name;
    heads[nm].eyes.forEach((e, k) => B.star(`eye${nm}${k}`, ...e, nm === 'C' ? 1.2 : 1.15, { part: `neck${nm}` }));
    B.star(`mid${nm}`, n.sp.pts[2], n.sp.pts[3], 0.65, { part: `neck${nm}` });
  }
  B.link('apple0', 'apple1', 'apple2', 'apple3', 'apple4', 'apple5', 'apple6', 'apple7');
  B.link('tailtip', 'root', 'coil1', 'coil2', 'heart', 'midC', 'eyeC0');
  B.link('coil1', 'midE', 'eyeE0');
  B.link('coil2', 'midB', 'eyeB0');
  B.link('coil2', 'midD', 'eyeD0');
  B.link('heart', 'midA', 'eyeA0');

  B.core = P(0, 0.4);
  B.head = P(...heads.C.center, 0.6);
  B.mouths.push(...['C', 'B', 'E', 'A', 'D'].map((k) => P(...heads[k].mouth, 0.5)));

  return B.build('ladon', (p, c) => {
    const t = c.t;
    const br = c.breath;
    const fwd = Math.max(0, c.lunge);
    const back = Math.max(0, -c.lunge);
    // the tree sways gently; branches rustle
    p.r(tree, 0.006 * Math.sin(t * 0.5));
    p.r(brL, 0.02 * Math.sin(t * 0.8 + 0.5) + 0.03 * c.hurt);
    p.r(brR, -0.02 * Math.sin(t * 0.75 + 1.7) - 0.03 * c.hurt);
    p.r(brC, 0.015 * Math.sin(t * 0.9 + 2.4));
    // coils: slow slither; constrict around the trunk when charging, guarding, and crushing (drain)
    const cm = coil.map((_, i) => {
      const ph = t * 1.1 - i * 0.9;
      const crush = c.drain * (0.5 + 0.5 * Math.sin(t * 9 - i * 1.3));
      return {
        dx: 0.035 * Math.sin(ph),
        dy: 0.02 * Math.cos(ph) + 0.015 * br - 0.06 * c.low - 0.05 * c.guard,
        sx: 1 - 0.04 * c.charge - 0.02 * Math.sin(ph + 1.2) - 0.12 * crush - 0.06 * c.guard,
        sy: 1 + 0.04 * crush,
      };
    });
    coil.forEach((b, i) => {
      p.o(b, cm[i].dx, cm[i].dy, 0);
      p.s(b, cm[i].sx, cm[i].sy);
    });
    // heads weave out of phase; rear back on the wind-up, strike out on the lunge
    necks.forEach((n, i) => {
      const sp = n.sp;
      const ph = i * 1.37;
      const snap = pulse(t, 3.4 + i * 0.6, ph, 0.45);
      const side = sp.mirror ? -1 : 1; // +1 = head faces left
      // keep the neck base glued to its coil (coil pivot is on the trunk axis at coilY)
      const m = cm[n.ci];
      p.o(n.chain[0], m.dx + n.bx * (m.sx - 1), m.dy + (n.by - coilY[n.ci]) * (m.sy - 1), 0);
      p.wave(n.chain, 0.045 * (1 + 0.6 * c.charge), t, 1.3 + 0.15 * i, 0.9, 0.25);
      // side > 0: neck reaches left, so CW lifts it; mirrored necks lift with CCW
      p.r(n.chain[0], side * (-0.12 * back + 0.1 * fwd - 0.12 * c.roar + 0.08 * c.low - 0.1 * c.guard) + 0.03 * Math.sin(t * 0.6 + ph));
      p.r(n.chain[n.chain.length - 1], side * (-0.1 * back + 0.18 * fwd) + side * 0.08 * c.hurt);
      p.r(n.head, side * (0.08 * Math.sin(t * 1.6 + ph) + 0.12 * snap - 0.22 * c.roar + 0.08 * c.low - 0.1 * back + 0.12 * fwd));
      p.r(n.jaw, side * (0.04 + 0.04 * Math.sin(t * 2.2 + ph) + 0.35 * snap * (1 - c.mouth) + 0.4 * c.mouth + 0.1 * c.charge));
    });
    // tail rattles along the roots
    p.wave(tail, 0.06 * (1 + c.charge), t, 2.4, 0.8, 0.5);
  });
}

/** auto-registered by ./index.ts */
export const CREATURE: CreatureModule = { id: 'ladon', build: buildLadon };
