// Scoring, elemental hits and player-side combat SFX.

import { BAR, BELL, ANVIL, bell, brass, fm, grains, noise, pluck, tone, type Bus } from './voices';
import { boom } from './instruments';
import { jit, kf, last, type SfxFn, type SfxKit } from './sfxkit';

/* ---------------------------------------------------------------- scoring */

/** Bright glassy chip tick on scale degree `deg` above the key's upper octave. */
export function chipAt(b: Bus, t: number, k: SfxKit, deg: number): number {
  const f = kf(k, 7 + deg);
  const pan = (k.r() * 2 - 1) * 0.15;
  return last(
    bell(b, { t, f, partials: BAR, v: 0.24, a: 0.0008, d: 0.3, spread: 3, pan }),
    fm(b, { t, f, ratio: 3.5, index: 1.2, v: 0.05, a: 0.0008, d: 0.12, pan }),
    tone(b, { t, f: f * 2, v: 0.05, a: 0.0008, d: 0.06, pan }),
    noise(b, { t, f: 6500, q: 2, v: 0.08, a: 0.0005, d: 0.006 }),
  );
}

/** Warm red-hot mult hit (bell + saturated FM + sizzle) on scale degree `deg`. */
export function multAt(b: Bus, t: number, k: SfxKit, deg: number): number {
  const f = kf(k, deg);
  return last(
    bell(b, { t, f, partials: BELL, v: 0.2, a: 0.001, d: 0.55, spread: 4, wet: 0.12 }),
    fm(b, { t, f, ratio: 1.4, index: 2.2, index2: 0.1, idxTime: 0.25, v: 0.12, a: 0.001, d: 0.45, drive: 1.5 }),
    noise(b, { t, f: 5500, q: 1, v: 0.06, a: 0.002, d: 0.08 }),
    tone(b, { t, f: f / 2, v: 0.12, a: 0.002, d: 0.25 }),
  );
}

const chip: SfxFn = (b, t, k) => chipAt(b, t, k, 2);
const mult: SfxFn = (b, t, k) => multAt(b, t, k, 2);

const xmult: SfxFn = (b, t, k) => {
  const f = kf(k, 4);
  const ti = t + 0.03;
  return last(
    tone(b, { t, type: 'sawtooth', f: f * 2, f2: f * 4, glide: 0.06, lp: 3000, v: 0.09, a: 0.004, d: 0.08 }),
    fm(b, { t: ti, f, ratio: 1.41, index: 3, index2: 0.2, idxTime: 0.6, v: 0.3, a: 0.001, d: 1.3, drive: 2.5, wet: 0.3 }),
    bell(b, { t: ti, f: f * 1.5, partials: BELL, v: 0.16, d: 1.1, wet: 0.3, spread: 5 }),
    tone(b, { t: ti, f: 120 * k.p, f2: 55 * k.p, glide: 0.15, v: 0.42, a: 0.002, d: 0.35 }),
    noise(b, { t: ti, f: 2500, q: 0.8, v: 0.2, a: 0.0006, d: 0.04 }),
  );
};

const total: SfxFn = (b, t, k) => {
  let e = last(
    boom(b, t, 0.5, { f0: 120 * k.p, f1: 45 * k.p, d: 0.6, wet: 0.15 }),
    noise(b, { t, hp: 5000, v: 0.12, a: 0.001, d: 0.5, wet: 0.3 }),
  );
  [0, 4, 7, 9].forEach((d, i) => {
    e = last(e, brass(b, { t, f: kf(k, d), v: 0.12, a: 0.015, h: 0.08, d: 0.6, bright: 6, wet: 0.25, pan: (i - 1.5) * 0.25 }));
    e = last(e, pluck(b, { t: t + i * 0.015, f: kf(k, d + 7), v: 0.22, bright: true, wet: 0.2 }));
  });
  return e;
};

