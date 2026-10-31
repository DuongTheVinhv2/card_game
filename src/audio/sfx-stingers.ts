// Musical stingers: victory fanfare, defeat lament, apotheosis.

import { MODES, degFreq, type Key } from './dsp';
import { BAR, BELL, bell, brass, choir, noise, pluck, tone } from './voices';
import { aulos, boom, frameDrum, gong, tambourine } from './instruments';
import { last, type SfxFn } from './sfxkit';

// Stingers use fixed keys that match the tracks that usually follow them (no clash during crossfades):
// victory / apotheosis -> D ionian (VictoryTrack), defeat -> A phrygian (DefeatTrack).
const D_IONIAN: Key = { root: 62, mode: MODES.ionian };
const A_PHRYGIAN: Key = { root: 57, mode: MODES.phrygian };

const victory: SfxFn = (b, t, k) => {
  const vk = D_IONIAN;
  const F = (d: number): number => degFreq(vk, d) * k.p;
  // [time, degree, duration]
  const mel: [number, number, number][] = [
    [0, 4, 0.1], [0.12, 4, 0.1], [0.24, 4, 0.1], [0.36, 7, 0.46], [0.9, 5, 0.12], [1.04, 6, 0.12], [1.18, 7, 1.3],
  ];
  let e = t;
  mel.forEach(([dt, d, dur], i) => {
    const fin = i === mel.length - 1;
    e = last(
      e,
      brass(b, { t: t + dt, f: F(d), v: fin ? 0.15 : 0.13, a: 0.018, h: Math.max(0.02, dur - 0.06), d: fin ? 0.9 : 0.12, bright: 7, vib: fin ? 12 : 0, wet: 0.3 }),
      pluck(b, { t: t + dt, f: F(d + 7), v: 0.28, bright: true, wet: 0.25 }),
    );
  });
  e = last(e, brass(b, { t: t + 0.36, f: F(4), v: 0.08, a: 0.02, h: 0.4, d: 0.12, bright: 5, wet: 0.3, pan: -0.3 }));
  [0, 2, 4].forEach((d, i) => {
    e = last(e, brass(b, { t: t + 1.18, f: F(d), v: 0.09, a: 0.03, h: 1.2, d: 0.9, bright: 5, wet: 0.35, pan: (i - 1) * 0.4 }));
  });
  [7, 9, 11, 14, 16].forEach((d, i) => {
    e = last(e, pluck(b, { t: t + 1.18 + i * 0.018, f: F(d), v: 0.24, bright: true, wet: 0.3, pan: -0.4 + i * 0.2 }));
  });
  for (const [dt, v] of [[0, 0.22], [0.12, 0.16], [0.24, 0.18], [0.36, 0.34], [0.9, 0.24], [1.04, 0.26]]) {
    e = last(e, frameDrum(b, t + dt, v, { f: 98, wet: 0.15 }));
  }
  for (let i = 0; i < 6; i++) e = last(e, tambourine(b, t + 0.9 + i * 0.045, 0.06 + i * 0.012));
  return last(
    e,
    boom(b, t + 1.18, 0.45, { f0: 100, f1: 40, d: 1.0, wet: 0.25 }),
    tambourine(b, t + 1.18, 0.2, { open: true, wet: 0.3 }),
    noise(b, { t: t + 1.18, hp: 6000, v: 0.07, a: 0.002, d: 1.6, wet: 0.4 }),
    bell(b, { t: t + 1.2, f: F(21), partials: BAR, v: 0.07, d: 1.2, wet: 0.5 }),
  );
};

