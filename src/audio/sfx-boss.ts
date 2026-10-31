// Boss SFX: roars, attacks, charge-ups, guard, death and intro.

import { driveCurve, envSwell, mtof, rampPoints, semis } from './dsp';
import { BAR, bell, choir, fm, noise, route, tone, vrand, type Bus } from './voices';
import { boom, gong } from './instruments';
import { kf, last, type SfxFn } from './sfxkit';

interface RoarOpts {
  wet?: number;
  pan?: number;
  /** descending (dying) contour instead of rise-hold-fall */
  fall?: boolean;
}

/** Beastly voice: detuned saws with a pitch contour -> saturation -> sweeping formants, growl AM. */
function roarVoice(b: Bus, t: number, dur: number, f: number, v: number, o: RoarOpts = {}): number {
  const ctx = b.ctx;
  const out = ctx.createGain();
  out.gain.value = 0;
  const end = envSwell(out.gain, t, v, Math.min(0.12, dur * 0.3), Math.max(0, dur - 0.55), Math.min(0.42, dur * 0.5));
  route(b, out, { t, wet: o.wet, pan: o.pan }, end);

  const am = ctx.createGain();
  am.gain.value = 0.7;
  const amLfo = ctx.createOscillator();
  amLfo.type = 'triangle';
  amLfo.frequency.value = 29 + vrand() * 6;
  const amDepth = ctx.createGain();
  amDepth.gain.value = 0.3;
  amLfo.connect(amDepth).connect(am.gain);
  am.connect(out);

  const pre = ctx.createGain();
  pre.gain.value = 0.55;
  const ws = ctx.createWaveShaper();
  ws.curve = driveCurve(3);
  ws.oversample = '2x';
  pre.connect(ws);

  const D = Math.max(end - t, 0.1);
  const bands: [BiquadFilterType, number, number, readonly (readonly [number, number])[]][] = o.fall
    ? [
        ['bandpass', 5, 1.1, [[0, 900], [D, 300]]],
        ['bandpass', 6, 0.7, [[0, 1800], [D, 700]]],
        ['lowpass', 0, 0.7, [[0, 700], [D, 300]]],
      ]
    : [
        ['bandpass', 5, 1.1, [[0, 380], [D * 0.35, 900], [D, 420]]],
        ['bandpass', 6, 0.7, [[0, 1100], [D * 0.35, 1900], [D, 900]]],
        ['lowpass', 0, 0.7, [[0, 650], [D, 500]]],
      ];
  for (const [type, q, g, pts] of bands) {
    const bf = ctx.createBiquadFilter();
    bf.type = type;
    bf.Q.value = q;
    rampPoints(bf.frequency, t, pts);
    const bg = ctx.createGain();
    bg.gain.value = g;
    ws.connect(bf).connect(bg).connect(am);
  }

  const contour: [number, number][] = o.fall
    ? [[0, 1.0], [D * 0.3, 0.85], [D, 0.45]]
    : [[0, 0.78], [D * 0.35, 1.12], [D * 0.75, 1.0], [D, 0.62]];
  const j1 = ctx.createOscillator();
  j1.frequency.value = 7.3;
  const j1g = ctx.createGain();
  j1g.gain.value = 28;
  j1.connect(j1g);
  const j2 = ctx.createOscillator();
  j2.frequency.value = 23;
  const j2g = ctx.createGain();
  j2g.gain.value = 10;
  j2.connect(j2g);
  const srcs: OscillatorNode[] = [amLfo, j1, j2];
  for (const dc of [-15, 0, 17]) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    rampPoints(osc.frequency, t, contour.map(([dt, m]) => [dt, f * m] as const));
    osc.detune.value = dc;
    j1g.connect(osc.detune);
    j2g.connect(osc.detune);
    osc.connect(pre);
    srcs.push(osc);
  }
  for (const s of srcs) {
    s.start(t);
    s.stop(end + 0.02);
  }
  return end;
}

const bossRoar: SfxFn = (b, t, k) =>
  last(
    roarVoice(b, t, 1.7, 72 * k.p, 0.5, { wet: 0.3 }),
    roarVoice(b, t + 0.02, 1.65, 108 * k.p, 0.3, { wet: 0.3, pan: 0.2 }),
    noise(b, { t, color: 'pink', fpts: [[0, 500], [0.5, 1500], [1.7, 600]], q: 1.2, v: 0.35, a: 0.1, h: 0.9, d: 0.6, swell: true, drive: 1.5 }),
    tone(b, { t, f: 45 * k.p, f2: 38 * k.p, glide: 1.5, v: 0.35, a: 0.1, h: 0.9, d: 0.6, swell: true }),
  );

const bossAttack: SfxFn = (b, t, k) => {
  const ti = t + 0.2;
  return last(
    noise(b, { t, color: 'pink', fpts: [[0, 300], [0.2, 1800]], q: 1, v: 0.38, a: 0.17, d: 0.05, swell: true }),
    roarVoice(b, t, 0.35, 95 * k.p, 0.25),
    boom(b, ti, 0.6, { f0: 130 * k.p, f1: 40 * k.p, d: 0.6, drive: 1.8, wet: 0.2 }),
    noise(b, { t: ti, color: 'brown', lp: 1500, v: 0.7, a: 0.001, d: 0.2, drive: 3 }),
    noise(b, { t: ti, fpts: [[0, 6000], [0.12, 2500]], q: 2, v: 0.3, a: 0.001, d: 0.12, pan: 0.5, pan2: -0.5 }),
  );
};