const bigTotal: SfxFn = (b, t, k) => {
  let e = last(
    boom(b, t, 0.7, { f0: 90 * k.p, f1: 30 * k.p, d: 2.2, drive: 1.6, wet: 0.2 }),
    tone(b, { t, f: 58 * k.p, f2: 26 * k.p, glide: 1.6, v: 0.4, a: 0.01, d: 2.0 }),
    noise(b, { t, f: 2200, q: 0.7, v: 0.32, a: 0.0006, d: 0.08 }),
    noise(b, { t, hp: 6000, v: 0.1, a: 0.002, d: 1.8, wet: 0.4 }),
  );
  [0, 4, 7, 9, 11].forEach((d, i) => {
    e = last(e, brass(b, { t: t + 0.01, f: kf(k, d), v: 0.09, a: 0.02, h: 0.3, d: 1.4, bright: 7, wet: 0.35, pan: (i - 2) * 0.2 }));
  });
  for (let i = 0; i < 10; i++) {
    const ti = t + 0.1 + i * 0.14 + k.r() * 0.05;
    e = last(e, bell(b, { t: ti, f: kf(k, 14 + Math.floor(k.r() * 9)), partials: BAR, v: 0.07, d: 0.9, wet: 0.5, pan: (k.r() * 2 - 1) * 0.8 }));
  }
  return e;
};

/* ---------------------------------------------------------- element hits */

const hitFire: SfxFn = (b, t, k) => {
  const p = k.p;
  const times = Array.from({ length: 26 }, () => k.r() * 0.55).sort((x, y) => x - y);
  const amps = times.map(() => 0.3 + k.r() * 0.7);
  return last(
    noise(b, { t, color: 'brown', ft: 'lowpass', fpts: [[0, 300 * p], [0.08, 2600 * p], [0.5, 500 * p]], q: 3, v: 0.9, a: 0.03, d: 0.5, drive: 2.5, wet: 0.2 }),
    noise(b, { t, color: 'pink', f: 900 * p, q: 0.7, v: 0.35, a: 0.02, d: 0.45, pan: -0.3, pan2: 0.3 }),
    grains(b, { t, times, f: [1800, 7000], q: 1.2, d: [0.002, 0.008], v: 0.5, amps, r: k.r }),
    tone(b, { t, f: 110 * p, f2: 52 * p, glide: 0.1, v: 0.45, a: 0.002, d: 0.22 }),
  );
};

const hitWater: SfxFn = (b, t, k) => {
  const p = k.p;
  let e = last(
    noise(b, { t, fpts: [[0, 1200 * p], [0.05, 3800 * p], [0.35, 2200 * p]], q: 0.7, v: 0.45, a: 0.004, d: 0.38, wet: 0.2 }),
    noise(b, { t, color: 'pink', f: 700 * p, q: 0.8, v: 0.25, a: 0.003, d: 0.2 }),
    tone(b, { t, f: 95 * p, f2: 45 * p, glide: 0.12, v: 0.42, a: 0.002, d: 0.25 }),
  );
  for (let i = 0; i < 9; i++) {
    const ti = t + 0.04 + k.r() * 0.45;
    const f0 = (350 + k.r() * 550) * p;
    e = last(e, tone(b, { t: ti, f: f0, f2: f0 * 1.7, glide: 0.03 + k.r() * 0.03, v: 0.05 + k.r() * 0.06, a: 0.002, d: 0.04 + k.r() * 0.04, pan: (k.r() * 2 - 1) * 0.6 }));
  }
  return e;
};

const hitWind: SfxFn = (b, t, k) => {
  const p = k.p;
  return last(
    noise(b, { t, fpts: [[0, 900 * p], [0.09, 6500 * p], [0.3, 2500 * p]], q: 2.2, v: 0.55, a: 0.02, d: 0.28, pan: -0.7, pan2: 0.7, wet: 0.15 }),
    noise(b, { t: t + 0.06, hp: 6500, v: 0.18, a: 0.0006, d: 0.03 }),
    tone(b, { t, f: 1700 * p, f2: 2600 * p, glide: 0.12, v: 0.07, a: 0.03, d: 0.25, vib: 40, vibRate: 9, wet: 0.3 }),
    tone(b, { t: t + 0.05, f: 140 * p, f2: 70 * p, glide: 0.08, v: 0.25, a: 0.002, d: 0.12 }),
  );
};

