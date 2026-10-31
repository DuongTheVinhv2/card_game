// Card handling, UI, economy and map SFX.

import { BAR, COIN, ANVIL, bell, grains, noise, pluck, tone } from './voices';
import { frameDrum } from './instruments';
import { jit, kf, last, type SfxFn } from './sfxkit';

const hover: SfxFn = (b, t, k) => {
  const j = jit(k, 0.07) * k.p;
  return last(
    tone(b, { t, f: 2300 * j, f2: 2150 * j, glide: 0.03, v: 0.1, a: 0.0012, d: 0.035 }),
    noise(b, { t, f: 5200 * j, q: 2.5, v: 0.07, a: 0.0008, d: 0.012 }),
  );
};

const select: SfxFn = (b, t, k) => {
  const p = k.p * jit(k, 0.03);
  return last(
    noise(b, { t, f: 2900 * p, q: 1.5, v: 0.36, a: 0.0006, d: 0.035, hp: 900 }),
    tone(b, { t, type: 'triangle', f: 620 * p, f2: 990 * p, glide: 0.05, v: 0.16, a: 0.002, d: 0.08 }),
    tone(b, { t, f: 200 * p, f2: 140 * p, glide: 0.04, v: 0.2, a: 0.0015, d: 0.05 }),
    tone(b, { t: t + 0.012, f: 1980 * p, v: 0.05, a: 0.001, d: 0.05 }),
  );
};

const deselect: SfxFn = (b, t, k) => {
  const p = k.p * jit(k, 0.03);
  return last(
    noise(b, { t, f: 1900 * p, q: 1.4, v: 0.26, a: 0.0008, d: 0.04 }),
    tone(b, { t, type: 'triangle', f: 700 * p, f2: 430 * p, glide: 0.06, v: 0.12, a: 0.002, d: 0.08 }),
    tone(b, { t, f: 160 * p, f2: 120 * p, glide: 0.04, v: 0.13, a: 0.0015, d: 0.05 }),
  );
};

const deal: SfxFn = (b, t, k) => {
  const j = jit(k, 0.08) * k.p;
  const pan = (k.r() * 2 - 1) * 0.3;
  return last(
    noise(b, { t, color: 'pink', fpts: [[0, 1100 * j], [0.07, 4300 * j]], q: 1.1, v: 0.34, a: 0.012, d: 0.09, pan, pan2: pan * -0.5 }),
    noise(b, { t: t + 0.06, f: 6000 * j, q: 1.5, v: 0.16, a: 0.0008, d: 0.018, pan }),
  );
};

const cardFlip: SfxFn = (b, t, k) => {
  const p = k.p * jit(k, 0.04);
  return last(
    noise(b, { t, color: 'pink', fpts: [[0, 2500 * p], [0.05, 5200 * p]], q: 1.2, v: 0.2, a: 0.01, d: 0.05 }),
    noise(b, { t: t + 0.045, f: 3200 * p, q: 1.8, v: 0.34, a: 0.0006, d: 0.025 }),
    tone(b, { t: t + 0.045, type: 'triangle', f: 1300 * p, f2: 900 * p, glide: 0.03, v: 0.08, a: 0.001, d: 0.04 }),
  );
};

const shuffle: SfxFn = (b, t, k) => {
  const times: number[] = [];
  let x = 0;
  const N = 26;
  for (let i = 0; i < N; i++) {
    times.push(x);
    x += 0.017 + (0.012 * Math.abs(i - N / 2)) / (N / 2) + k.r() * 0.004;
  }
  const amps = times.map((_, i) => 0.55 + 0.45 * Math.sin((Math.PI * (i + 0.5)) / N));
  return last(
    grains(b, { t, times, f: [2600 * k.p, 5400 * k.p], q: 1.8, d: [0.012, 0.022], v: 0.34, amps, spread: 0.5, r: k.r }),
    noise(b, { t, color: 'pink', fpts: [[0, 800], [x, 1800]], q: 0.9, v: 0.07, a: x * 0.4, h: x * 0.3, d: x * 0.4, swell: true }),
    tone(b, { t: t + x + 0.01, f: 150 * k.p, f2: 110 * k.p, glide: 0.04, v: 0.2, a: 0.0015, d: 0.06 }),
    noise(b, { t: t + x, f: 1800 * k.p, q: 1, v: 0.2, a: 0.001, d: 0.05 }),
  );
};