const defeat: SfxFn = (b, t, k) => {
  const dk = A_PHRYGIAN;
  const F = (d: number): number => degFreq(dk, d) * k.p;
  const notes = ([[0, 4, 0.42], [0.5, 3, 0.42], [1.0, 2, 0.42], [1.5, 1, 0.42], [2.0, 0, 1.2]] as const).map(
    ([dt, d, dur]) => ({ t: t + dt, f: F(d), d: dur, v: 0.15 }),
  );
  return last(
    aulos(b, notes, { wet: 0.4, vib: 14, drone: F(-7), bright: 0.8 }),
    tone(b, { t, type: 'sawtooth', f: F(-14), v: 0.07, a: 0.5, h: 2.0, d: 1.0, swell: true, lp: 380, wet: 0.2 }),
    tone(b, { t, type: 'sawtooth', f: F(-10), v: 0.045, a: 0.5, h: 2.0, d: 1.0, swell: true, lp: 380, wet: 0.2 }),
    frameDrum(b, t, 0.36, { f: 70, dark: true, wet: 0.3 }),
    frameDrum(b, t + 2.0, 0.42, { f: 62, dark: true, wet: 0.3 }),
    pluck(b, { t: t + 2.0, f: F(-7), v: 0.3, wet: 0.3 }),
    pluck(b, { t: t + 2.02, f: F(-3), v: 0.24, wet: 0.3 }),
    gong(b, t + 2.0, F(-14), 0.1, 2.2, { wet: 0.4 }),
  );
};

const apotheosis: SfxFn = (b, t, k) => {
  const ak = D_IONIAN;
  const F = (d: number): number => degFreq(ak, d) * k.p;
  let e = last(
    boom(b, t, 0.5, { f0: 90, f1: 32, d: 1.5, drive: 1.3, wet: 0.3 }),
    gong(b, t, F(-14), 0.18, 3.5, { wet: 0.4 }),
    boom(b, t + 3.2, 0.35, { f0: 80, f1: 35, d: 1.2, wet: 0.3 }),
    noise(b, { t: t + 3.0, hp: 5000, v: 0.06, a: 0.3, d: 1.8, swell: true, wet: 0.5 }),
  );
  // choir: I -> IV -> I(add6)
  const chords: [number, number, number, number[]][] = [
    [0, 0.9, 1.2, [0, 4, 7]], [2.0, 0.6, 0.7, [3, 5, 8]], [3.2, 0.6, 1.4, [0, 4, 7, 9]],
  ];
  for (const [dt, a, h, degs] of chords) {
    degs.forEach((d, i) => {
      e = last(e, choir(b, { t: t + dt, f: F(d), vowel: 'a', v: 0.075, a, h, d: 1.4, wet: 0.6, pan: (i - 1) * 0.35 }));
    });
  }
  for (const [dt, d] of [[0.3, 7], [0.9, 9], [1.5, 11], [2.1, 12], [3.2, 14]]) {
    e = last(e, bell(b, { t: t + dt, f: F(d), partials: BELL, v: 0.1, d: 2.4, wet: 0.5, spread: 3 }));
  }
  for (let i = 0; i < 12; i++) {
    e = last(e, pluck(b, { t: t + 0.08 + i * 0.045, f: F(i + 7), v: 0.2, bright: true, wet: 0.4, pan: -0.5 + i * 0.09 }));
  }
  for (let i = 0; i < 10; i++) {
    e = last(e, pluck(b, { t: t + 3.2 + i * 0.04, f: F(i + 9), v: 0.17, bright: true, wet: 0.4, pan: 0.5 - i * 0.1 }));
  }
  for (let i = 0; i < 12; i++) {
    const ti = t + 0.5 + i * 0.35 + k.r() * 0.1;
    e = last(e, bell(b, { t: ti, f: F(16 + Math.floor(k.r() * 8)), partials: BAR, v: 0.045, d: 0.9, wet: 0.6, pan: (k.r() * 2 - 1) * 0.8 }));
  }
  return last(e, tone(b, { t, f: F(-14) / 2, v: 0.2, a: 1.0, h: 2.5, d: 1.5, swell: true }));
};

export const STINGER_SFX = { victory, defeat, apotheosis } satisfies Record<string, SfxFn>;
