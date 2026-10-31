import { Builder, Flow, P, deg, type CreatureDef } from '../rig';
import type { Prim } from '../sdf';
import type { CreatureModule } from './index';

/** local serpent head (facing +x), transformed to world by position / angle / flip / scale */
function serpentHead(B: Builder, headBone: number, jawBone: number, hx: number, hy: number, angDeg: number, flip: boolean, s: number, crown: boolean) {
  const a = angDeg * deg;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const T = (x: number, y: number): [number, number] => {
    const lx = (flip ? -x : x) * s;
    const ly = y * s;
    return [hx + lx * ca - ly * sa, hy + lx * sa + ly * ca];
  };
  const poly = (b: number, pts: number[], r: number, smooth: number) => {
    const out: number[] = [];
    for (let i = 0; i < pts.length; i += 2) out.push(...T(pts[i], pts[i + 1]));
    return B.poly(b, out, r * s, smooth);
  };
  const cap = (b: number, ax: number, ay: number, bx: number, by: number, ra: number, rb: number) => {
    const [x0, y0] = T(ax, ay);
    const [x1, y1] = T(bx, by);
    return B.cap(b, x0, y0, x1, y1, ra * s, rb * s);
  };
  const upper: Prim[] = [
    B.ell(headBone, ...T(0.0, 0.03), 0.4 * s, 0.27 * s, angDeg + (flip ? 180 : 0)),
    poly(headBone, [-0.3, 0.19, 0.1, 0.24, 0.5, 0.18, 0.88, 0.08, 0.98, -0.0, 0.66, -0.04, 0.2, -0.06, -0.24, -0.12], 0.02, 3),
    // upper fang
    poly(headBone, [0.8, 0.0, 0.71, -0.01, 0.78, -0.2], 0.01, 0),
  ];
  if (crown) {
    upper.push(cap(headBone, -0.12, 0.2, -0.36, 0.52, 0.06, 0.012), cap(headBone, -0.26, 0.15, -0.6, 0.38, 0.06, 0.012), cap(headBone, 0.04, 0.22, -0.06, 0.55, 0.055, 0.012));
  }
  const jaw: Prim[] = [
    poly(jawBone, [-0.22, -0.1, 0.25, -0.12, 0.62, -0.16, 0.88, -0.2, 0.86, -0.29, 0.45, -0.3, 0.0, -0.27, -0.25, -0.2], 0.02, 3),
    poly(jawBone, [0.74, -0.18, 0.65, -0.17, 0.73, -0.06], 0.01, 0),
  ];
  return { upper, jaw, eye: T(0.26, 0.1), hinge: T(-0.16, -0.1), mouth: T(0.8, -0.16), crest: T(-0.62, 0.36) };
}