const discard: SfxFn = (b, t, k) => {
  const p = k.p * jit(k, 0.05);
  return last(
    noise(b, { t, color: 'pink', fpts: [[0, 500 * p], [0.12, 2600 * p], [0.3, 900 * p]], q: 1.3, v: 0.42, a: 0.07, h: 0.03, d: 0.2, swell: true, pan: -0.2, pan2: 0.6 }),
    noise(b, { t, f: 4200 * p, q: 2, v: 0.12, a: 0.0008, d: 0.02 }),
  );
};

const playHand: SfxFn = (b, t, k) => {
  const p = k.p;
  const ti = t + 0.15;
  return last(
    noise(b, { t, color: 'pink', fpts: [[0, 350 * p], [0.15, 2800 * p]], q: 1.2, v: 0.32, a: 0.13, d: 0.06, swell: true }),
    tone(b, { t: ti, f: 140 * p, f2: 48 * p, glide: 0.12, v: 0.62, a: 0.0015, d: 0.28, wet: 0.1 }),
    noise(b, { t: ti, f: 1500 * p, q: 0.9, v: 0.45, a: 0.0006, d: 0.07 }),
    tone(b, { t: ti, type: 'triangle', f: 230 * p, f2: 170 * p, glide: 0.08, v: 0.16, a: 0.001, d: 0.12 }),
    noise(b, { t: ti, hp: 4000, v: 0.12, a: 0.0006, d: 0.03, wet: 0.25 }),
  );
};

const button: SfxFn = (b, t, k) => {
  const p = k.p;
  return last(
    noise(b, { t, f: 4200 * p, q: 1.2, v: 0.24, a: 0.0005, d: 0.006 }),
    tone(b, { t, f: 1150 * p, f2: 750 * p, glide: 0.018, v: 0.22, a: 0.0008, d: 0.03 }),
    tone(b, { t: t + 0.004, f: 380 * p, v: 0.12, a: 0.001, d: 0.04 }),
  );
};

const buttonSoft: SfxFn = (b, t, k) => {
  const p = k.p;
  return last(
    noise(b, { t, f: 2600 * p, q: 1, v: 0.09, a: 0.0006, d: 0.006 }),
    tone(b, { t, f: 820 * p, f2: 600 * p, glide: 0.02, v: 0.13, a: 0.001, d: 0.03 }),
  );
};

const error: SfxFn = (b, t, k) => {
  let e = t;
  for (let i = 0; i < 2; i++) {
    const ti = t + i * 0.13;
    const f = (i ? 104 : 110) * k.p;
    e = last(
      e,
      tone(b, { t: ti, type: 'square', f, v: 0.16, a: 0.006, h: 0.06, d: 0.05, lp: 900 }),
      tone(b, { t: ti, type: 'sawtooth', f: f * 1.055, v: 0.12, a: 0.006, h: 0.06, d: 0.05, lp: 700 }),
    );
  }
  return e;
};

function clink(b: Parameters<SfxFn>[0], t: number, f: number, v: number, d: number, pan = 0): number {
  return last(
    bell(b, { t, f, partials: COIN, v, a: 0.0008, d, spread: 8, pan }),
    noise(b, { t, f: 7000, q: 2, v: v * 0.4, a: 0.0005, d: 0.008, pan }),
  );
}

const coin: SfxFn = (b, t, k) => {
  const f = 2350 * k.p * jit(k, 0.03);
  return last(clink(b, t, f, 0.22, 0.32), clink(b, t + 0.045, f * 1.06, 0.13, 0.26, 0.15));
};

const buy: SfxFn = (b, t, k) => {
  const f = 2200 * k.p;
  return last(
    clink(b, t, f, 0.2, 0.3, -0.2),
    clink(b, t + 0.05, f * 1.12, 0.16, 0.28, 0.1),
    clink(b, t + 0.1, f * 1.26, 0.13, 0.26, 0.25),
    bell(b, { t: t + 0.09, f: kf(k, 14), partials: BAR, v: 0.16, d: 0.7, wet: 0.25 }),
    bell(b, { t: t + 0.15, f: kf(k, 16), partials: BAR, v: 0.14, d: 0.8, wet: 0.25 }),
  );
};