const hitEarth: SfxFn = (b, t, k) => {
  const p = k.p;
  const N = 30;
  const times = Array.from({ length: N }, (_, i) => 0.06 + Math.pow(i / N, 1.3) * 0.8 + k.r() * 0.02).sort((x, y) => x - y);
  const amps = times.map((_, i) => (1 - i / N) * (0.5 + k.r() * 0.5));
  return last(
    noise(b, { t, color: 'brown', ft: 'lowpass', f: 1200 * p, q: 1, v: 1.0, a: 0.002, d: 0.3, drive: 3 }),
    tone(b, { t, f: 85 * p, f2: 36 * p, glide: 0.25, v: 0.55, a: 0.002, d: 0.45, drive: 1.3 }),
    noise(b, { t, f: 650 * p, q: 3, v: 0.4, a: 0.0006, d: 0.035 }),
    grains(b, { t, times, f: [1200, 5000], q: 3, d: [0.006, 0.02], v: 0.4, amps, wet: 0.15, r: k.r }),
  );
};

const hitHeavy: SfxFn = (b, t, k) =>
  last(
    boom(b, t, 0.7, { f0: 120 * k.p, f1: 38 * k.p, d: 0.8, drive: 1.5, wet: 0.2 }),
    noise(b, { t, f: 2000 * k.p, q: 0.8, v: 0.4, a: 0.0006, d: 0.07 }),
    noise(b, { t, color: 'brown', lp: 900, v: 0.5, a: 0.002, d: 0.25, drive: 2 }),
  );

const critical: SfxFn = (b, t, k) => {
  let e = last(
    bell(b, { t: t + 0.15, f: kf(k, 21), partials: BAR, v: 0.14, d: 0.9, wet: 0.4 }),
    noise(b, { t, hp: 7000, v: 0.06, a: 0.05, d: 0.5, swell: true, wet: 0.5 }),
    tone(b, { t, type: 'sawtooth', f: 1200 * k.p, f2: 2400 * k.p, glide: 0.1, lp: 4000, v: 0.05, a: 0.003, d: 0.12 }),
  );
  [14, 16, 18, 21, 23].forEach((d, i) => {
    e = last(e, bell(b, { t: t + i * 0.03, f: kf(k, d), partials: BAR, v: 0.12, d: 0.5, wet: 0.4, pan: i % 2 ? 0.4 : -0.4 }));
  });
  return e;
};

const weak: SfxFn = (b, t, k) => {
  let e = tone(b, { t, type: 'triangle', f: 400 * k.p, f2: 1600 * k.p, glide: 0.14, v: 0.1, a: 0.01, d: 0.14 });
  [7, 11, 14].forEach((d, i) => {
    const fin = i === 2;
    e = last(e, brass(b, { t: t + i * 0.07, f: kf(k, d), v: 0.14, a: 0.012, h: fin ? 0.12 : 0.04, d: fin ? 0.5 : 0.12, bright: 8, wet: 0.2 }));
  });
  return last(e, bell(b, { t: t + 0.14, f: kf(k, 21), partials: BAR, v: 0.1, d: 0.5, wet: 0.3 }));
};

const resist: SfxFn = (b, t, k) =>
  last(
    tone(b, { t, f: 220 * k.p, f2: 85 * k.p, glide: 0.18, v: 0.42, a: 0.002, d: 0.25, lp: 600 }),
    noise(b, { t, color: 'brown', lp: 400, v: 0.5, a: 0.002, d: 0.12 }),
    tone(b, { t, type: 'triangle', f: 330 * k.p, f2: 170 * k.p, glide: 0.2, v: 0.12, a: 0.003, d: 0.25, lp: 900 }),
  );

