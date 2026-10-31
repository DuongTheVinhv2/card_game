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
  /** local ellipse angle -> world angle */
  const A = (localDeg: number) => angDeg + m * localDeg;
  return { T, L, A, s };
}

/** point + unit tangent at fraction u along a polyline (flat x,y) */
function along(pts: number[], u: number): [number, number, number, number] {
  const n = pts.length / 2;
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < n; i++) {
    const l = Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
    seg.push(l);
    total += l;
  }
  let s = u * total;
  for (let i = 1; i < n; i++) {
    const l = seg[i - 1];
    if (s <= l || i === n - 1) {
      const f = l > 0 ? Math.min(1, s / l) : 0;
      const ax = pts[i * 2 - 2];
      const ay = pts[i * 2 - 1];
      const dx = pts[i * 2] - ax;
      const dy = pts[i * 2 + 1] - ay;
      const ll = Math.hypot(dx, dy) || 1;
      return [ax + dx * f, ay + dy * f, dx / ll, dy / ll];
    }
    s -= l;
  }
  return [pts[0], pts[1], 1, 0];
}

interface HoundHead {
  head: Prim[];
  jaw: Prim[];
  eye: V2;
  nose: V2;
  brow: number[];
  snarl: number[];
  fangs: number[][];
  mouth: V2;
  center: V2;
}

/** canine head in profile (snout toward -x in local space), origin at the neck joint */
function houndHead(B: Builder, head: number, jaw: number, ox: number, oy: number, ang: number, s: number, gape: number): HoundHead {
  const F = frame(ox, oy, ang, s);
  // the lower jaw is authored already agape: rotate its local points about the hinge
  const g = gape * deg;
  const G = (pts: number[]) => {
    const o: number[] = [];
    for (let i = 0; i < pts.length; i += 2) {
      const dx = pts[i] + 0.46;
      const dy = pts[i + 1] + 0.13;
      o.push(-0.46 + dx * Math.cos(g) - dy * Math.sin(g), -0.13 + dx * Math.sin(g) + dy * Math.cos(g));
    }
    return o;
  };
  const r = (v: number) => v * s;
  const headP: Prim[] = [
    // cranium
    B.ell(head, ...F.T(-0.42, 0.1), r(0.5), r(0.42), F.A(-6)),
    // heavy muzzle
    B.poly(head, F.L([-0.68, 0.34, -1.1, 0.25, -1.45, 0.17, -1.6, 0.11, -1.67, 0.0, -1.6, -0.1, -1.3, -0.17, -0.9, -0.2, -0.55, -0.16, -0.3, -0.12]), r(0.03), 3),
    // near ear (pointed, laid back)
    B.poly(head, F.L([-0.34, 0.4, -0.12, 0.62, 0.14, 0.86, 0.06, 0.56, -0.02, 0.38]), r(0.02), 2),
    // far ear
    B.poly(head, F.L([-0.6, 0.42, -0.5, 0.6, -0.36, 0.74, -0.34, 0.55, -0.4, 0.42]), r(0.02), 2),
    // upper fangs
    B.tri(head, ...F.T(-1.5, -0.12), ...F.T(-1.4, -0.14), ...F.T(-1.46, -0.44), r(0.012)),
    B.tri(head, ...F.T(-1.12, -0.18), ...F.T(-1.03, -0.19), ...F.T(-1.08, -0.35), r(0.01)),
  ];
  const jawP: Prim[] = [
    B.poly(jaw, F.L(G([-0.45, -0.12, -0.85, -0.2, -1.2, -0.24, -1.42, -0.28, -1.46, -0.36, -1.25, -0.43, -0.85, -0.46, -0.5, -0.43, -0.25, -0.3])), r(0.02), 3),
    B.poly(jaw, F.L(G([-1.38, -0.28, -1.29, -0.27, -1.34, -0.04])), r(0.01), 0),
    B.poly(jaw, F.L(G([-1.0, -0.24, -0.93, -0.24, -0.97, -0.1])), r(0.008), 0),
  ];
  return {
    head: headP,
    jaw: jawP,
    eye: F.T(-0.8, 0.19),
    nose: F.T(-1.62, 0.02),
    brow: F.L([-1.02, 0.25, -0.84, 0.33, -0.62, 0.33]),
    snarl: F.L([-1.32, 0.18, -1.18, 0.08, -1.02, 0.04]),
    fangs: [F.L([-1.46, -0.13, -1.46, -0.4]), F.L(G([-1.34, -0.28, -1.34, -0.07]))],
    mouth: F.T(...(G([-1.25, -0.2]) as V2)),
    center: F.T(-0.65, 0.05),
  };
}