/** II. The Lernaean Hydra — coiled body low, seven necks fanning up like a bouquet; central immortal head largest. */
export function buildHydra(): CreatureDef {
  const B = new Builder();
  B.facing = 0;
  const R = B.ROOT;
  const body = B.bone('body', R, 0, -2.0);
  const tailPts = [3.0, -2.95, 3.75, -2.7, 4.15, -2.1, 4.0, -1.52, 3.6, -1.36];
  const tail = B.chain('tail', body, tailPts);

  // one continuous coiled body: bottom band (right->left), turns up, middle band (left->right), turns up, top band
  B.part(
    'coilLow',
    { z: -0.35, k: 0.1, thick: 0.5, inner: 0.6, blend: 0.25 },
    B.tube(body, [3.0, -2.95, 1.6, -3.3, 0.0, -3.42, -1.6, -3.32, -2.8, -3.0], [0.5, 0.56, 0.58, 0.56, 0.52]),
    B.tube(tail, tailPts, [0.5, 0.38, 0.26, 0.16, 0.06]),
  );
  B.part(
    'coilMid',
    { z: -0.05, k: 0.1, thick: 0.5, inner: 0.75 },
    B.tube(body, [-2.8, -3.0, -3.38, -2.62, -3.08, -2.18, -1.5, -2.55, 0.15, -2.66, 1.8, -2.5, 2.8, -2.12], [0.52, 0.5, 0.5, 0.52, 0.53, 0.5, 0.47]),
  );
  B.part(
    'coilTop',
    { z: 0.25, k: 0.12, thick: 0.5, inner: 0.85, fill: 1.1 },
    B.tube(body, [2.8, -2.12, 3.18, -1.7, 2.75, -1.42, 1.4, -1.82, 0.0, -1.92, -1.3, -1.78, -2.05, -1.42], [0.47, 0.46, 0.46, 0.5, 0.52, 0.48, 0.42]),
    B.ell(body, 0.05, -1.3, 1.2, 0.5),
  );

  // necks: order back (outer) -> front (centre)
  const order = [0, 6, 1, 5, 2, 4, 3];
  const neckChains: number[][] = [];
  const jaws: number[] = [];
  const heads: number[] = [];
  const info: { eye: [number, number]; mid: [number, number]; base: [number, number]; mouth: [number, number]; crest: [number, number] }[] = [];
  for (let i = 0; i < 7; i++) {
    const t = (i - 3) / 3;
    const at = Math.abs(t);
    const bx = t * 1.15;
    const by = -1.15 + 0.2 * (1 - at);
    const th = t * 55 * deg;
    const L = 3.6 - 0.95 * at;
    const hx = bx + Math.sin(th * 1.15) * L;
    const hy = by + Math.cos(th * 1.15) * L;
    // quadratic arc (rise then bow outward) + sinuous wiggle
    const cx = bx + (hx - bx) * 0.15;
    const cy = by + (hy - by) * 0.75;
    const wig = [0, 0.32, -0.3, 0.16, 0].map((w) => w * (i % 2 ? 1 : -1));
    const pts: number[] = [];
    for (let k = 0; k <= 4; k++) {
      const u = k / 4;
      const x = (1 - u) * (1 - u) * bx + 2 * (1 - u) * u * cx + u * u * hx;
      const y = (1 - u) * (1 - u) * by + 2 * (1 - u) * u * cy + u * u * hy;
      // perpendicular of the chord for the wiggle
      const nx = Math.cos(th);
      const ny = -Math.sin(th);
      pts.push(x + nx * wig[k], y + ny * wig[k]);
    }
    const chain = B.chain(`neck${i}_`, body, pts);
    const head = B.bone(`head${i}`, chain[chain.length - 1], pts[8], pts[9]);
    const centre = i === 3;
    const flip = t < 0 || centre;
    const thr = th * 1.15;
    const ang = centre ? -12 : (flip ? -1 : 1) * (90 - Math.abs(thr) / deg * 1.25 - 8);
    const s = centre ? 1.5 : 1.22 - 0.12 * at;
    const hp = serpentHead(B, head, -1, pts[8], pts[9], ang, flip, s, centre);
    const jaw = B.bone(`jaw${i}`, head, hp.hinge[0], hp.hinge[1]);
    const hp2 = serpentHead(B, head, jaw, pts[8], pts[9], ang, flip, s, centre);
    neckChains[i] = chain;
    jaws[i] = jaw;
    heads[i] = head;
    info[i] = { eye: hp2.eye, mid: [pts[4], pts[5]], base: [pts[0], pts[1]], mouth: hp2.mouth, crest: hp2.crest };
    const r0 = centre ? 0.38 : 0.32 - 0.03 * at;
    const r1 = centre ? 0.22 : 0.17;
    B.part(
      `neck${i}`,
      {
        layer: 4 + order.indexOf(i),
        z: 0.1 + 0.12 * order.indexOf(i),
        k: 0.08,
        thick: 0.3,
        blend: 0.22,
        inner: 0.75,
        bright: centre ? 1.15 : 0.82 + 0.06 * (3 - at * 3),
        tint: centre ? 0.15 : 0,
        rim: centre ? 1.2 : 1,
      },
      B.tube(chain, pts, [r0, r0 * 0.88, (r0 + r1) / 2, r1 * 1.05, r1]),
      hp2.upper,
      hp2.jaw,
    );
  }
  // scales along the centre neck + coils
  for (let k = 0; k < 7; k++) {
    const e = info[k];
    B.stroke([e.base[0], e.base[1] + 0.2, (e.base[0] + e.mid[0]) / 2, (e.base[1] + e.mid[1]) / 2, e.mid[0], e.mid[1]], { part: `neck${k}`, w: 0.02, bright: 0.45 });
    B.stroke([e.eye[0] - 0.05, e.eye[1], e.eye[0] + 0.05, e.eye[1] + 0.01], { part: `neck${k}`, w: 0.03, bright: 1.6, tint: 0.8, smooth: 0 });
  }
  B.stroke([2.4, -3.2, 1.0, -3.55, -0.6, -3.62, -2.2, -3.42], { part: 'coilLow', w: 0.025, bright: 0.45 });
  B.stroke([-2.3, -2.55, -0.9, -2.85, 0.6, -2.9, 2.1, -2.68], { part: 'coilMid', w: 0.025, bright: 0.45 });
  B.stroke([2.3, -1.95, 1.0, -2.1, -0.4, -2.17, -1.6, -1.98], { part: 'coilTop', w: 0.025, bright: 0.45 });
  B.stroke([-2.95, -3.15, -3.5, -2.65, -3.25, -2.25], { part: 'coilMid', w: 0.025, bright: 0.5 });
  B.stroke([2.95, -2.3, 3.32, -1.75, 3.0, -1.4], { part: 'coilTop', w: 0.025, bright: 0.5 });

  // stars: an eye per head, a star mid-neck, Alphard at the heart
  B.star('alphard', 0.05, -1.55, 1.7);
  for (let i = 0; i < 7; i++) {
    const e = info[i];
    B.star(`eye${i}`, e.eye[0], e.eye[1], i === 3 ? 1.6 : 0.95, { part: `neck${i}` });
    B.star(`mid${i}`, e.mid[0], e.mid[1], 0.6, { part: `neck${i}` });
    B.link(`eye${i}`, `mid${i}`, 'alphard');
  }
  B.star('coilL', -3.2, -2.55, 0.8, { part: 'coilMid' });
  B.star('coilM', 0.1, -3.35, 0.9, { part: 'coilLow' });
  B.star('coilR', 3.05, -1.75, 0.8, { part: 'coilTop' });
  B.star('tailmid', 4.1, -2.1, 0.7, { part: 'coilLow' });
  B.star('tailtip', 3.5, -1.32, 0.75, { part: 'coilLow' });
  B.link('alphard', 'coilL', 'coilM', 'coilR', 'alphard');
  B.link('coilM', 'tailmid', 'tailtip');
  B.core = P(0, -1.6);
  B.head = P(info[3].eye[0], info[3].eye[1], 0.8);
  for (const i of [3, 2, 4, 1, 5, 0, 6]) B.mouths.push(P(info[i].mouth[0], info[i].mouth[1], 0.6));

  return B.build('hydra', (p, c) => {
    const t = c.t;
    const br = c.breath;
    const fwd = Math.max(0, c.lunge);
    const back = Math.max(0, -c.lunge);
    p.s(body, 1 + 0.015 * br, 1 + 0.025 * br);
    p.wave(tail, 0.08 + 0.1 * c.charge, t, 1.3, 0.8, 0.3);
    for (let i = 0; i < 7; i++) {
      const ch = neckChains[i];
      const side = (i - 3) / 3;
      const ph = i * 1.37;
      // independent sinuous sway
      const amp = 0.05 + 0.03 * Math.abs(side) + 0.04 * c.charge;
      for (let k = 0; k < ch.length; k++) {
        p.r(ch[k], amp * Math.sin(t * (0.9 + i * 0.07) + ph - k * 0.9) * (0.6 + k * 0.25));
      }
      // roar: rear up and spread; low hp: droop
      p.r(ch[0], -side * 0.12 * c.roar + side * 0.08 * c.low + side * 0.1 * c.hurt);
      p.r(ch[1], side * 0.1 * c.low);
      // strike: central head lunges; volley: heads strike in turn
      const isStriker = i === 3 ? fwd : 0;
      const pulseHead = [3, 1, 5][c.pulseIdx] === i || [2, 4, 0][c.pulseIdx] === i ? c.volley : 0;
      const lungeK = Math.max(isStriker, pulseHead * 0.8);
      p.o(heads[i], 0, 0, 1.6 * lungeK);
      p.r(ch[2], -side * 0.2 * lungeK + 0.08 * back * side);
      p.r(ch[3], side * 0.15 * lungeK);
      p.r(heads[i], 0.06 * Math.sin(t * 1.7 + ph) + (i === 3 ? 0.1 * back : 0));
      const bite = Math.max(0, Math.sin(t * 0.9 + ph * 2.1)) ** 6;
      p.r(jaws[i], (i < 3 || i === 3 ? -1 : 1) * -(0.08 + 0.25 * bite + 0.45 * c.mouth + 0.3 * pulseHead));
    }
  });
}

export const CREATURE: CreatureModule = { id: 'hydra', build: buildHydra };
