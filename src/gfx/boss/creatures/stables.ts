import { Builder, Flow, P, type CreatureDef } from '../rig';
import { mulberry32 } from '../rng';
import type { Prim } from '../sdf';
import type { CreatureModule } from './index';

/** V. The Augean Mire — hulking hunched golem of mud and filth (frontal): broad shoulders, long dragging arms, cattle skull. */
export function buildStables(): CreatureDef {
  const B = new Builder();
  B.facing = 0;
  const R = B.ROOT;
  const body = B.bone('body', R, 0, -1.2);
  const chest = B.bone('chest', body, 0, 0.2);
  const head = B.bone('head', chest, 0, 1.65);
  const rnd = mulberry32(5150);
  const arm: Record<number, number[]> = {};
  const leg: Record<number, number> = {};
  for (const sd of [-1, 1]) {
    const up = B.bone(`arm${sd}`, chest, 2.2 * sd, 1.3);
    const lo = B.bone(`fore${sd}`, up, 3.05 * sd, -0.45);
    const fist = B.bone(`fist${sd}`, lo, 3.4 * sd, -2.2);
    arm[sd] = [up, lo, fist];
    leg[sd] = B.bone(`leg${sd}`, body, 0.85 * sd, -1.5);
  }

  // legs (behind the belly)
  for (const sd of [-1, 1]) {
    B.part(
      `leg${sd}`,
      { z: -0.2, k: 0.2, thick: 0.4, bright: 0.8, flow: Flow.Drip, inner: 0.5 },
      B.cap(leg[sd], 0.85 * sd, -1.5, 1.15 * sd, -2.85, 0.62, 0.52),
      B.ell(leg[sd], 1.3 * sd, -3.1, 0.7, 0.3, 0),
    );
  }
  // torso: hunched lumpy mass
  {
    const lumps: Prim[] = [];
    for (let i = 0; i < 12; i++) {
      const a = Math.PI * (0.12 + 0.76 * (i / 11));
      const x = Math.cos(a) * 2.0;
      const y = 0.55 + Math.sin(a) * 1.45;
      lumps.push(B.circle(chest, x + (rnd() - 0.5) * 0.2, y + (rnd() - 0.5) * 0.15, 0.32 + rnd() * 0.2));
    }
    const drips: Prim[] = [];
    for (let i = 0; i < 7; i++) {
      const x = -1.25 + i * 0.42 + (rnd() - 0.5) * 0.15;
      const len = 0.35 + rnd() * 0.5;
      drips.push(B.cap(body, x, -1.55, x + (rnd() - 0.5) * 0.1, -1.6 - len, 0.15, 0.04));
    }
    B.part(
      'torso',
      { z: 0, k: 0.3, thick: 0.8, flow: Flow.Drip, fill: 1.1 },
      B.ell(chest, 0, 0.55, 2.0, 1.45),
      B.ell(body, 0, -0.75, 1.55, 1.05),
      B.ell(chest, -1.85, 1.25, 1.0, 0.75, 20),
      B.ell(chest, 1.85, 1.25, 1.0, 0.75, -20),
      lumps,
      drips,
    );
  }
  // arms: long, dragging, knuckles near the ground
  for (const sd of [-1, 1]) {
    const [up, lo, fist] = arm[sd];
    const drips: Prim[] = [];
    for (let i = 0; i < 3; i++) {
      const y = -0.4 - i * 0.55;
      const x = (3.05 + 0.18 * i) * sd + 0.25 * sd;
      drips.push(B.cap(lo, x, y, x + 0.1 * sd, y - 0.35 - rnd() * 0.3, 0.1, 0.03));
    }
    const lumps: Prim[] = [];
    for (let i = 0; i < 5; i++) {
      const u = i / 4;
      const x = (2.55 + 0.95 * u + 0.1) * sd;
      const y = 1.0 - 2.6 * u;
      lumps.push(B.circle(u < 0.45 ? up : lo, x + 0.35 * sd, y, 0.17 + rnd() * 0.12));
    }
    B.part(
      `arm${sd}`,
      { z: 0.3, k: 0.18, thick: 0.45, flow: Flow.Drip, inner: 0.7, blend: 0.2 },
      B.cap(up, 2.2 * sd, 1.35, 3.05 * sd, -0.45, 0.62, 0.46),
      B.cap(lo, 3.05 * sd, -0.45, 3.4 * sd, -2.15, 0.46, 0.5),
      B.circle(fist, 3.45 * sd, -2.62, 0.64),
      B.circle(fist, 3.0 * sd, -2.98, 0.3),
      B.circle(fist, 3.38 * sd, -3.12, 0.28),
      B.circle(fist, 3.82 * sd, -2.98, 0.28),
      B.circle(fist, 3.98 * sd, -2.55, 0.24),
      lumps,
      drips,
    );
  }
  // cattle skull with horns, sunk between the shoulders
  B.part(
    'skull',
    { z: 0.5, k: 0.1, thick: 0.25, inner: 1.0, rim: 1.2, tint: 0.25 },
    B.ell(head, 0, 2.02, 0.52, 0.42),
    B.poly(head, [-0.42, 1.95, 0.42, 1.95, 0.24, 1.22, 0.1, 1.08, -0.1, 1.08, -0.24, 1.22], 0.05, 2),
  );
  for (const sd of [-1, 1]) {
    B.part(
      `horn${sd}`,
      { z: 0.45, k: 0.04, thick: 0.1, tint: 0.35, rim: 1.25, inner: 0.9 },
      B.tube(head, [0.35 * sd, 2.22, 0.95 * sd, 2.42, 1.42 * sd, 2.8, 1.52 * sd, 3.32], [0.17, 0.13, 0.08, 0.02]),
    );
  }

  // details: eye sockets, nostrils, mud cracks
  for (const sd of [-1, 1]) {
    B.stroke([0.27 * sd, 2.08, 0.17 * sd, 2.0, 0.27 * sd, 1.94], { part: 'skull', w: 0.035, bright: 2.0, tint: 0.9, smooth: 0 });
    B.stroke([0.06 * sd, 1.22, 0.08 * sd, 1.16], { part: 'skull', w: 0.03, bright: 0.8, smooth: 0 });
    B.stroke([1.1 * sd, 1.8, 0.8 * sd, 0.9, 1.0 * sd, -0.1], { part: 'torso', w: 0.03, bright: 0.45, flow: Flow.Drip });
    B.stroke([2.55 * sd, 0.6, 3.0 * sd, -0.5, 3.15 * sd, -1.6], { part: `arm${sd}`, w: 0.03, bright: 0.4, flow: Flow.Drip });
  }
  B.stroke([-0.9, -0.2, 0.0, -0.45, 0.9, -0.2], { part: 'torso', w: 0.03, bright: 0.45 });
  B.stroke([-0.6, 0.6, 0.0, 0.35, 0.6, 0.6], { part: 'torso', w: 0.03, bright: 0.4 });

  B.star('hornL', -1.52, 3.32, 1.0, { part: 'horn-1' });
  B.star('hornR', 1.52, 3.32, 1.0, { part: 'horn1' });
  B.star('eyeL', -0.22, 2.01, 1.3, { part: 'skull' });
  B.star('eyeR', 0.22, 2.01, 1.3, { part: 'skull' });
  B.star('muzzle', 0, 1.15, 0.7, { part: 'skull' });
  B.star('shoulderL', -2.25, 1.6, 0.95);
  B.star('shoulderR', 2.25, 1.6, 0.95);
  B.star('heart', 0, 0.35, 1.6);
  B.star('elbowL', -3.05, -0.45, 0.8, { part: 'arm-1' });
  B.star('elbowR', 3.05, -0.45, 0.8, { part: 'arm1' });
  B.star('fistL', -3.45, -2.65, 1.1, { part: 'arm-1' });
  B.star('fistR', 3.45, -2.65, 1.1, { part: 'arm1' });
  B.star('gut', 0, -1.2, 0.8);
  B.star('footL', -1.3, -3.1, 0.8, { part: 'leg-1' });
  B.star('footR', 1.3, -3.1, 0.8, { part: 'leg1' });
  B.link('hornL', 'eyeL', 'muzzle', 'eyeR', 'hornR');
  B.link('eyeL', 'eyeR');
  B.link('muzzle', 'heart');
  B.link('fistL', 'elbowL', 'shoulderL', 'heart', 'shoulderR', 'elbowR', 'fistR');
  B.link('heart', 'gut', 'footL');
  B.link('gut', 'footR');

  B.core = P(0, 0.35);
  B.head = P(0, 1.9, 0.6);
  B.mouths.push(P(0, 1.2, 0.7), P(-3.45, -2.6, 0.6), P(3.45, -2.6, 0.6));
  for (const [x, y] of [
    [-3.5, -3.2],
    [3.5, -3.2],
    [-3.25, -0.95],
    [3.25, -0.95],
    [-0.6, -2.1],
    [0.4, -2.2],
    [0.0, 1.05],
    [-1.6, -0.9],
    [1.6, -0.9],
  ]) {
    B.drips.push(P(x, y, 0.3));
  }
  B.scaleAll(1.0, 0, -0.05);

  return B.build('stables', (p, c) => {
    const t = c.t;
    const br = c.breath;
    const fwd = Math.max(0, c.lunge);
    const back = Math.max(0, -c.lunge);
    // heavy breathing and a slow lumbering sway
    p.s(chest, 1 + 0.025 * br, 1 + 0.035 * br);
    p.r(body, 0.03 * Math.sin(t * 0.55) + 0.03 * c.hurt);
    p.o(body, 0, -0.1 * c.low - 0.1 * fwd + 0.1 * back, 0);
    p.r(chest, 0.025 * Math.sin(t * 0.55 + 0.6));
    p.r(head, 0.06 * Math.sin(t * 0.8) + 0.1 * c.hurt + 0.12 * c.low);
    p.o(head, 0, 0.12 * c.roar, 0.3 * c.roar);
    // arms: pendulum drag; wind-up hauls both fists overhead, the strike smashes them down toward the foe
    for (const sd of [-1, 1]) {
      const [up, lo, fist] = arm[sd];
      const sw = Math.sin(t * 1.1 + (sd > 0 ? 0 : 1.7));
      const raise = Math.min(1, back * 1.15) + c.roar * 0.35;
      p.r(up, sd * (0.05 * sw + 2.05 * raise - 0.18 * fwd + 0.25 * c.drain));
      p.r(lo, sd * (0.04 * sw - 0.9 * raise - 0.35 * fwd));
      p.o(up, 0, 0, 0.6 * raise);
      p.o(fist, 0, 0, 1.8 * fwd);
      p.r(fist, 0.1 * sw * sd);
    }
  });
}

export const CREATURE: CreatureModule = { id: 'stables', build: buildStables };