/** spiked collar around a neck: band across the neck at fraction u, spikes radiating from both edges */
function collar(B: Builder, bone: number, neckPts: number[], u: number, neckR: number): { prims: Prim[]; studs: V2[] } {
  const [cx, cy, tx, ty] = along(neckPts, u);
  const nx = -ty;
  const ny = tx;
  const half = neckR - 0.03;
  const prims: Prim[] = [B.cap(bone, cx - nx * half, cy - ny * half, cx + nx * half, cy + ny * half, 0.095, 0.095)];
  const studs: V2[] = [];
  for (const side of [1, -1]) {
    for (const lean of [-0.6, 0.6]) {
      // base on the band edge, tip pointing radially outward (fanned along the neck)
      const bx = cx + nx * side * (half - 0.04) + tx * lean * 0.13;
      const by = cy + ny * side * (half - 0.04) + ty * lean * 0.13;
      const dx = nx * side + tx * lean * 0.8;
      const dy = ny * side + ty * lean * 0.8;
      const dl = Math.hypot(dx, dy);
      const ux = dx / dl;
      const uy = dy / dl;
      const L = 0.26;
      const w = 0.07;
      prims.push(B.tri(bone, bx - uy * w, by + ux * w, bx + uy * w, by - ux * w, bx + ux * L, by + uy * L, 0.006));
    }
  }
  for (const f of [-0.5, 0.0, 0.5]) studs.push([cx + nx * half * f, cy + ny * half * f]);
  return { prims, studs };
}

/** jagged ridge (hackles): base polyline (flat x,y) with spikes leaning by (lx, ly) */
function hackles(base: number[], h: number, lx: number, ly: number, n: number, seed: number): number[] {
  const out: number[] = [];
  let rs = seed;
  const rnd = () => {
    rs = (rs * 16807) % 2147483647;
    return rs / 2147483647;
  };
  const pts: V2[] = [];
  for (let i = 0; i <= n; i++) {
    const [x, y] = along(base, i / n);
    pts.push([x, y]);
  }
  for (let i = 0; i <= n; i++) {
    const [x, y] = pts[i];
    out.push(x, y);
    if (i < n) {
      const [x2, y2] = pts[i + 1];
      const k = h * (0.6 + 0.8 * rnd()) * (0.35 + 0.65 * Math.sin(Math.PI * (0.2 + (0.8 * (i + 0.5)) / n)));
      out.push((x + x2) / 2 + lx * k, (y + y2) / 2 + ly * k);
    }
  }
  // close underneath (back along the base, sunk into the body)
  for (let i = n; i >= 0; i--) out.push(pts[i][0] - lx * 0.32, pts[i][1] - ly * 0.32);
  return out;
}

