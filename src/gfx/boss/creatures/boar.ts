import { Builder, Flow, P, type CreatureDef } from '../rig';
import { mulberry32 } from '../rng';
import type { CreatureModule } from './index';

/** IV. The Erymanthian Boar — massive charging boar facing left, head low, curved tusks, bristle ridge, short legs. */
export function buildBoar(): CreatureDef {
  const B = new Builder();
  const R = B.ROOT;
  const body = B.bone('body', R, 0.6, 0.0);
  const head = B.bone('head', body, -1.6, 0.6);
  const jaw = B.bone('jaw', head, -2.9, -0.55);
  const ear = B.bone('ear', head, -2.0, 1.05);
  const fN = B.bone('foreN', body, -1.05, -0.4);
  const fN2 = B.bone('foreN2', fN, -1.35, -1.75);
  const fF = B.bone('foreF', body, -0.6, -0.5);
  const fF2 = B.bone('foreF2', fF, -0.45, -1.8);
  const hN = B.bone('hindN', body, 2.55, 0.0);
  const hN2 = B.bone('hindN2', hN, 2.75, -1.5);
  const hF = B.bone('hindF', body, 2.15, -0.15);
  const hF2 = B.bone('hindF2', hF, 2.05, -1.55);
  const tailPts = [3.45, 0.55, 3.85, 0.4, 4.0, 0.0, 3.92, -0.32];
  const tail = B.chain('tail', body, tailPts);

  // far legs
  B.part(
    'hindFar',
    { z: -0.5, bright: 0.55, rim: 0.8, inner: 0.4, thick: 0.25 },
    B.cap(hF, 2.15, -0.15, 2.05, -1.55, 0.5, 0.24),
    B.cap(hF2, 2.05, -1.55, 2.1, -2.45, 0.22, 0.18),
    B.ell(hF2, 2.0, -2.55, 0.24, 0.12),
  );
  B.part(
    'foreFar',
    { z: -0.5, bright: 0.55, rim: 0.8, inner: 0.4, thick: 0.25 },
    B.cap(fF, -0.6, -0.5, -0.45, -1.8, 0.34, 0.23),
    B.cap(fF2, -0.45, -1.8, -0.55, -2.45, 0.22, 0.17),
    B.ell(fF2, -0.62, -2.55, 0.24, 0.12),
  );
  B.part('tail', { z: -0.2, thick: 0.1, blend: 0.15 }, B.tube(tail, tailPts, [0.09, 0.07, 0.055, 0.04]), B.ell(tail[2], 3.9, -0.42, 0.1, 0.18, -10));
  // bristle ridge along the spine: clumped, swept-back spikes (behind the body so only the spikes show)
  {
    const rnd = mulberry32(44);
    const spikes = [];
    const ridge = [-2.15, 1.05, -1.4, 1.62, -0.6, 1.95, 0.4, 1.9, 1.4, 1.62, 2.4, 1.42, 3.2, 1.05];
    const n = 34;
    for (let i = 0; i < n; i++) {
      const u = (i + rnd() * 0.6) / n;
      const f = u * (ridge.length / 2 - 1);
      const k = Math.min(ridge.length / 2 - 2, Math.floor(f));
      const w = f - k;
      const x = ridge[k * 2] + (ridge[k * 2 + 2] - ridge[k * 2]) * w;
      const y = ridge[k * 2 + 1] + (ridge[k * 2 + 3] - ridge[k * 2 + 1]) * w;
      const clump = 0.55 + 0.45 * Math.abs(Math.sin(u * 17.0));
      const len = (0.28 + 0.5 * Math.sin(Math.PI * Math.min(1, u * 1.2 + 0.05))) * clump * (0.7 + rnd() * 0.6);
      const lean = 0.35 + rnd() * 0.5;
      spikes.push(B.cap(body, x, y - 0.18, x + len * lean, y + len, 0.085 + rnd() * 0.04, 0.012));
    }
    B.part('bristles', { z: -0.1, k: 0.06, thick: 0.15, flow: Flow.Bristle, tint: 0.1, rim: 1.1 }, spikes);
  }
  // body: high shoulder hump sloping to the rump
  B.part(
    'body',
    { z: 0, k: 0.25, thick: 0.7 },
    B.poly(body, [-1.9, 1.2, -1.0, 1.75, 0.2, 1.88, 1.4, 1.55, 2.5, 1.32, 3.35, 0.95, 3.6, 0.25, 3.35, -0.55, 2.6, -0.95, 1.2, -1.15, -0.2, -1.2, -1.2, -1.05, -2.0, -0.45], 0.06, 4),
  );
  // near hind leg
  B.part(
    'hindNear',
    { z: 0.3, k: 0.15, inner: 0.65, thick: 0.4, blend: 0.14 },
    B.cap(hN, 2.6, 0.05, 2.75, -1.5, 0.72, 0.26),
    B.cap(hN2, 2.75, -1.5, 2.6, -2.45, 0.24, 0.19),
    B.ell(hN2, 2.5, -2.56, 0.26, 0.13),
  );
  // head: wedge, low, snout disc forward
  B.part(
    'head',
    { z: 0.35, k: 0.2, thick: 0.45, inner: 0.95, rim: 1.12, tint: 0.06 },
    B.poly(head, [-1.4, 1.35, -2.2, 1.18, -3.0, 0.55, -3.75, -0.05, -4.25, -0.32, -4.35, -0.62, -4.0, -0.72, -3.3, -0.62, -2.5, -0.55, -1.7, -0.6, -1.25, 0.1], 0.05, 3),
    B.ell(head, -4.32, -0.47, 0.12, 0.22, -12),
  );
  B.part(
    'jaw',
    { z: 0.38, k: 0.06, thick: 0.25, inner: 0.85 },
    B.poly(jaw, [-2.5, -0.5, -3.2, -0.6, -3.7, -0.68, -3.8, -0.8, -3.35, -0.9, -2.65, -0.84, -2.3, -0.66], 0.03, 3),
  );
  // tusks curving up and back
  B.part(
    'tusks',
    { z: 0.5, k: 0.03, thick: 0.08, tint: 0.7, rim: 1.6, inner: 1.2, bright: 1.25 },
    B.tube(jaw, [-3.45, -0.7, -3.92, -0.64, -4.12, -0.3, -3.98, 0.08, -3.7, 0.22], [0.14, 0.12, 0.085, 0.045, 0.012]),
    B.tube(head, [-3.2, -0.55, -3.42, -0.42, -3.44, -0.2], [0.07, 0.05, 0.012]),
  );
  B.part('ear', { z: 0.45, k: 0.04, thick: 0.1, inner: 0.9 }, B.poly(ear, [-1.9, 1.05, -2.2, 1.02, -1.82, 1.62, -1.72, 1.25], 0.035, 2));
  // near foreleg (planted forward)
  B.part(
    'foreNear',
    { z: 0.35, k: 0.12, inner: 0.65, thick: 0.4, blend: 0.14 },
    B.cap(fN, -1.05, -0.4, -1.35, -1.75, 0.34, 0.24),
    B.cap(fN2, -1.35, -1.75, -1.6, -2.45, 0.24, 0.19),
    B.ell(fN2, -1.72, -2.56, 0.26, 0.13),
  );

  // details
  B.stroke([-3.05, 0.35, -2.9, 0.42, -2.75, 0.36], { part: 'head', w: 0.025, bright: 1.8, tint: 0.85, smooth: 0 });
  B.stroke([-3.2, 0.6, -2.85, 0.68, -2.5, 0.62], { part: 'head', w: 0.02, bright: 0.6 });
  B.stroke([-4.15, -0.45, -4.12, -0.55], { part: 'head', w: 0.035, bright: 1.0, smooth: 0 });
  B.stroke([-3.55, -0.66, -3.95, -0.55, -4.06, -0.25, -3.92, 0.06], { part: 'tusks', w: 0.03, bright: 1.6, tint: 0.9 });
  B.stroke([-3.7, -0.2, -3.3, -0.25, -2.9, -0.15], { part: 'head', w: 0.02, bright: 0.5 });
  B.stroke([-0.9, 1.5, -0.55, 0.6, -0.8, -0.4], { part: 'body', w: 0.03, bright: 0.5 });
  B.stroke([0.4, 1.4, 0.7, 0.4, 0.5, -0.6], { part: 'body', w: 0.025, bright: 0.35 });
  B.stroke([2.25, 0.9, 2.95, 0.2, 2.8, -0.7], { part: 'hindNear', w: 0.03, bright: 0.5 });
  B.stroke([-1.5, 1.4, -1.6, 0.6, -1.4, -0.3], { part: 'head', w: 0.025, bright: 0.45 });

  B.star('snout', -4.38, -0.45, 1.0, { part: 'head' });
  B.star('eye', -2.9, 0.4, 1.1, { part: 'head' });
  B.star('tusk', -3.72, 0.22, 1.25, { part: 'tusks' });
  B.star('ear', -1.82, 1.58, 0.75, { part: 'ear' });
  B.star('hump', -0.4, 1.85, 1.3);
  B.star('back', 1.4, 1.5, 0.9);
  B.star('rump', 3.3, 0.85, 1.0);
  B.star('tail', 3.9, -0.4, 0.65, { part: 'tail' });
  B.star('chest', -1.3, -0.7, 1.2);
  B.star('foreHoof', -1.7, -2.55, 0.85, { part: 'foreNear' });
  B.star('farHoof', -0.62, -2.55, 0.6, { part: 'foreFar' });
  B.star('hock', 2.75, -1.5, 0.7, { part: 'hindNear' });
  B.star('hindHoof', 2.5, -2.55, 0.85, { part: 'hindNear' });
  B.star('farHindHoof', 2.0, -2.55, 0.6, { part: 'hindFar' });
  B.link('tusk', 'snout', 'eye', 'ear', 'hump', 'back', 'rump', 'tail');
  B.link('eye', 'chest', 'hump');
  B.link('chest', 'foreHoof');
  B.link('chest', 'farHoof');
  B.link('back', 'hock', 'hindHoof');
  B.link('hock', 'farHindHoof');

  B.core = P(0.2, 0.3);
  B.head = P(-3.0, 0.2, 0.5);
  B.mouths.push(P(-3.9, -0.5, 0.5));
  B.scaleAll(1.08, 0.15, 0.1);

  return B.build('boar', (p, c) => {
    const t = c.t;
    const br = c.breath;
    const fwd = Math.max(0, c.lunge);
    const back = Math.max(0, -c.lunge);
    // heavy breathing + snorts
    const snort = Math.max(0, Math.sin(t * 0.7)) ** 12;
    p.s(body, 1 + 0.012 * br, 1 + 0.03 * br);
    p.r(body, 0.04 * back - 0.05 * fwd + 0.04 * c.hurt);
    p.o(body, 0.12 * back, -0.12 * back, 0);
    // head: low charge, tusk rip swings up
    p.r(head, 0.04 * Math.sin(t * 1.1) - 0.08 * snort + 0.15 * back - 0.35 * fwd * fwd + 0.25 * c.roar + 0.12 * c.hurt + 0.06 * c.low);
    p.r(jaw, 0.04 + 0.12 * c.mouth + 0.05 * snort);
    p.r(ear, 0.15 * Math.max(0, Math.sin(t * 0.9 + 1)) ** 10 - 0.2 * c.roar);
    // pawing the ground with the near forefoot
    const paw = Math.max(0, Math.sin(t * 1.6)) ** 3 * (0.4 + c.charge);
    p.r(fN, 0.25 * paw - 0.2 * fwd + 0.1 * back);
    p.r(fN2, -0.35 * paw);
    p.r(fF, -0.15 * fwd + 0.08 * back);
    p.r(hN, 0.1 * fwd - 0.06 * back);
    p.r(hF, 0.1 * fwd - 0.06 * back);
    p.wave(tail, 0.15 + 0.2 * c.charge, t, 3.0, 0.9, 0.2);
  });
}

export const CREATURE: CreatureModule = { id: 'boar', build: buildBoar };
