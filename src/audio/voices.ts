// Synthesis primitives shared by SFX and music. Every primitive takes a Bus (any BaseAudioContext +
// destination nodes), schedules sample-accurately at absolute context times, ends its envelopes at
// exactly zero (click-free) and returns the time at which it is silent.

import {
  clamp, driveCurve, envAHD, envSwell, ftom, mtof, noiseBuffer, rampPoints,
  type NoiseColor, type Rng,
} from './dsp';
import { pluckBuffer } from './pluck';

let vr: () => number = Math.random;
/** Random source for per-voice variation (noise offsets, detune spread). Seed it for reproducible tests. */
export function setVoiceRandom(r: (() => number) | null): void {
  vr = r ?? Math.random;
}
export const vrand = (): number => vr();

export interface Bus {
  ctx: BaseAudioContext;
  /** dry destination */
  out: AudioNode;
  /** reverb send destination (null = no reverb) */
  verb: AudioNode | null;
}

export interface Place {
  t: number;
  /** reverb send amount */
  wet?: number;
  pan?: number;
  /** pan at the end of the sound (linear sweep) */
  pan2?: number;
  /** override dry destination */
  dest?: AudioNode;
}

export interface Shape extends Place {
  /** peak gain */
  v: number;
  a?: number;
  h?: number;
  /** decay to -60 dB (or release for swells) */
  d: number;
  /** exponential (swelling) attack instead of linear */
  swell?: boolean;
}

/** Connect a node to the bus with optional panning and reverb send. */
export function route(bus: Bus, node: AudioNode, p: Place, end: number): void {
  const ctx = bus.ctx;
  let n: AudioNode = node;
  if (p.pan || p.pan2 !== undefined) {
    const sp = ctx.createStereoPanner();
    sp.pan.setValueAtTime(clamp(p.pan ?? 0, -1, 1), p.t);
    if (p.pan2 !== undefined) sp.pan.linearRampToValueAtTime(clamp(p.pan2, -1, 1), Math.max(p.t + 0.01, end));
    node.connect(sp);
    n = sp;
  }
  n.connect(p.dest ?? bus.out);
  if (p.wet && p.wet > 0 && bus.verb) {
    const w = ctx.createGain();
    w.gain.value = p.wet;
    n.connect(w);
    w.connect(bus.verb);
  }
}

function vca(bus: Bus, s: Shape): { g: GainNode; end: number } {
  const g = bus.ctx.createGain();
  g.gain.value = 0;
  const end = s.swell
    ? envSwell(g.gain, s.t, s.v, s.a ?? 0.05, s.h ?? 0, s.d)
    : envAHD(g.gain, s.t, s.v, s.a ?? 0.002, s.h ?? 0, s.d);
  route(bus, g, s, end);
  return { g, end };
}

function shaper(ctx: BaseAudioContext, drive: number): WaveShaperNode {
  const ws = ctx.createWaveShaper();
  ws.curve = driveCurve(drive);
  // No oversampling on purpose: oversampled shapers add ~2.7 ms of latency in Chrome, which makes the
  // driven signal start *after* a fast attack envelope has opened (= click). Drives here are mild.
  ws.oversample = 'none';
  return ws;
}

function filter(ctx: BaseAudioContext, type: BiquadFilterType, f: number, q: number): BiquadFilterNode {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  return b;
}

/* ------------------------------------------------------------------ tone */

export interface ToneOpts extends Shape {
  f: number;
  /** end frequency (exponential glide) */
  f2?: number;
  glide?: number;
  type?: OscillatorType;
  detune?: number;
  /** lowpass cutoff (and optional end cutoff) */
  lp?: number;
  lp2?: number;
  lpQ?: number;
  /** vibrato depth (cents) and rate */
  vib?: number;
  vibRate?: number;
  /** waveshaper drive (saturation) */
  drive?: number;
}

export function tone(bus: Bus, o: ToneOpts): number {
  const ctx = bus.ctx;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.f, o.t);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, o.t + (o.glide ?? (o.a ?? 0) + (o.h ?? 0) + o.d));
  if (o.detune) osc.detune.value = o.detune;
  const { g, end } = vca(bus, o);
  let n: AudioNode = osc;
  if (o.drive) {
    const ws = shaper(ctx, o.drive);
    n.connect(ws);
    n = ws;
  }
  if (o.lp) {
    const f = filter(ctx, 'lowpass', o.lp, o.lpQ ?? -3);
    if (o.lp2) {
      f.frequency.setValueAtTime(o.lp, o.t);
      f.frequency.exponentialRampToValueAtTime(o.lp2, end);
    }
    n.connect(f);
    n = f;
  }
  n.connect(g);
  if (o.vib) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = o.vibRate ?? 5.5;
    const lg = ctx.createGain();
    lg.gain.value = o.vib;
    lfo.connect(lg).connect(osc.detune);
    lfo.start(o.t);
    lfo.stop(end + 0.02);
  }
  osc.start(o.t);
  osc.stop(end + 0.02);
  return end;
}