/** XII. Cerberus — three-headed hound of the underworld, profile facing left; spiked collars, serpent tail, raised hackles. */
export function buildCerberus(): CreatureDef {
  const B = new Builder();
  const R = B.ROOT;
  const body = B.bone('body', R, 0.6, 0.0);
  const chest = B.bone('chest', body, -0.9, 0.1);

  // necks (high / mid / low) fanning from the chest: short and thick, big heads
  const nH = [-0.95, 0.85, -1.12, 1.7, -1.32, 2.42];
  const nM = [-1.45, 0.3, -2.12, 0.5, -2.72, 0.6];
  const nL = [-1.5, -0.3, -1.92, -0.78, -2.25, -1.2];
  const neckH = B.chain('neckH', chest, nH);
  const neckM = B.chain('neckM', chest, nM);
  const neckL = B.chain('neckL', chest, nL);
  const headH = B.bone('headH', neckH[neckH.length - 1], nH[4], nH[5]);
  const headM = B.bone('headM', neckM[neckM.length - 1], nM[4], nM[5]);
  const headL = B.bone('headL', neckL[neckL.length - 1], nL[4], nL[5]);
  const HH = { ox: nH[4], oy: nH[5], ang: -20, s: 1.06, gape: 20 };
  const HM = { ox: nM[4], oy: nM[5], ang: -4, s: 1.14, gape: 16 };
  const HL = { ox: nL[4], oy: nL[5], ang: 30, s: 1.05, gape: 22 };
  const jawPivot = (h: { ox: number; oy: number; ang: number; s: number }) => frame(h.ox, h.oy, h.ang, h.s).T(-0.46, -0.13);
  const jawH = B.bone('jawH', headH, ...jawPivot(HH));
  const jawM = B.bone('jawM', headM, ...jawPivot(HM));
  const jawL = B.bone('jawL', headL, ...jawPivot(HL));

  // legs (near foreleg steps forward)
  const fN = B.bone('foreN', chest, -1.15, -0.2);
  const fN2 = B.bone('foreN2', fN, -1.45, -1.45);
  const fN3 = B.bone('pawN', fN2, -1.8, -2.55);
  const fF = B.bone('foreF', chest, -0.55, -0.25);
  const fF2 = B.bone('foreF2', fF, -0.6, -1.5);
  const hN = B.bone('hindN', body, 2.45, 0.2);
  const hN2 = B.bone('hindN2', hN, 2.0, -1.25);
  const hN3 = B.bone('hindN3', hN2, 2.75, -2.15);
  const hF = B.bone('hindF', body, 1.9, 0.1);
  const hF2 = B.bone('hindF2', hF, 1.45, -1.25);
  const hF3 = B.bone('hindF3', hF2, 2.15, -2.15);

  // serpent tail
  const tailPts = [3.05, 0.5, 3.62, 0.88, 4.12, 1.42, 4.22, 2.08, 3.92, 2.58, 4.0, 3.0];
  const tail = B.chain('tail', body, tailPts);
  const snake = B.bone('snake', tail[tail.length - 1], 4.0, 3.0);
  const SF = frame(4.0, 3.0, 26, 1.25, true);
  const snakeJaw = B.bone('snakeJaw', snake, ...SF.T(-0.2, -0.06));

  /* ---------------- far limbs ---------------- */
  B.part(
    'hindFar',
    { z: -0.55, bright: 0.5, rim: 0.8, inner: 0.4, thick: 0.25 },
    B.cap(hF, 1.95, 0.15, 1.45, -1.2, 0.62, 0.34),
    B.cap(hF2, 1.45, -1.25, 2.15, -2.15, 0.3, 0.18),
    B.cap(hF3, 2.15, -2.15, 1.98, -2.82, 0.17, 0.15),
    B.ell(hF3, 1.75, -2.92, 0.34, 0.15, -4),
  );
  B.part(
    'foreFar',
    { z: -0.5, bright: 0.5, rim: 0.8, inner: 0.4, thick: 0.25 },
    B.cap(fF, -0.55, -0.3, -0.6, -1.5, 0.44, 0.29),
    B.cap(fF2, -0.6, -1.5, -0.68, -2.64, 0.27, 0.2),
    B.ell(fF2, -0.92, -2.9, 0.4, 0.17, 3),
  );

  /* ---------------- serpent tail ---------------- */
  B.part(
    'tail',
    { z: -0.2, thick: 0.18, blend: 0.2, k: 0.06, inner: 0.7 },
    B.tube(tail, tailPts, [0.26, 0.2, 0.16, 0.14, 0.12, 0.11]),
    // snake head (facing right, mouth agape)
    B.poly(snake, SF.L([0.12, 0.14, -0.15, 0.19, -0.42, 0.15, -0.64, 0.06, -0.68, -0.03, -0.45, -0.07, -0.2, -0.08, 0.1, -0.11]), 0.02, 3),
    B.tri(snake, ...SF.T(-0.62, -0.04), ...SF.T(-0.55, -0.06), ...SF.T(-0.58, -0.28), 0.008),
  );
  B.part(
    'snakeJaw',
    { z: -0.15, thick: 0.12, inner: 0.8 },
    B.poly(snakeJaw, SF.L([-0.2, -0.07, -0.45, -0.13, -0.64, -0.22, -0.62, -0.28, -0.4, -0.24, -0.1, -0.17]), 0.02, 2),
  );

  /* ---------------- torso ---------------- */
  B.part(
    'body',
    { z: 0, k: 0.3, thick: 0.6, inner: 0.6 },
    B.poly(
      body,
      [-0.3, 1.08, 0.6, 0.95, 1.6, 0.92, 2.5, 1.0, 3.05, 0.82, 3.34, 0.3, 3.22, -0.35, 2.78, -0.75, 2.05, -0.62, 1.25, -0.5, 0.45, -0.72, -0.3, -1.1],
      0.05,
      4,
    ),
    B.ell(chest, -1.05, -0.3, 1.0, 1.18, -10),
    B.ell(chest, -0.65, 0.5, 0.85, 0.6, 0),
  );
  // raised hackles along the high neck and the withers
  B.part(
    'hackles',
    { z: 0.05, k: 0.04, thick: 0.3, flow: Flow.Bristle, rim: 1.1, inner: 0.45, blend: 0.3 },
    B.poly(chest, hackles([-0.92, 2.32, -0.74, 1.8, -0.56, 1.35, -0.28, 1.1, 0.2, 1.02, 0.85, 0.93], 0.36, 0.6, 0.8, 15, 7), 0.015, 2),
  );

  /* ---------------- heads ---------------- */
  const heads = [
    { name: 'H', pts: nH, chain: neckH, head: headH, jaw: jawH, hd: HH, radii: [0.5, 0.42, 0.38], z: -0.1 },
    { name: 'L', pts: nL, chain: neckL, head: headL, jaw: jawL, hd: HL, radii: [0.5, 0.41, 0.37], z: 0.15 },
    { name: 'M', pts: nM, chain: neckM, head: headM, jaw: jawM, hd: HM, radii: [0.55, 0.45, 0.41], z: 0.35 },
  ];
  const info: Record<string, { hh: HoundHead; studs: V2[] }> = {};
  for (const h of heads) {
    const hh = houndHead(B, h.head, h.jaw, h.hd.ox, h.hd.oy, h.hd.ang, h.hd.s, h.hd.gape);
    B.part(`jaw${h.name}`, { z: h.z + 0.02, k: 0.06, thick: 0.25, inner: 0.9 }, ...hh.jaw);
    B.part(
      `head${h.name}`,
      { z: h.z + 0.05, k: 0.16, thick: 0.4, inner: 0.85, rim: 1.1, tint: 0.08, fill: 1.1, blend: 0.18 },
      B.tube(h.chain, h.pts, h.radii),
      ...hh.head,
    );
    const col = collar(B, h.chain[h.chain.length - 1], h.pts, 0.74, h.radii[2] + 0.02);
    B.part(`collar${h.name}`, { z: h.z + 0.12, k: 0.02, thick: 0.15, inner: 0.95, rim: 1.1, tint: 0.3, fill: 0.5 }, ...col.prims);
    info[h.name] = { hh, studs: col.studs };
  }

  /* ---------------- near limbs ---------------- */
  B.part(
    'hindNear',
    { z: 0.3, k: 0.15, inner: 0.65, thick: 0.4, blend: 0.14 },
    B.cap(hN, 2.5, 0.25, 2.02, -1.2, 0.78, 0.4),
    B.cap(hN2, 2.0, -1.25, 2.75, -2.15, 0.34, 0.2),
    B.cap(hN3, 2.75, -2.15, 2.56, -2.82, 0.19, 0.17),
    B.ell(hN3, 2.32, -2.95, 0.38, 0.16, -2),
  );
  B.part(
    'foreNear',
    { z: 0.5, k: 0.15, inner: 0.7, thick: 0.4, blend: 0.14 },
    B.cap(fN, -1.15, -0.4, -1.45, -1.45, 0.47, 0.33),
    B.cap(fN2, -1.45, -1.45, -1.8, -2.55, 0.32, 0.22),
    B.cap(fN3, -1.8, -2.55, -1.95, -2.8, 0.22, 0.2),
    B.ell(fN3, -2.12, -2.92, 0.46, 0.2, -3),
    B.cap(fN3, -2.46, -2.86, -2.72, -3.0, 0.065, 0.02),
    B.cap(fN3, -2.5, -2.97, -2.76, -3.1, 0.06, 0.02),
    B.cap(fN3, -2.42, -3.06, -2.64, -3.2, 0.055, 0.018),
  );

  /* ---------------- detail filaments ---------------- */
  for (const h of heads) {
    const hh = info[h.name].hh;
    const pn = `head${h.name}`;
    B.stroke(hh.brow, { part: pn, w: 0.022, bright: 1.0, smooth: 4 });
    B.stroke(hh.snarl, { part: pn, w: 0.016, bright: 0.7 });
    B.stroke(hh.fangs[0], { part: pn, w: 0.016, bright: 1.6, tint: 0.7, smooth: 0, taper: 0.8 });
    B.stroke(hh.fangs[1], { part: `jaw${h.name}`, w: 0.016, bright: 1.4, tint: 0.7, smooth: 0, taper: 0.8 });
  }
  // bristling fur along the back of each neck (collar -> shoulders) and a ruff on the chest
  for (const h of heads) {
    const pts: number[] = [];
    for (let j = 0; j <= 6; j++) {
      const [x, y, tx, ty] = along(h.pts, 0.68 - j * 0.1);
      let nx = -ty;
      let ny = tx;
      if (ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      const rr = (h.radii[0] + (h.radii[2] - h.radii[0]) * (0.68 - j * 0.1)) * 0.62;
      pts.push(x + nx * rr, y + ny * rr);
    }
    B.stroke(pts, { part: `head${h.name}`, w: 0.022, bright: 0.6, flow: Flow.Wisp, smooth: 4 });
  }
  B.stroke([-1.6, 0.15, -1.85, -0.25, -1.8, -0.75], { part: 'body', w: 0.022, bright: 0.45, flow: Flow.Wisp });
  B.stroke([-1.3, 0.35, -1.55, -0.1, -1.55, -0.55], { part: 'body', w: 0.02, bright: 0.4, flow: Flow.Wisp });
  // musculature
  B.stroke([-0.75, 0.75, -0.45, 0.05, -0.7, -0.85], { part: 'body', w: 0.024, bright: 0.45 });
  B.stroke([0.4, 0.55, 0.85, -0.05, 0.7, -0.6], { part: 'body', w: 0.022, bright: 0.35 });
  B.stroke([2.2, 0.75, 2.6, 0.15, 2.5, -0.5], { part: 'hindNear', w: 0.025, bright: 0.5 });
  B.stroke([-1.0, -0.4, -1.3, -0.95, -1.45, -1.4], { part: 'foreNear', w: 0.024, bright: 0.55 });
  // ribs
  B.stroke([0.0, 0.45, 0.15, -0.1, 0.0, -0.6], { part: 'body', w: 0.018, bright: 0.3 });
  B.stroke([0.55, 0.45, 0.7, -0.05, 0.55, -0.5], { part: 'body', w: 0.018, bright: 0.28 });
  // serpent scales + flickering forked tongue
  B.stroke([3.65, 1.0, 4.07, 1.48, 4.14, 2.05, 3.9, 2.52], { part: 'tail', w: 0.02, bright: 0.55, flow: Flow.Wisp });
  B.stroke(SF.L([-0.62, -0.1, -0.86, -0.12, -1.0, -0.04]), { part: 'snakeJaw', w: 0.014, bright: 1.4, tint: 0.6, smooth: 0, flow: Flow.Bristle });
  B.stroke(SF.L([-0.86, -0.12, -1.0, -0.2]), { part: 'snakeJaw', w: 0.014, bright: 1.4, tint: 0.6, smooth: 0, flow: Flow.Bristle });

  /* ---------------- key stars ---------------- */
  B.star('heart', -1.05, -0.35, 1.7);
  B.star('withers', -0.3, 0.85, 0.9);
  B.star('hip', 2.4, 0.55, 1.1);
  B.star('tailbase', 3.3, 0.72, 0.8, { part: 'tail' });
  B.star('tailmid', 4.15, 1.75, 0.75, { part: 'tail' });
  B.star('fang', ...SF.T(-0.36, 0.06), 1.3, { part: 'tail' });
  for (const h of heads) {
    const I = info[h.name];
    const pn = `head${h.name}`;
    B.star(`eye${h.name}`, ...I.hh.eye, h.name === 'M' ? 1.25 : 1.05, { part: pn });
    B.star(`nose${h.name}`, ...I.hh.nose, 0.8, { part: pn });
    B.star(`collar${h.name}`, ...I.studs[1], 0.8, { part: `collar${h.name}` });
  }
  B.star('elbow', -1.45, -1.45, 0.75, { part: 'foreNear' });
  B.star('paw', -2.15, -2.92, 1.0, { part: 'foreNear' });
  B.star('farpaw', -0.92, -2.9, 0.65, { part: 'foreFar' });
  B.star('stifle', 2.02, -1.2, 0.75, { part: 'hindNear' });
  B.star('hock', 2.75, -2.15, 0.7, { part: 'hindNear' });
  B.star('hindpaw', 2.35, -2.95, 0.85, { part: 'hindNear' });
  B.link('noseH', 'eyeH', 'collarH', 'withers', 'hip', 'tailbase', 'tailmid', 'fang');
  B.link('noseM', 'eyeM', 'collarM', 'heart', 'elbow', 'paw');
  B.link('noseL', 'eyeL', 'collarL', 'heart', 'withers');
  B.link('heart', 'farpaw');
  B.link('hip', 'stifle', 'hock', 'hindpaw');

  B.core = P(-1.05, -0.3);
  B.head = P(...info.M.hh.center, 0.5);
  B.mouths.push(P(...info.M.hh.mouth, 0.5), P(...info.H.hh.mouth, 0.4), P(...info.L.hh.mouth, 0.45));

  const necks = [
    { chain: neckH, head: headH, jaw: jawH, ph: 0.0, per: 3.7 },
    { chain: neckM, head: headM, jaw: jawM, ph: 1.3, per: 3.1 },
    { chain: neckL, head: headL, jaw: jawL, ph: 2.4, per: 4.3 },
  ];

  return B.build('cerberus', (p, c) => {
    const t = c.t;
    const br = c.breath;
    const fwd = Math.max(0, c.lunge);
    const back = Math.max(0, -c.lunge);
    // breathing, crouch / pounce
    p.s(body, 1 + 0.01 * br, 1 + 0.02 * br);
    p.r(body, 0.05 * back - 0.05 * fwd + 0.04 * c.hurt - 0.02 * c.low);
    p.o(body, 0.15 * back, -0.2 * back + 0.05 * fwd - 0.08 * c.low, 0);
    p.r(chest, 0.02 * Math.sin(t * 0.8) + 0.05 * back - 0.05 * fwd - 0.06 * c.roar);
    // three heads: idle bob + out-of-phase snaps; strike thrusts all three
    necks.forEach((n, i) => {
      const snap = pulse(t, n.per, n.ph, 0.42);
      const bob = Math.sin(t * (0.9 + i * 0.17) + n.ph);
      // (left-facing necks: CW lifts the high/mid heads; the low neck hangs forward so its signs flip)
      const k = i === 2 ? -0.7 : 1;
      p.r(n.chain[0], 0.035 * bob + k * (-0.11 * back + 0.1 * fwd) - 0.15 * c.roar + 0.1 * c.hurt + 0.06 * c.low);
      p.r(n.chain[1], 0.045 * Math.sin(t * 1.3 + n.ph + 0.7) - 0.05 * snap + k * (-0.05 * back + 0.06 * fwd) - 0.08 * c.roar);
      p.r(n.head, 0.05 * Math.sin(t * 1.7 + n.ph * 1.7) + 0.16 * snap - 0.34 * c.roar - 0.1 * back + 0.1 * fwd + 0.1 * c.hurt + 0.12 * c.low);
      p.r(n.jaw, 0.05 + 0.04 * Math.sin(t * 2.1 + n.ph) + 0.42 * snap * (1 - c.mouth) + 0.42 * c.mouth + 0.1 * c.charge);
    });
    // forelegs: braced, dig in on the pounce
    p.r(fN, -0.03 * Math.sin(t * 0.9) - 0.25 * fwd + 0.15 * back);
    p.r(fN2, 0.04 * Math.sin(t * 0.9 + 0.6) - 0.15 * fwd + 0.18 * back);
    p.r(fN3, 0.06 * Math.sin(t * 0.9 + 1.2) + 0.2 * fwd);
    p.r(fF, 0.02 * br - 0.08 * fwd);
    p.r(hN, -0.015 * br + 0.06 * back);
    p.r(hF, 0.015 * br + 0.06 * back);
    // serpent tail: constant writhing; whips when charging
    const lash = 1 + 1.4 * c.charge + 0.8 * c.roar;
    p.wave(tail, 0.07 * lash, t, 2.1 + c.charge * 2.5, 0.85, 0.3);
    p.r(tail[0], -0.06 * c.roar + 0.05 * c.low);
    p.r(snake, 0.12 * Math.sin(t * 2.6 + 0.4));
    p.r(snakeJaw, -(0.08 + 0.35 * pulse(t, 2.9, 0.8, 0.5) + 0.3 * c.mouth));
  });
}

/** auto-registered by ./index.ts */
export const CREATURE: CreatureModule = { id: 'cerberus', build: buildCerberus };