/* ------------------------------------------------------------------ player */

const playerHurt: SfxFn = (b, t, k) =>
  last(
    tone(b, { t, f: 150 * k.p, f2: 60 * k.p, glide: 0.12, v: 0.55, a: 0.0015, d: 0.22, drive: 1.5 }),
    noise(b, { t, color: 'pink', f: 1300 * k.p, q: 0.9, v: 0.5, a: 0.001, d: 0.12, drive: 3 }),
    tone(b, { t, type: 'triangle', f: 210 * k.p, f2: 120 * k.p, glide: 0.15, v: 0.15, a: 0.002, d: 0.15, lp: 800 }),
  );

const shieldGain: SfxFn = (b, t, k) =>
  last(
    bell(b, { t, f: kf(k, 14), partials: BAR, v: 0.15, d: 0.8, wet: 0.35 }),
    bell(b, { t: t + 0.07, f: kf(k, 18), partials: BAR, v: 0.12, d: 0.8, wet: 0.35, pan: 0.2 }),
    tone(b, { t, f: 220 * k.p, f2: 330 * k.p, glide: 0.3, v: 0.15, a: 0.08, d: 0.3, swell: true }),
    noise(b, { t, fpts: [[0, 3000], [0.4, 9000]], q: 1.5, v: 0.12, a: 0.1, d: 0.4, swell: true, wet: 0.4 }),
  );

const shieldBlock: SfxFn = (b, t, k) =>
  last(
    fm(b, { t, f: 520 * k.p, ratio: 1.47, index: 4, index2: 0.3, idxTime: 0.3, v: 0.28, a: 0.0008, d: 0.7, wet: 0.2 }),
    bell(b, { t, f: 690 * k.p, partials: ANVIL, v: 0.16, d: 0.6, spread: 5 }),
    noise(b, { t, f: 3000, q: 1, v: 0.36, a: 0.0005, d: 0.03 }),
    tone(b, { t, f: 130 * k.p, f2: 80 * k.p, glide: 0.08, v: 0.35, a: 0.0015, d: 0.12 }),
  );

const heal: SfxFn = (b, t, k) => {
  let e = last(
    tone(b, { t, type: 'triangle', f: kf(k, 0), v: 0.05, a: 0.25, h: 0.2, d: 0.6, swell: true, wet: 0.3 }),
    tone(b, { t, type: 'triangle', f: kf(k, 4), v: 0.04, a: 0.25, h: 0.2, d: 0.6, swell: true, wet: 0.3 }),
    bell(b, { t: t + 0.45, f: kf(k, 16), partials: BAR, v: 0.06, d: 0.7, wet: 0.5 }),
  );
  [0, 2, 4, 7, 9, 11].forEach((d, i) => {
    e = last(e, pluck(b, { t: t + i * 0.075, f: kf(k, d + 7), v: 0.28, bright: true, wet: 0.35, pan: -0.3 + i * 0.12 }));
  });
  return e;
};

const pierce: SfxFn = (b, t, k) =>
  last(
    fm(b, { t, f: 2800 * k.p, f2: 4200 * k.p, glide: 0.12, ratio: 2.01, index: 2, index2: 0.2, v: 0.14, a: 0.002, d: 0.3, wet: 0.2 }),
    noise(b, { t, hp: 5000, v: 0.24, a: 0.001, d: 0.07, pan: -0.4, pan2: 0.4 }),
    bell(b, { t, f: 2200 * k.p * jit(k, 0.02), partials: BAR, v: 0.1, d: 0.5, wet: 0.3 }),
  );

export const COMBAT_SFX = {
  chip, mult, xmult, total, bigTotal,
  hitFire, hitWater, hitWind, hitEarth, hitHeavy, critical, resist, weak,
  playerHurt, shieldGain, shieldBlock, heal, pierce,
} satisfies Record<string, SfxFn>;