const sell: SfxFn = (b, t, k) => {
  const fs = [2900, 2600, 2300, 2050];
  let e = t;
  fs.forEach((f, i) => (e = last(e, clink(b, t + i * 0.05, f * k.p, 0.16 - i * 0.02, 0.25, 0.3 - i * 0.2))));
  return last(
    e,
    noise(b, { t, color: 'pink', fpts: [[0, 3000], [0.2, 900]], q: 1, v: 0.14, a: 0.03, d: 0.15 }),
    bell(b, { t: t + 0.12, f: kf(k, 9), partials: BAR, v: 0.1, d: 0.5, wet: 0.2 }),
  );
};

const reroll: SfxFn = (b, t, k) => {
  const times: number[] = [];
  let x = 0;
  for (let i = 0; i < 14; i++) {
    times.push(x);
    x += 0.022 + 0.04 * Math.pow(i / 13, 2.2);
  }
  return last(
    grains(b, { t, times, f: [1800 * k.p, 3200 * k.p], q: 3, d: [0.008, 0.014], v: 0.34, spread: 0.4, r: k.r }),
    tone(b, { t, type: 'triangle', f: 280 * k.p, f2: 840 * k.p, glide: 0.35, v: 0.06, a: 0.05, d: 0.25, vib: 30, vibRate: 22 }),
    bell(b, { t: t + x, f: kf(k, 11), partials: BAR, v: 0.15, d: 0.45, wet: 0.2 }),
  );
};

const levelUp: SfxFn = (b, t, k) => {
  const degs = [0, 2, 4, 7, 9, 11, 14];
  let e = t;
  degs.forEach((d, i) => {
    e = last(e, pluck(b, { t: t + i * 0.055, f: kf(k, d + 7), v: 0.42 - i * 0.02, bright: true, wet: 0.3, pan: -0.4 + i * 0.13 }));
  });
  const tl = t + degs.length * 0.055;
  return last(
    e,
    bell(b, { t: tl, f: kf(k, 21), partials: BAR, v: 0.08, d: 0.9, wet: 0.4 }),
    noise(b, { t: t + 0.1, hp: 6000, v: 0.035, a: 0.2, d: 0.6, swell: true, wet: 0.5 }),
    tone(b, { t, type: 'triangle', f: kf(k, 0), v: 0.05, a: 0.15, h: 0.2, d: 0.6, swell: true, wet: 0.3 }),
    tone(b, { t, type: 'triangle', f: kf(k, 4), v: 0.04, a: 0.15, h: 0.2, d: 0.6, swell: true, wet: 0.3 }),
  );
};

const boonTrigger: SfxFn = (b, t, k) =>
  last(
    tone(b, { t, f: 700 * k.p, f2: 2400 * k.p, glide: 0.07, v: 0.1, a: 0.004, d: 0.08 }),
    bell(b, { t: t + 0.05, f: kf(k, 16), partials: BAR, v: 0.2, d: 0.6, wet: 0.35 }),
    bell(b, { t: t + 0.09, f: kf(k, 20), partials: BAR, v: 0.07, d: 0.4, wet: 0.35, pan: 0.3 }),
  );

const whoosh: SfxFn = (b, t, k) => {
  const p = k.p;
  return last(
    noise(b, { t, color: 'pink', fpts: [[0, 300 * p], [0.16, 2400 * p], [0.36, 700 * p]], q: 1.4, v: 0.46, a: 0.14, d: 0.24, swell: true, pan: -0.5, pan2: 0.5 }),
    noise(b, { t, hp: 5000, v: 0.05, a: 0.12, d: 0.2, swell: true }),
  );
};

