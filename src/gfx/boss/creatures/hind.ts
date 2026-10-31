import { Builder, Flow, P, type CreatureDef } from '../rig';
import type { CreatureModule } from './index';

/** III. The Ceryneian Hind — graceful deer mid-leap facing left, slender legs, great branching golden antlers. */
export function buildHind(): CreatureDef {
  const B = new Builder();
  const R = B.ROOT;
  const body = B.bone('body', R, 0.4, 0.1);
  const neck = B.bone('neck', body, -1.3, 0.45);
  const head = B.bone('head', neck, -2.15, 1.65);
  const earN = B.bone('earN', head, -2.15, 2.0);
  const fN = B.bone('foreN', body, -1.15, -0.15);
  const fN2 = B.bone('foreN2', fN, -1.9, -0.85);
  const fF = B.bone('foreF', body, -0.85, -0.25);
  const fF2 = B.bone('foreF2', fF, -1.6, -1.05);
  const hN = B.bone('hindN', body, 1.8, 0.15);
  const hN2 = B.bone('hindN2', hN, 2.2, -0.6);
  const hN3 = B.bone('hindN3', hN2, 3.0, -1.0);
  const hF = B.bone('hindF', body, 1.55, 0.05);
  const hF2 = B.bone('hindF2', hF, 2.0, -0.75);
  const hF3 = B.bone('hindF3', hF2, 2.75, -1.3);
  const tail = B.bone('tail', body, 2.35, 0.55);

  // far limbs
  B.part(
    'hindFar',
    { z: -0.5, bright: 0.55, rim: 0.8, inner: 0.4, thick: 0.2, blend: 0.1 },
    B.cap(hF, 1.6, 0.0, 2.0, -0.75, 0.36, 0.17),
    B.cap(hF2, 2.0, -0.75, 2.75, -1.3, 0.15, 0.09),
    B.cap(hF3, 2.75, -1.3, 3.45, -1.95, 0.085, 0.06),
    B.cap(hF3, 3.42, -1.92, 3.6, -2.08, 0.07, 0.05),
  );
  B.part(
    'foreFar',
    { z: -0.5, bright: 0.55, rim: 0.8, inner: 0.4, thick: 0.2, blend: 0.1 },
    B.cap(fF, -0.85, -0.25, -1.6, -1.05, 0.22, 0.11),
    B.cap(fF2, -1.6, -1.05, -1.05, -1.55, 0.1, 0.065),
    B.cap(fF2, -1.05, -1.55, -0.88, -1.62, 0.07, 0.05),
  );
  // far antler (behind the head)
  const antler = (b: number, ox: number, oy: number, sc: number) => [
    B.tube(b, [-2.3 + ox, 2.08 + oy, -2.05 + ox, 2.62 * sc + oy, -1.6 + ox, 3.02 * sc + oy, -1.0 + ox, 3.22 * sc + oy, -0.42 + ox, 3.15 * sc + oy], [0.075, 0.065, 0.055, 0.045, 0.03]),
    B.cap(b, -2.22 + ox, 2.3 + oy, -2.68 + ox, 2.6 * sc + oy, 0.05, 0.014),
    B.cap(b, -1.98 + ox, 2.72 * sc + oy, -2.2 + ox, 3.25 * sc + oy, 0.05, 0.013),
    B.cap(b, -1.58 + ox, 3.02 * sc + oy, -1.66 + ox, 3.55 * sc + oy, 0.047, 0.012),
    B.cap(b, -1.08 + ox, 3.2 * sc + oy, -0.98 + ox, 3.66 * sc + oy, 0.042, 0.011),
    B.cap(b, -0.45 + ox, 3.15 * sc + oy, -0.22 + ox, 3.45 * sc + oy, 0.03, 0.01),
  ];
  B.part('antlerFar', { z: -0.3, bright: 0.6, k: 0.05, thick: 0.08, tint: 0.2, inner: 0.5 }, ...antler(head, 0.3, -0.05, 0.96));
  B.part('tail', { z: -0.1, k: 0.08, thick: 0.1 }, B.cap(tail, 2.3, 0.55, 2.7, 0.98, 0.13, 0.06), B.ell(tail, 2.68, 0.98, 0.09, 0.14, 40));
  // torso (tilted up at the front: mid-leap)
  B.part(
    'body',
    { z: 0, k: 0.22, thick: 0.5 },
    B.poly(body, [-1.05, 0.78, 0.3, 0.6, 1.3, 0.72, 2.1, 0.86, 2.48, 0.45, 2.35, -0.12, 1.7, -0.45, 0.4, -0.5, -0.85, -0.55, -1.62, -0.15, -1.72, 0.38], 0.04, 4),
  );
  // near hind leg (pushing off, extended back)
  B.part(
    'hindNear',
    { z: 0.3, k: 0.12, inner: 0.65, thick: 0.3, blend: 0.12 },
    B.cap(hN, 1.85, 0.12, 2.2, -0.6, 0.45, 0.2),
    B.cap(hN2, 2.2, -0.6, 3.0, -1.0, 0.17, 0.1),
    B.cap(hN3, 3.0, -1.0, 3.8, -1.5, 0.095, 0.065),
    B.cap(hN3, 3.78, -1.48, 3.98, -1.62, 0.075, 0.055),
  );
  // neck + head
  B.part(
    'neck',
    { z: 0.2, k: 0.15, thick: 0.35, inner: 0.7, blend: 0.18 },
    B.cap(neck, -1.3, 0.4, -2.12, 1.62, 0.44, 0.2),
    B.cap(neck, -1.55, 0.05, -2.05, 1.3, 0.25, 0.15),
  );
  B.part(
    'head',
    { z: 0.35, k: 0.1, thick: 0.25, inner: 0.95, rim: 1.1, tint: 0.08 },
    B.ell(head, -2.32, 1.86, 0.3, 0.24, -18),
    B.poly(head, [-2.15, 2.06, -2.55, 2.0, -2.95, 1.66, -3.18, 1.44, -3.14, 1.33, -2.85, 1.36, -2.5, 1.55, -2.12, 1.62], 0.04, 3),
    B.cap(head, -2.12, 1.98, -1.92, 2.28, 0.07, 0.03),
  );
  B.part('earNear', { z: 0.4, k: 0.04, thick: 0.1, inner: 0.9 }, B.cap(earN, -2.12, 2.02, -1.66, 2.36, 0.11, 0.025));
  B.part('antler', { z: 0.45, k: 0.05, thick: 0.08, tint: 0.3, rim: 1.2, inner: 0.8 }, ...antler(head, 0, 0, 1));
  // near foreleg (tucked)
  B.part(
    'foreNear',
    { z: 0.35, k: 0.1, inner: 0.65, thick: 0.25, blend: 0.1 },
    B.cap(fN, -1.15, -0.15, -1.9, -0.85, 0.26, 0.12),
    B.cap(fN2, -1.9, -0.85, -1.4, -1.45, 0.11, 0.07),
    B.cap(fN2, -1.4, -1.45, -1.22, -1.52, 0.075, 0.055),
  );

  // details
  B.stroke([-2.62, 1.8, -2.52, 1.84, -2.42, 1.8], { part: 'head', w: 0.02, bright: 1.7, tint: 0.8, smooth: 0 });
  B.stroke([-3.1, 1.42, -3.0, 1.45], { part: 'head', w: 0.03, bright: 1.0, smooth: 0 });
  B.stroke([-1.6, 0.6, -1.05, 0.25, -0.5, 0.1], { part: 'body', w: 0.022, bright: 0.45 });
  B.stroke([0.5, 0.45, 1.2, 0.2, 1.7, 0.4], { part: 'body', w: 0.02, bright: 0.35 });
  B.stroke([1.75, 0.6, 2.15, 0.1, 2.05, -0.35], { part: 'hindNear', w: 0.022, bright: 0.45 });
  B.stroke([-1.6, 1.1, -1.95, 1.45], { part: 'neck', w: 0.02, bright: 0.4, smooth: 0 });
  // white rump / belly patches: soft sparkle stripes
  B.stroke([-0.6, -0.42, 0.4, -0.4, 1.4, -0.35], { part: 'body', w: 0.04, bright: 0.35, tint: 0.4 });

  // stars: antler tips are golden
  const tips: [string, number, number, number][] = [
    ['tine1', -2.68, 2.6, 0.8],
    ['tine2', -2.2, 3.25, 0.95],
    ['tine3', -1.66, 3.55, 1.05],
    ['tine4', -0.98, 3.66, 1.0],
    ['tine5', -0.22, 3.45, 0.85],
  ];
  for (const [n, x, y, m] of tips) B.star(n, x, y, m, { gold: true, part: 'antler' });
  B.star('ftine3', -1.36, 3.36, 0.65, { gold: true, part: 'antlerFar' });
  B.star('ftine4', -0.68, 3.47, 0.6, { gold: true, part: 'antlerFar' });
  B.star('crown', -2.2, 2.12, 0.8, { part: 'head' });
  B.star('eye', -2.52, 1.82, 1.0, { part: 'head' });
  B.star('nose', -3.12, 1.4, 0.75, { part: 'head' });
  B.star('withers', -0.95, 0.7, 1.1);
  B.star('heart', -1.2, -0.25, 1.3);
  B.star('rump', 2.1, 0.75, 1.0);
  B.star('tail', 2.7, 1.0, 0.7, { part: 'tail' });
  B.star('foreKnee', -1.9, -0.85, 0.7, { part: 'foreNear' });
  B.star('foreHoof', -1.25, -1.5, 0.8, { part: 'foreNear' });
  B.star('farHoof', -0.92, -1.6, 0.6, { part: 'foreFar' });
  B.star('hock', 3.0, -1.0, 0.75, { part: 'hindNear' });
  B.star('hindHoof', 3.92, -1.58, 0.85, { part: 'hindNear' });
  B.star('farHindHoof', 3.55, -2.05, 0.6, { part: 'hindFar' });
  B.link('nose', 'eye', 'crown', 'tine1');
  B.link('crown', 'tine2');
  B.link('crown', 'tine3', 'tine4', 'tine5');
  B.link('tine3', 'ftine3', 'ftine4');
  B.link('eye', 'withers', 'rump', 'tail');
  B.link('withers', 'heart', 'foreKnee', 'foreHoof');
  B.link('heart', 'farHoof');
  B.link('rump', 'hock', 'hindHoof');
  B.link('hock', 'farHindHoof');

  B.core = P(0.0, 0.1);
  B.head = P(-2.5, 1.75, 0.4);
  B.mouths.push(P(-3.05, 1.4, 0.4));
  B.scaleAll(1.12, 0.05, -0.75);

  return B.build('hind', (p, c) => {
    const t = c.t;
    const fwd = Math.max(0, c.lunge);
    const back = Math.max(0, -c.lunge);
    // floating leap: gentle bob and a slow gallop cycle
    const g = Math.sin(t * 2.1);
    const g2 = Math.sin(t * 2.1 + 1.2);
    p.o(body, 0, 0.06 * g, 0);
    p.r(body, 0.025 * g2 - 0.05 * fwd + 0.04 * back + 0.05 * c.hurt);
    p.r(neck, 0.04 * Math.sin(t * 1.3) + 0.15 * fwd - 0.1 * back - 0.12 * c.roar + 0.1 * c.hurt);
    // antler gore: head dips and thrusts
    p.r(head, 0.05 * Math.sin(t * 1.7 + 0.5) + 0.32 * fwd - 0.12 * back - 0.15 * c.roar + 0.15 * c.low);
    p.r(earN, 0.12 * Math.max(0, Math.sin(t * 0.8)) ** 8 - 0.25 * c.roar);
    // legs: flurry of hooves on volley
    const kick = c.volley * Math.sin(t * 22);
    p.r(fN, 0.1 * g + 0.25 * kick - 0.2 * fwd);
    p.r(fN2, -0.15 * g - 0.3 * kick);
    p.r(fF, 0.1 * g2 - 0.2 * kick);
    p.r(fF2, -0.12 * g2 + 0.25 * kick);
    p.r(hN, -0.08 * g + 0.15 * kick + 0.1 * back);
    p.r(hN2, 0.06 * g);
    p.r(hN3, 0.08 * g - 0.2 * kick);
    p.r(hF, -0.08 * g2 - 0.12 * kick);
    p.r(hF2, 0.06 * g2);
    p.r(hF3, 0.06 * g2);
    p.r(tail, 0.2 * Math.sin(t * 4.3) * (0.4 + c.charge) - 0.2 * c.roar);
  });
}

export const CREATURE: CreatureModule = { id: 'hind', build: buildHind };
