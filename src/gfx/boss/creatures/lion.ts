import { Builder, Flow, P, type CreatureDef } from '../rig';
import { shaggyOutline } from '../shapes';
import type { CreatureModule } from './index';

export { shaggyOutline };

/** I. The Nemean Lion — profile facing left, mid-roar, shaggy mane, raised tufted tail, near forepaw lifted. */
export function buildLion(): CreatureDef {
  const B = new Builder();
  const R = B.ROOT;
  const body = B.bone('body', R, 0.4, -0.2);
  const neck = B.bone('neck', body, -1.6, 0.6);
  const head = B.bone('head', neck, -2.75, 1.2);
  const jaw = B.bone('jaw', head, -3.1, 1.0);
  const fN = B.bone('foreN', body, -1.45, 0.05);
  const fN2 = B.bone('foreN2', fN, -1.85, -1.45);
  const fN3 = B.bone('pawN', fN2, -2.35, -2.2);
  const fF = B.bone('foreF', body, -0.95, -0.2);
  const fF2 = B.bone('foreF2', fF, -1.2, -1.5);
  const hN = B.bone('hindN', body, 2.2, 0.15);
  const hN2 = B.bone('hindN2', hN, 1.85, -1.1);
  const hN3 = B.bone('hindN3', hN2, 2.6, -1.95);
  const hF = B.bone('hindF', body, 1.6, 0.0);
  const hF2 = B.bone('hindF2', hF, 1.2, -1.0);
  const hF3 = B.bone('hindF3', hF2, 1.75, -1.85);
  const tailPts = [2.95, 0.6, 3.55, 0.95, 3.95, 1.55, 4.1, 2.2, 3.98, 2.75];
  const tail = B.chain('tail', body, tailPts);

  // --- far limbs (behind, dimmer) ---
  B.part(
    'hindFar',
    { z: -0.55, bright: 0.55, rim: 0.8, inner: 0.4, thick: 0.25 },
    B.cap(hF, 1.7, 0.05, 1.2, -1.0, 0.6, 0.35),
    B.cap(hF2, 1.2, -1.0, 1.75, -1.85, 0.29, 0.18),
    B.cap(hF3, 1.75, -1.85, 1.5, -2.72, 0.17, 0.15),
    B.ell(hF3, 1.28, -2.86, 0.32, 0.15, -4),
  );
  B.part(
    'foreFar',
    { z: -0.5, bright: 0.55, rim: 0.8, inner: 0.4, thick: 0.25 },
    B.cap(fF, -0.95, -0.25, -1.2, -1.5, 0.44, 0.27),
    B.cap(fF2, -1.2, -1.5, -1.35, -2.68, 0.25, 0.18),
    B.ell(fF2, -1.6, -2.85, 0.34, 0.16, 4),
  );
  // --- tail ---
  B.part(
    'tail',
    { z: -0.15, thick: 0.15, blend: 0.18 },
    B.tube(tail, tailPts, [0.14, 0.12, 0.1, 0.085, 0.08]),
    B.ell(tail[3], 3.94, 2.98, 0.2, 0.3, 8),
    B.cap(tail[3], 3.93, 3.12, 3.84, 3.48, 0.15, 0.02),
  );
  // --- torso ---
  B.part(
    'body',
    { z: 0, k: 0.25, thick: 0.6 },
    B.poly(
      body,
      [-1.3, 1.2, -0.2, 1.0, 0.8, 0.88, 1.7, 1.02, 2.55, 0.98, 3.05, 0.55, 3.05, -0.2, 2.75, -0.72, 1.85, -0.72, 0.6, -0.92, -0.5, -1.12, -1.6, -1.05, -2.15, -0.5, -2.3, 0.4],
      0.05,
      4,
    ),
  );
  // --- near hind leg ---
  B.part(
    'hindNear',
    { z: 0.3, k: 0.15, inner: 0.65, thick: 0.4, blend: 0.14 },
    B.cap(hN, 2.3, 0.2, 1.88, -1.05, 0.78, 0.4),
    B.cap(hN2, 1.88, -1.1, 2.6, -1.95, 0.34, 0.2),
    B.cap(hN3, 2.6, -1.95, 2.38, -2.72, 0.19, 0.17),
    B.ell(hN3, 2.15, -2.87, 0.36, 0.16, -2),
  );
  // --- near foreleg (paw lifted, claws out) ---
  B.part(
    'foreNear',
    { z: 0.35, k: 0.15, inner: 0.65, thick: 0.4, blend: 0.14 },
    B.cap(fN, -1.45, 0.0, -1.85, -1.45, 0.56, 0.32),
    B.cap(fN2, -1.85, -1.45, -2.35, -2.2, 0.3, 0.21),
    B.ell(fN3, -2.66, -2.34, 0.36, 0.19, -16),
    B.cap(fN3, -2.92, -2.44, -3.12, -2.68, 0.055, 0.02),
    B.cap(fN3, -2.98, -2.33, -3.22, -2.52, 0.055, 0.02),
    B.cap(fN3, -2.97, -2.2, -3.24, -2.32, 0.05, 0.018),
  );
  // --- mane: flowing locks swept back ---
  const manePts = shaggyOutline(-2.15, 0.92, 1.3, 1.78, -16, 118, -238, 15, 0.3, 0.32, -0.16, 7);
  B.part(
    'mane',
    { z: 0.15, k: 0.1, thick: 0.6, flow: Flow.Wisp, rim: 1.05, tint: 0.05, blend: 0.2 },
    B.poly(neck, manePts, 0.03, 3),
    B.ell(neck, -2.3, -0.35, 0.7, 0.85, 10),
  );
  // --- lower jaw (open) ---
  B.part(
    'jaw',
    { z: 0.42, k: 0.08, thick: 0.25, inner: 0.9 },
    B.poly(jaw, [-3.1, 1.02, -3.55, 0.85, -4.0, 0.6, -4.3, 0.42, -4.38, 0.24, -4.15, 0.11, -3.6, 0.22, -3.15, 0.55], 0.04, 3),
    B.tri(jaw, -4.24, 0.42, -4.09, 0.47, -4.13, 0.78, 0.012),
    B.tri(jaw, -3.88, 0.62, -3.77, 0.67, -3.8, 0.86, 0.01),
  );
  // --- head (snarling: nose wrinkled, lips drawn back over the fangs) ---
  B.part(
    'head',
    { z: 0.48, k: 0.16, thick: 0.4, inner: 1.0, rim: 1.15, tint: 0.1, fill: 1.15 },
    B.ell(head, -3.2, 1.6, 0.74, 0.62, -5),
    B.poly(
      head,
      [-2.85, 2.1, -3.35, 2.24, -3.8, 2.1, -4.15, 1.9, -4.5, 1.74, -4.73, 1.56, -4.74, 1.38, -4.63, 1.2, -4.47, 1.0, -4.2, 0.98, -3.92, 1.06, -3.55, 0.99, -3.25, 1.03, -2.8, 1.25],
      0.035,
      3,
    ),
    B.ell(head, -2.82, 2.22, 0.22, 0.19, 30),
    B.tri(head, -4.4, 1.02, -4.22, 1.0, -4.29, 0.66, 0.014),
    B.tri(head, -3.98, 1.04, -3.87, 1.02, -3.93, 0.84, 0.012),
  );

  // --- detail filaments ---
  const mane = { flow: Flow.Wisp, part: 'mane', w: 0.03, bright: 0.85 };
  B.stroke([-2.7, 2.35, -2.15, 2.6, -1.5, 2.45, -1.0, 2.05], mane);
  B.stroke([-2.5, 1.85, -1.85, 1.98, -1.2, 1.65, -0.8, 1.2], mane);
  B.stroke([-2.4, 1.25, -1.75, 1.28, -1.15, 0.92, -0.85, 0.38], mane);
  B.stroke([-2.5, 0.65, -1.95, 0.45, -1.5, 0.0, -1.35, -0.5], mane);
  B.stroke([-2.75, 0.15, -2.45, -0.3, -2.3, -0.85], mane);
  B.stroke([-1.9, 2.9, -1.45, 2.75, -1.15, 2.45], mane);
  // face
  B.stroke([-3.92, 1.76, -3.77, 1.8, -3.61, 1.74], { part: 'head', w: 0.022, bright: 1.9, tint: 0.85, smooth: 4 });
  B.stroke([-4.05, 1.93, -3.78, 1.97, -3.52, 1.88], { part: 'head', w: 0.02, bright: 0.8 });
  B.stroke([-4.38, 1.66, -4.25, 1.55, -4.08, 1.5], { part: 'head', w: 0.016, bright: 0.7 });
  B.stroke([-4.3, 1.8, -4.18, 1.68, -4.0, 1.62], { part: 'head', w: 0.016, bright: 0.6 });
  B.stroke([-4.6, 1.3, -4.4, 1.22, -4.15, 1.2, -3.9, 1.24], { part: 'head', w: 0.018, bright: 0.55 });
  B.stroke([-4.72, 1.47, -4.62, 1.42], { part: 'head', w: 0.03, bright: 1.1, smooth: 0 });
  B.stroke([-3.5, 0.78, -3.8, 0.64, -4.05, 0.52], { part: 'jaw', w: 0.03, bright: 0.45 });
  // fangs
  B.stroke([-4.31, 1.0, -4.3, 0.72], { part: 'head', w: 0.016, bright: 1.6, tint: 0.7, smooth: 0, taper: 0.8 });
  B.stroke([-3.92, 1.02, -3.93, 0.86], { part: 'head', w: 0.014, bright: 1.2, tint: 0.7, smooth: 0, taper: 0.8 });
  B.stroke([-4.15, 0.47, -4.13, 0.75], { part: 'jaw', w: 0.016, bright: 1.5, tint: 0.7, smooth: 0, taper: 0.8 });
  // body musculature
  B.stroke([-0.55, 0.85, -0.3, 0.1, -0.55, -0.7], { part: 'body', w: 0.025, bright: 0.45 });
  B.stroke([0.3, 0.55, 0.75, -0.1, 0.65, -0.65], { part: 'body', w: 0.022, bright: 0.35 });
  B.stroke([2.05, 0.75, 2.55, 0.2, 2.45, -0.45], { part: 'hindNear', w: 0.025, bright: 0.5 });
  B.stroke([-1.35, -0.3, -1.6, -0.9, -1.8, -1.35], { part: 'foreNear', w: 0.022, bright: 0.5 });
  B.stroke([3.9, 2.85, 3.86, 3.15, 3.84, 3.38], { part: 'tail', w: 0.02, bright: 0.7, flow: Flow.Wisp });

  // --- key stars (after Leo: sickle through the mane, Regulus at the heart, Denebola at the tail) ---
  B.star('regulus', -1.85, -0.55, 1.7);
  B.star('eta', -1.25, 0.5, 0.9);
  B.star('algieba', -1.45, 1.6, 1.3);
  B.star('zeta', -2.05, 2.6, 1.0);
  B.star('mu', -3.0, 2.3, 0.8, { part: 'head' });
  B.star('eye', -3.77, 1.78, 1.05, { part: 'head' });
  B.star('nose', -4.62, 1.5, 0.9, { part: 'head' });
  B.star('chin', -4.25, 0.3, 0.8, { part: 'jaw' });
  B.star('zosma', 1.6, 0.95, 1.2);
  B.star('chertan', 2.2, -0.15, 1.0, { part: 'hindNear' });
  B.star('tailmid', 3.95, 1.5, 0.75, { part: 'tail' });
  B.star('denebola', 3.92, 3.02, 1.4, { part: 'tail' });
  B.star('elbow', -1.85, -1.45, 0.75, { part: 'foreNear' });
  B.star('paw', -2.75, -2.35, 1.0, { part: 'foreNear' });
  B.star('farpaw', -1.6, -2.83, 0.7, { part: 'foreFar' });
  B.star('knee', 1.88, -1.08, 0.75, { part: 'hindNear' });
  B.star('hock', 2.6, -1.95, 0.7, { part: 'hindNear' });
  B.star('hindpaw', 2.18, -2.86, 0.85, { part: 'hindNear' });
  B.link('regulus', 'eta', 'algieba', 'zeta', 'mu', 'eye', 'nose');
  B.link('regulus', 'chin');
  B.link('algieba', 'zosma', 'tailmid', 'denebola');
  B.link('zosma', 'chertan', 'regulus');
  B.link('regulus', 'elbow', 'paw');
  B.link('regulus', 'farpaw');
  B.link('chertan', 'knee', 'hock', 'hindpaw');

  B.core = P(-0.6, 0.1);
  B.head = P(-3.6, 1.5, 0.5);
  B.mouths.push(P(-4.3, 0.75, 0.5));

  return B.build('lion', (p, c) => {
    const t = c.t;
    const br = c.breath;
    const fwd = Math.max(0, c.lunge);
    const back = Math.max(0, -c.lunge);
    // breathing + crouch / pounce
    p.s(body, 1 + 0.01 * br, 1 + 0.022 * br);
    p.r(body, 0.05 * back - 0.06 * fwd + 0.04 * c.hurt);
    p.o(body, 0.15 * back, -0.22 * back + 0.05 * fwd, 0);
    // head: idle scan, roar lifts, strike thrusts
    p.r(neck, 0.035 * Math.sin(t * 0.7) - 0.16 * c.roar + 0.1 * back - 0.06 * fwd + 0.14 * c.hurt - 0.05 * c.low);
    p.r(head, 0.04 * Math.sin(t * 1.1 + 1) - 0.22 * c.roar - 0.08 * fwd + 0.1 * c.hurt + 0.12 * c.low);
    p.r(jaw, 0.04 + 0.05 * Math.sin(t * 1.4) + 0.38 * c.mouth + 0.08 * c.charge);
    // lifted forepaw: idle flex; strike swipes forward
    const swipe = fwd;
    p.r(fN, -0.06 * Math.sin(t * 0.9) - 0.5 * swipe + 0.2 * back);
    p.r(fN2, 0.08 * Math.sin(t * 0.9 + 0.6) - 0.35 * swipe + 0.25 * back);
    p.r(fN3, 0.12 * Math.sin(t * 0.9 + 1.2) + 0.4 * swipe);
    p.r(fF, 0.02 * br - 0.08 * fwd);
    p.r(hN, -0.015 * br + 0.06 * back);
    p.r(hF, 0.015 * br + 0.06 * back);
    // tail: lazy swish, lashes when charging/roaring
    const lash = 1 + 1.5 * c.charge + c.roar;
    p.wave(tail, 0.06 * lash, t, 1.5 + c.charge * 3, 0.7, 0.35);
    p.r(tail[0], -0.08 * c.roar + 0.05 * c.low);
  });
}

/** auto-registered by ./index.ts (reference example for new creature modules) */
export const CREATURE: CreatureModule = { id: 'lion', build: buildLion };
