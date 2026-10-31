import { Builder, Flow, P, type CreatureDef } from '../rig';
import type { CreatureModule } from './index';

/** VII. The Cretan Bull — charging, head lowered, long forward-curving horns, heavy hump, whipping tail. */
export function buildBull(): CreatureDef {
  const B = new Builder();
  const R = B.ROOT;
  const body = B.bone('body', R, 0.6, 0.0);
  const neck = B.bone('neck', body, -1.5, 0.6);
  const head = B.bone('head', neck, -2.35, 0.3);
  const fN = B.bone('foreN', body, -1.3, -0.35);
  const fN2 = B.bone('foreN2', fN, -1.75, -1.65);
  const fF = B.bone('foreF', body, -0.9, -0.45);
  const fF2 = B.bone('foreF2', fF, -0.8, -1.75);
  const hN = B.bone('hindN', body, 2.4, 0.2);
  const hN2 = B.bone('hindN2', hN, 3.0, -1.45);
  const hF = B.bone('hindF', body, 2.0, 0.0);
  const hF2 = B.bone('hindF2', hF, 2.45, -1.5);
  const tailPts = [3.1, 0.85, 3.55, 1.28, 3.92, 1.9, 4.18, 2.42, 4.12, 2.72];
  const tail = B.chain('tail', body, tailPts);

  B.part(
    'hindFar',
    { z: -0.5, bright: 0.55, rim: 0.8, inner: 0.4, thick: 0.25 },
    B.cap(hF, 2.0, 0.0, 2.45, -1.5, 0.62, 0.22),
    B.cap(hF2, 2.45, -1.5, 2.25, -2.6, 0.19, 0.16),
    B.ell(hF2, 2.18, -2.72, 0.22, 0.12),
  );
  B.part(
    'foreFar',
    { z: -0.5, bright: 0.55, rim: 0.8, inner: 0.4, thick: 0.25 },
    B.cap(fF, -0.9, -0.45, -0.8, -1.75, 0.38, 0.22),
    B.cap(fF2, -0.8, -1.75, -0.55, -2.6, 0.2, 0.16),
    B.ell(fF2, -0.48, -2.72, 0.22, 0.12),
  );
  // far horn behind the head
  B.part(
    'hornFar',
    { z: -0.25, bright: 0.65, k: 0.04, thick: 0.1, tint: 0.25, inner: 0.5 },
    B.tube(head, [-2.5, 0.78, -2.95, 1.25, -3.65, 1.42, -4.15, 1.78, -4.22, 2.25], [0.19, 0.15, 0.1, 0.06, 0.015]),
  );
  B.part('tail', { z: -0.15, thick: 0.12, blend: 0.18 }, B.tube(tail, tailPts, [0.09, 0.075, 0.06, 0.05, 0.05]), B.ell(tail[3], 4.1, 2.78, 0.16, 0.26, -15));
  B.part(
    'body',
    { z: 0, k: 0.25, thick: 0.75 },
    B.poly(
      body,
      [-1.55, 1.45, -0.6, 2.25, 0.5, 1.75, 1.6, 1.3, 2.6, 1.28, 3.1, 0.85, 3.18, 0.0, 2.82, -0.62, 1.8, -0.85, 0.4, -1.05, -0.9, -1.32, -1.85, -1.12, -2.3, -0.35, -2.2, 0.6],
      0.06,
      4,
    ),
  );
  B.part(
    'hindNear',
    { z: 0.3, k: 0.15, inner: 0.65, thick: 0.4, blend: 0.14 },
    B.cap(hN, 2.45, 0.25, 3.0, -1.45, 0.78, 0.24),
    B.cap(hN2, 3.0, -1.45, 2.78, -2.6, 0.21, 0.17),
    B.ell(hN2, 2.7, -2.72, 0.24, 0.13),
  );
  B.part(
    'foreNear',
    { z: 0.35, k: 0.12, inner: 0.65, thick: 0.4, blend: 0.14 },
    B.cap(fN, -1.3, -0.35, -1.75, -1.65, 0.42, 0.24),
    B.cap(fN2, -1.75, -1.65, -2.0, -2.6, 0.22, 0.17),
    B.ell(fN2, -2.08, -2.72, 0.24, 0.13),
  );
  // head lowered for the charge: broad forehead forward, muzzle near the ground
  B.part(
    'head',
    { z: 0.4, k: 0.18, thick: 0.45, inner: 0.95, rim: 1.12, tint: 0.06, blend: 0.15 },
    B.cap(neck, -1.45, 0.8, -2.38, 0.3, 0.58, 0.4),
    B.poly(head, [-2.3, 0.7, -2.68, 0.8, -3.22, 0.4, -3.52, -0.36, -3.9, -0.92, -3.86, -1.25, -3.4, -1.36, -2.88, -0.72, -2.4, -0.05], 0.07, 3),
    B.cap(head, -2.45, 0.35, -2.02, 0.62, 0.13, 0.05),
  );
  B.part(
    'horn',
    { z: 0.55, k: 0.04, thick: 0.1, tint: 0.35, rim: 1.3, inner: 1.0 },
    B.tube(head, [-2.72, 0.62, -3.38, 0.95, -4.12, 0.95, -4.62, 1.2, -4.76, 1.66], [0.23, 0.17, 0.12, 0.07, 0.015]),
  );

  // details
  B.stroke([-3.3, -0.05, -3.18, 0.0, -3.06, -0.04], { part: 'head', w: 0.025, bright: 1.9, tint: 0.85, smooth: 0 });
  B.stroke([-3.72, -1.25, -3.66, -1.36], { part: 'head', w: 0.035, bright: 1.0, smooth: 0 });
  B.stroke([-3.5, 0.15, -3.62, -0.4, -3.75, -0.95], { part: 'head', w: 0.02, bright: 0.55 });
  B.stroke([-3.1, -1.35, -2.85, -0.85, -2.5, -0.4], { part: 'head', w: 0.02, bright: 0.4 });
  B.stroke([-1.9, -0.6, -2.0, 0.1, -1.85, 0.8], { part: 'body', w: 0.03, bright: 0.5 });
  B.stroke([-0.9, 1.6, -0.6, 0.5, -0.85, -0.7], { part: 'body', w: 0.03, bright: 0.5 });
  B.stroke([0.6, 1.3, 0.85, 0.3, 0.6, -0.8], { part: 'body', w: 0.025, bright: 0.35 });
  B.stroke([2.2, 1.0, 2.9, 0.3, 2.8, -0.6], { part: 'hindNear', w: 0.03, bright: 0.5 });
  B.stroke([4.02, 2.6, 4.08, 2.9, 4.12, 3.02], { part: 'tail', w: 0.02, bright: 0.7, flow: Flow.Wisp });

  // stars: Taurus — Aldebaran the eye, the Hyades V of the face, horn tips, the Pleiades on the hump
  B.star('aldebaran', -3.18, -0.02, 1.75, { part: 'head' });
  B.star('nose', -3.85, -1.3, 0.9, { part: 'head' });
  B.star('chin', -3.3, -1.45, 0.7, { part: 'head' });
  B.star('poll', -2.7, 0.66, 0.9, { part: 'head' });
  B.star('elnath', -4.76, 1.66, 1.3, { part: 'horn' });
  B.star('hornmid', -4.12, 0.95, 0.7, { part: 'horn' });
  B.star('zeta', -4.22, 2.25, 0.9, { part: 'hornFar' });
  B.star('hump', -0.6, 2.12, 1.1);
  B.star('back', 1.6, 1.22, 0.85);
  B.star('rump', 2.95, 0.85, 1.0);
  B.star('tailtip', 4.1, 2.8, 1.0, { part: 'tail' });
  B.star('brisket', -1.75, -0.85, 1.0);
  B.star('foreHoof', -2.08, -2.72, 0.85, { part: 'foreNear' });
  B.star('farHoof', -0.48, -2.72, 0.6, { part: 'foreFar' });
  B.star('hock', 3.0, -1.45, 0.75, { part: 'hindNear' });
  B.star('hindHoof', 2.7, -2.72, 0.85, { part: 'hindNear' });
  const pleiades: [number, number][] = [
    [-0.15, 1.42],
    [0.02, 1.52],
    [0.12, 1.38],
    [-0.05, 1.28],
    [0.22, 1.5],
    [-0.25, 1.55],
  ];
  pleiades.forEach(([x, y], i) => B.star(`pl${i}`, x - 0.1, y + 0.2, 0.35 + (i === 1 ? 0.15 : 0)));
  B.link('elnath', 'hornmid', 'poll', 'aldebaran', 'nose');
  B.link('aldebaran', 'chin');
  B.link('zeta', 'poll');
  B.link('poll', 'hump', 'back', 'rump', 'tailtip');
  B.link('hump', 'brisket', 'foreHoof');
  B.link('brisket', 'farHoof');
  B.link('back', 'hock', 'hindHoof');
  B.starOrder = null;

  B.core = P(-0.3, 0.4);
  B.head = P(-3.2, -0.1, 0.5);
  B.mouths.push(P(-3.8, -1.3, 0.6));
  B.scaleAll(1.04, 0.2, 0.0);

  return B.build('bull', (p, c) => {
    const t = c.t;
    const br = c.breath;
    const fwd = Math.max(0, c.lunge);
    const back = Math.max(0, -c.lunge);
    const snort = Math.max(0, Math.sin(t * 0.8 + 1)) ** 14;
    p.s(body, 1 + 0.012 * br, 1 + 0.028 * br);
    p.r(body, 0.05 * back - 0.05 * fwd + 0.04 * c.hurt);
    p.o(body, 0.12 * back, -0.15 * back, 0);
    // gore: head drops then hooks upward
    p.r(neck, 0.03 * Math.sin(t * 0.9) + 0.12 * back - 0.08 * fwd + 0.1 * c.hurt - 0.1 * c.roar);
    p.r(head, 0.05 * Math.sin(t * 1.2) - 0.06 * snort + 0.15 * back - 0.4 * fwd * fwd + 0.08 * c.low - 0.25 * c.roar);
    const paw = Math.max(0, Math.sin(t * 1.4 + 0.5)) ** 4 * (0.35 + c.charge);
    p.r(fN, -0.35 * paw - 0.15 * fwd + 0.1 * back);
    p.r(fN2, 0.45 * paw);
    p.r(fF, -0.12 * fwd + 0.05 * back);
    p.r(hN, 0.1 * fwd - 0.05 * back);
    p.r(hF, 0.08 * fwd - 0.05 * back);
    // whipping tail
    p.wave(tail, 0.12 + 0.18 * c.charge + 0.1 * c.roar, t, 2.6 + 3 * c.charge, 0.75, 0.35);
  });
}

export const CREATURE: CreatureModule = { id: 'bull', build: buildBull };