const bossCharge: SfxFn = (b, t, k) => {
  const ctx = b.ctx;
  const trem = ctx.createGain();
  trem.gain.value = 0.6;
  const lfo = ctx.createOscillator();
  lfo.frequency.setValueAtTime(4, t);
  lfo.frequency.exponentialRampToValueAtTime(15, t + 1.5);
  const ld = ctx.createGain();
  ld.gain.value = 0.4;
  lfo.connect(ld).connect(trem.gain);
  trem.connect(b.out);
  const base = mtof(k.key.root - 24) * k.p;
  let e = t;
  for (const s of [0, 1, 6]) {
    e = last(e, tone(b, { t, type: 'sawtooth', f: base * semis(s), f2: base * semis(s + 7), glide: 1.5, v: 0.11, a: 1.3, h: 0.08, d: 0.18, swell: true, lp: 200, lp2: 3500, lpQ: 4, dest: trem, wet: 0.2 }));
  }
  e = last(
    e,
    noise(b, { t, color: 'pink', fpts: [[0, 300], [1.5, 5000]], q: 1.4, v: 0.3, a: 1.4, h: 0.05, d: 0.15, swell: true, wet: 0.3 }),
    tone(b, { t, f: 55 * k.p, f2: 82 * k.p, glide: 1.5, v: 0.3, a: 1.3, h: 0.05, d: 0.2, swell: true, dest: trem }),
  );
  lfo.start(t);
  lfo.stop(e + 0.02);
  return e;
};

const bossGuard: SfxFn = (b, t, k) =>
  last(
    tone(b, { t, f: 150 * k.p, f2: 105 * k.p, glide: 0.1, v: 0.3, a: 0.004, d: 0.2 }),
    fm(b, { t, f: 620 * k.p, ratio: 1.414, index: 2.5, index2: 0.4, idxTime: 0.8, v: 0.18, a: 0.003, d: 0.9, wet: 0.35 }),
    bell(b, { t, f: 1240 * k.p, partials: BAR, v: 0.08, d: 0.8, wet: 0.35 }),
    bell(b, { t: t + 0.06, f: 1660 * k.p, partials: BAR, v: 0.07, d: 0.8, wet: 0.35, pan: 0.3 }),
    noise(b, { t, fpts: [[0, 3000], [0.6, 8000]], q: 2, v: 0.16, a: 0.25, d: 0.5, swell: true, wet: 0.5 }),
  );

const bossDeath: SfxFn = (b, t, k) => {
  let e = last(
    boom(b, t, 0.7, { f0: 85 * k.p, f1: 24 * k.p, d: 2.0, drive: 1.6, wet: 0.25 }),
    roarVoice(b, t, 1.5, 120 * k.p, 0.3, { wet: 0.35, fall: true }),
    noise(b, { t, color: 'brown', ft: 'lowpass', fpts: [[0, 500], [2, 120]], q: -3, v: 0.6, a: 0.01, h: 0.4, d: 1.6 }),
    noise(b, { t, f: 1800, q: 0.7, v: 0.35, a: 0.0006, d: 0.1 }),
    noise(b, { t: t + 0.5, hp: 6000, v: 0.05, a: 0.8, h: 0.5, d: 1.5, swell: true, wet: 0.6 }),
    choir(b, { t: t + 0.6, f: mtof(k.key.root) * k.p, vowel: 'a', v: 0.06, a: 0.8, h: 0.6, d: 1.4, wet: 0.6 }),
  );
  const N = 22;
  for (let i = 0; i < N; i++) {
    const ti = t + 0.5 + 2.3 * Math.pow(i / N, 0.8) + k.r() * 0.08;
    const f = kf(k, 14 + Math.floor(k.r() * 11));
    e = last(e, bell(b, { t: ti, f, partials: BAR, v: 0.06 * (1 - (i / N) * 0.5), d: 0.4 + k.r() * 0.8, wet: 0.6, pan: (k.r() * 2 - 1) * 0.8 }));
  }
  return e;
};

const bossIntro: SfxFn = (b, t, k) => {
  let e = last(
    boom(b, t, 0.65, { f0: 95 * k.p, f1: 32 * k.p, d: 1.2, drive: 1.5, wet: 0.25 }),
    noise(b, { t, f: 1600, q: 0.7, v: 0.3, a: 0.0006, d: 0.08 }),
    gong(b, t + 0.01, mtof(k.key.root - 24) * k.p, 0.32, 2.6, { wet: 0.35 }),
    tone(b, { t, f: 41 * k.p, v: 0.25, a: 1.2, h: 0.4, d: 0.6, swell: true }),
  );
  for (const s of [-24, -17, -12]) {
    const f = mtof(k.key.root + s) * k.p;
    e = last(e, tone(b, { t, type: 'sawtooth', f: f * semis(-5), f2: f, glide: 2.0, v: 0.07, a: 1.6, h: 0.3, d: 0.6, swell: true, lp: 300, lp2: 2500, wet: 0.3 }));
  }
  return e;
};

export const BOSS_SFX = {
  bossRoar, bossAttack, bossCharge, bossGuard, bossDeath, bossIntro,
} satisfies Record<string, SfxFn>;