/* ----------------------------------------------------------------- noise */

export interface NoiseOpts extends Shape {
  color?: NoiseColor;
  /** main filter type (default bandpass) */
  ft?: BiquadFilterType;
  f?: number;
  q?: number;
  /** filter frequency breakpoints [dt, hz] (exponential) */
  fpts?: readonly (readonly [number, number])[];
  hp?: number;
  lp?: number;
  rate?: number;
  drive?: number;
}

export function noise(bus: Bus, o: NoiseOpts): number {
  const ctx = bus.ctx;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx.sampleRate, o.color ?? 'white');
  src.loop = true;
  if (o.rate) src.playbackRate.value = o.rate;
  let n: AudioNode = src;
  if (o.f || o.fpts) {
    const f = filter(ctx, o.ft ?? 'bandpass', o.f ?? 1000, o.q ?? 1);
    if (o.fpts) rampPoints(f.frequency, o.t, o.fpts);
    n.connect(f);
    n = f;
  }
  if (o.hp) {
    const f = filter(ctx, 'highpass', o.hp, -3);
    n.connect(f);
    n = f;
  }
  if (o.lp) {
    const f = filter(ctx, 'lowpass', o.lp, -3);
    n.connect(f);
    n = f;
  }
  if (o.drive) {
    const ws = shaper(ctx, o.drive);
    n.connect(ws);
    n = ws;
  }
  const { g, end } = vca(bus, o);
  n.connect(g);
  src.start(o.t, vrand() * 1.9);
  src.stop(end + 0.02);
  return end;
}

/* ------------------------------------------------------- additive bells */

/** [frequency ratio, relative amplitude, relative decay] */
export type Partial = readonly [number, number, number];
/** glockenspiel / struck bar modes - bright glassy ticks */
export const BAR: readonly Partial[] = [[1, 1, 1], [2.756, 0.42, 0.42], [5.404, 0.2, 0.2], [8.933, 0.08, 0.1]];
/** church-bell-ish (hum, prime, tierce, quint, nominal...) */
export const BELL: readonly Partial[] = [
  [0.5, 0.3, 1.3], [1, 1, 1], [1.19, 0.5, 0.75], [1.5, 0.32, 0.6], [2, 0.38, 0.5], [2.51, 0.18, 0.35], [3.01, 0.1, 0.25],
];
/** gong / tam-tam-ish inharmonic cluster */
export const GONG: readonly Partial[] = [
  [1, 1, 1], [1.47, 0.65, 0.85], [2.02, 0.5, 0.7], [2.71, 0.42, 0.55], [3.39, 0.3, 0.45], [4.17, 0.2, 0.35], [5.29, 0.13, 0.25],
];
/** small metal (coins, krotala sparkle) */
export const COIN: readonly Partial[] = [[1, 1, 1], [2.37, 0.6, 0.6], [3.91, 0.45, 0.45], [5.61, 0.25, 0.3]];
/** anvil / heavy metal strike */
export const ANVIL: readonly Partial[] = [[1, 1, 1], [2.32, 0.7, 0.8], [3.86, 0.5, 0.6], [5.21, 0.35, 0.45], [6.83, 0.2, 0.3]];

export interface BellOpts extends Shape {
  f: number;
  partials: readonly Partial[];
  /** extra attack for higher partials (gong bloom), seconds per ratio unit */
  bloom?: number;
  /** random detune spread (cents) */
  spread?: number;
}

export function bell(bus: Bus, o: BellOpts): number {
  const ctx = bus.ctx;
  const sum = ctx.createGain();
  const nyq = ctx.sampleRate * 0.42;
  let end = o.t + 0.01;
  for (const [ratio, amp, dec] of o.partials) {
    const f = o.f * ratio;
    if (f > nyq || f < 20) continue;
    const osc = ctx.createOscillator();
    osc.frequency.value = f;
    if (o.spread) osc.detune.value = (vrand() * 2 - 1) * o.spread;
    const g = ctx.createGain();
    g.gain.value = 0;
    const a = (o.a ?? 0.0015) + (o.bloom ? o.bloom * Math.max(0, ratio - 1) : 0);
    const e = envAHD(g.gain, o.t, o.v * amp, a, o.h ?? 0, o.d * dec);
    osc.connect(g).connect(sum);
    osc.start(o.t);
    osc.stop(e + 0.02);
    if (e > end) end = e;
  }
  route(bus, sum, o, end);
  return end;
}