const scrollUse: SfxFn = (b, t, k) => {
  const times = Array.from({ length: 20 }, (_, i) => i * 0.017 + k.r() * 0.01);
  let e = last(
    grains(b, { t, times, color: 'pink', f: [2000, 6000], q: 2, d: [0.01, 0.025], v: 0.2, r: k.r }),
    noise(b, { t, color: 'pink', fpts: [[0, 700], [0.3, 2200]], q: 0.9, v: 0.14, a: 0.08, d: 0.25, swell: true }),
    noise(b, { t: t + 0.3, hp: 7000, v: 0.03, a: 0.2, d: 0.6, swell: true, wet: 0.5 }),
  );
  [7, 9, 11, 14].forEach((d, i) => {
    e = last(e, bell(b, { t: t + 0.3 + i * 0.07, f: kf(k, d + 7), partials: BAR, v: 0.12, d: 0.8, wet: 0.45, pan: i % 2 ? 0.3 : -0.3 }));
  });
  return e;
};

const enhance: SfxFn = (b, t, k) => {
  let e = last(
    bell(b, { t, f: 860 * k.p, partials: ANVIL, v: 0.36, a: 0.0008, d: 1.0, wet: 0.2 }),
    noise(b, { t, f: 3500, q: 0.8, v: 0.36, a: 0.0005, d: 0.03 }),
    tone(b, { t, f: 180, f2: 110, glide: 0.05, v: 0.3, a: 0.001, d: 0.1 }),
  );
  for (let i = 0; i < 4; i++) {
    const d = 14 + Math.floor(k.r() * 7);
    e = last(e, bell(b, { t: t + 0.12 + i * 0.08, f: kf(k, d), partials: BAR, v: 0.08, d: 0.5, wet: 0.4, pan: (k.r() * 2 - 1) * 0.6 }));
  }
  return e;
};

const shatter: SfxFn = (b, t, k) => {
  const p = k.p;
  const times = Array.from({ length: 30 }, (_, i) => 0.01 + Math.pow(i / 30, 1.6) * 0.6 + k.r() * 0.02).sort((x, y) => x - y);
  const amps = times.map((_, i) => 1 - (i / 30) * 0.7);
  let e = last(
    noise(b, { t, hp: 2500, v: 0.45, a: 0.0005, d: 0.035 }),
    noise(b, { t, f: 900 * p, q: 1.2, v: 0.24, a: 0.0006, d: 0.05 }),
    noise(b, { t, hp: 6000, v: 0.09, a: 0.002, d: 0.3, wet: 0.3 }),
    grains(b, { t, times, f: [3500 * p, 9500 * p], q: 18, d: [0.03, 0.1], v: 0.9, amps, channels: 4, wet: 0.25, r: k.r }),
  );
  for (let i = 0; i < 8; i++) {
    const ti = t + 0.01 + Math.pow(i / 8, 1.5) * 0.45 + k.r() * 0.02;
    e = last(e, bell(b, { t: ti, f: (2800 + k.r() * 5200) * p, partials: [[1, 1, 1], [2.32, 0.4, 0.6]], v: 0.09 * (1 - i / 12), d: 0.08 + k.r() * 0.2, pan: (k.r() * 2 - 1) * 0.8 }));
  }
  return e;
};

const mapStep: SfxFn = (b, t, k) =>
  last(
    frameDrum(b, t, 0.34, { f: 88 * k.p * jit(k, 0.05), dark: true, wet: 0.08 }),
    noise(b, { t, color: 'pink', lp: 1400, v: 0.07, a: 0.004, d: 0.06 }),
  );

const nodeSelect: SfxFn = (b, t, k) =>
  last(
    frameDrum(b, t, 0.28, { f: 105 * k.p, wet: 0.1 }),
    pluck(b, { t: t + 0.02, f: kf(k, 7), v: 0.34, bright: true, wet: 0.25 }),
    pluck(b, { t: t + 0.1, f: kf(k, 11), v: 0.3, bright: true, wet: 0.25, pan: 0.2 }),
    bell(b, { t: t + 0.1, f: kf(k, 18), partials: BAR, v: 0.05, d: 0.5, wet: 0.4 }),
  );

export const UI_SFX = {
  hover, select, deselect, deal, cardFlip, shuffle, discard, playHand,
  button, buttonSoft, error, coin, buy, sell, reroll, levelUp, boonTrigger,
  whoosh, scrollUse, enhance, shatter, mapStep, nodeSelect,
} satisfies Record<string, SfxFn>;