/* --------------------------------------------------------------------- FM */

export interface FmOpts extends Shape {
  f: number;
  ratio: number;
  /** modulation index at start / end */
  index: number;
  index2?: number;
  idxTime?: number;
  f2?: number;
  glide?: number;
  drive?: number;
}

export function fm(bus: Bus, o: FmOpts): number {
  const ctx = bus.ctx;
  const car = ctx.createOscillator();
  const mod = ctx.createOscillator();
  const mg = ctx.createGain();
  const { g, end } = vca(bus, o);
  const fmHz = o.f * o.ratio;
  car.frequency.setValueAtTime(o.f, o.t);
  mod.frequency.setValueAtTime(fmHz, o.t);
  if (o.f2) {
    const tg = o.t + (o.glide ?? o.d);
    car.frequency.exponentialRampToValueAtTime(o.f2, tg);
    mod.frequency.exponentialRampToValueAtTime(o.f2 * o.ratio, tg);
  }
  mg.gain.setValueAtTime(o.index * fmHz, o.t);
  mg.gain.exponentialRampToValueAtTime(Math.max(0.01, (o.index2 ?? o.index * 0.05) * fmHz), o.t + (o.idxTime ?? o.d));
  mod.connect(mg).connect(car.frequency);
  let n: AudioNode = car;
  if (o.drive) {
    const ws = shaper(ctx, o.drive);
    n.connect(ws);
    n = ws;
  }
  n.connect(g);
  car.start(o.t);
  mod.start(o.t);
  car.stop(end + 0.02);
  mod.stop(end + 0.02);
  return end;
}

/* ----------------------------------------------------------------- grains */

export interface GrainOpts {
  t: number;
  /** grain start times relative to t */
  times: readonly number[];
  color?: NoiseColor;
  ft?: BiquadFilterType;
  /** filter frequency range */
  f: readonly [number, number];
  q?: number;
  /** grain decay range */
  d: readonly [number, number];
  v: number;
  /** per-grain amplitude multipliers */
  amps?: readonly number[];
  wet?: number;
  /** stereo spread of the round-robin channels */
  spread?: number;
  channels?: number;
  dest?: AudioNode;
  r: Rng;
}

/** Many tiny filtered noise bursts using only a few round-robin channels (cheap crackles / riffles / debris). */
export function grains(bus: Bus, o: GrainOpts): number {
  const ctx = bus.ctx;
  const K = o.channels ?? 3;
  const chans: { src: AudioBufferSourceNode; f: BiquadFilterNode; g: GainNode; busy: number }[] = [];
  let end = o.t + 0.01;
  for (let k = 0; k < K; k++) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx.sampleRate, o.color ?? 'white');
    src.loop = true;
    const f = filter(ctx, o.ft ?? 'bandpass', o.f[0], o.q ?? 2);
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g);
    const spread = o.spread ?? 0.6;
    route(bus, g, { t: o.t, wet: o.wet, dest: o.dest, pan: K > 1 ? ((k / (K - 1)) * 2 - 1) * spread : 0 }, o.t);
    chans.push({ src, f, g, busy: -1 });
  }
  o.times.forEach((dt, i) => {
    const ts = o.t + dt;
    let c: (typeof chans)[number] | null = null;
    for (let j = 0; j < K && !c; j++) {
      const cand = chans[(i + j) % K];
      if (cand.busy < ts) c = cand;
    }
    if (!c) return;
    const amp = o.v * (o.amps?.[i] ?? 1);
    c.f.frequency.setValueAtTime(o.f[0] + (o.f[1] - o.f[0]) * o.r(), ts);
    const dur = o.d[0] + (o.d[1] - o.d[0]) * o.r();
    const e = envAHD(c.g.gain, ts, amp, 0.0008, 0, dur);
    c.busy = e + 0.0005;
    if (e > end) end = e;
  });
  for (const c of chans) {
    c.src.start(o.t, vrand() * 1.9);
    c.src.stop(end + 0.02);
  }
  return end;
}

/* ------------------------------------------------------------------ pluck */

export interface PluckOpts extends Place {
  f: number;
  v: number;
  bright?: boolean;
  /** damp (mute) the string after this many seconds */
  damp?: number;
}

/** Lyre / kithara note from the Karplus-Strong cache. */
export function pluck(bus: Bus, o: PluckOpts): number {
  const ctx = bus.ctx;
  const m = clamp(Math.round(ftom(o.f)), 30, 105);
  const buf = pluckBuffer(ctx.sampleRate, m, o.bright ? 1 : 0);
  const rate = o.f / mtof(m);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = o.v;
  let end = o.t + buf.duration / rate;
  if (o.damp && o.t + o.damp + 0.15 < end) {
    g.gain.setValueAtTime(o.v, o.t + o.damp);
    g.gain.exponentialRampToValueAtTime(o.v * 0.001, o.t + o.damp + 0.12);
    g.gain.linearRampToValueAtTime(0, o.t + o.damp + 0.125);
    end = o.t + o.damp + 0.125;
  }
  src.connect(g);
  route(bus, g, o, end);
  src.start(o.t);
  src.stop(end + 0.01);
  return end;
}

/* -------------------------------------------------------------- brass-ish */

export interface BrassOpts extends Shape {
  f: number;
  /** filter peak as a multiple of f */
  bright?: number;
  detune?: number;
  vib?: number;
}

export function brass(bus: Bus, o: BrassOpts): number {
  const ctx = bus.ctx;
  const { g, end } = vca(bus, o);
  const lp = filter(ctx, 'lowpass', o.f * 1.5, 2);
  const a = o.a ?? 0.04;
  const peak = Math.min(16000, o.f * (o.bright ?? 7));
  lp.frequency.setValueAtTime(o.f * 1.2, o.t);
  lp.frequency.exponentialRampToValueAtTime(peak, o.t + a * 1.6 + 0.01);
  lp.frequency.exponentialRampToValueAtTime(Math.max(o.f * 2, 200), o.t + a + (o.h ?? 0) + o.d * 0.6);
  lp.connect(g);
  const det = o.detune ?? 7;
  const lfo = o.vib ? ctx.createOscillator() : null;
  const lg = o.vib ? ctx.createGain() : null;
  if (lfo && lg) {
    lfo.frequency.value = 5.2;
    lg.gain.setValueAtTime(0, o.t);
    lg.gain.linearRampToValueAtTime(o.vib ?? 0, o.t + a + 0.25);
    lfo.connect(lg);
    lfo.start(o.t);
    lfo.stop(end + 0.02);
  }
  for (const dc of [-det, det, 0]) {
    const osc = ctx.createOscillator();
    osc.type = dc === 0 ? 'square' : 'sawtooth';
    osc.frequency.value = dc === 0 ? o.f * 0.5 : o.f;
    osc.detune.value = dc;
    const og = ctx.createGain();
    og.gain.value = dc === 0 ? 0.22 : 0.4;
    osc.connect(og).connect(lp);
    if (lg) lg.connect(osc.detune);
    osc.start(o.t);
    osc.stop(end + 0.02);
  }
  return end;
}

/* ------------------------------------------------------------------ choir */

const VOWELS: Record<'a' | 'o' | 'e', readonly (readonly [number, number, number])[]> = {
  a: [[780, 1, 7], [1150, 0.55, 9], [2800, 0.22, 14]],
  o: [[460, 1, 6], [820, 0.5, 8], [2700, 0.12, 14]],
  e: [[420, 1, 6], [1750, 0.4, 10], [2650, 0.25, 14]],
};

export interface ChoirOpts extends Shape {
  f: number;
  vowel?: 'a' | 'o' | 'e';
  voices?: number;
}

/** Formant-filtered detuned saws: an "aah" voice section. */
export function choir(bus: Bus, o: ChoirOpts): number {
  const ctx = bus.ctx;
  const { g, end } = vca(bus, { ...o, swell: o.swell ?? true });
  const n = o.voices ?? 3;
  const pre = ctx.createGain();
  pre.gain.value = 1 / n;
  const post = ctx.createGain();
  post.gain.value = 3.2;
  for (const [ff, fg, fq] of VOWELS[o.vowel ?? 'a']) {
    const bp = filter(ctx, 'bandpass', ff, fq);
    const bg = ctx.createGain();
    bg.gain.value = fg;
    pre.connect(bp).connect(bg).connect(post);
  }
  post.connect(g);
  for (let i = 0; i < n; i++) {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = o.f;
    osc.detune.value = n > 1 ? ((i / (n - 1)) * 2 - 1) * 11 : 0;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 4.6 + i * 0.37;
    const lg = ctx.createGain();
    lg.gain.value = 9;
    lfo.connect(lg).connect(osc.detune);
    osc.connect(pre);
    osc.start(o.t);
    lfo.start(o.t);
    osc.stop(end + 0.02);
    lfo.stop(end + 0.02);
  }
  return end;
}
