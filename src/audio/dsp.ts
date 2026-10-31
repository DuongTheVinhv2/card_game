// Shared, context-agnostic DSP helpers for the procedural audio engine.
// Everything here works with any BaseAudioContext (live AudioContext or OfflineAudioContext).

export type Rng = () => number;

/** Small, fast, seedable PRNG. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rand = (r: Rng, a: number, b: number): number => a + (b - a) * r();
export function pick<T>(r: Rng, arr: readonly T[]): T {
  return arr[Math.min(arr.length - 1, Math.floor(r() * arr.length))];
}
export const clamp = (x: number, a: number, b: number): number => (x < a ? a : x > b ? b : x);
export const mtof = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);
export const ftom = (f: number): number => 69 + 12 * Math.log2(f / 440);
export const semis = (n: number): number => Math.pow(2, n / 12);

/* ------------------------------------------------------------------ modes */

export type ModeName = 'dorian' | 'phrygian' | 'mixolydian' | 'phrygianDom' | 'aeolian' | 'ionian' | 'lydian';
export const MODES: Record<ModeName, readonly number[]> = {
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  phrygianDom: [0, 1, 4, 5, 7, 8, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  ionian: [0, 2, 4, 5, 7, 9, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
};

/** A musical key: root midi note + mode intervals. */
export interface Key {
  root: number;
  mode: readonly number[];
}

/** Scale degree (0 = root, 7 = octave, negative allowed) -> midi note. */
export function degMidi(k: Key, deg: number): number {
  const d = Math.round(deg);
  const o = Math.floor(d / 7);
  return k.root + 12 * o + k.mode[d - o * 7];
}
export const degFreq = (k: Key, deg: number): number => mtof(degMidi(k, deg));

/* -------------------------------------------------------------- envelopes */

/**
 * Click-free percussive / AHD envelope on an AudioParam:
 * 0 -> peak (linear, a) -> hold (h) -> exponential decay to -60 dB (d) -> 0.
 * Returns the time at which the param is exactly 0 again.
 */
export function envAHD(p: AudioParam, t: number, peak: number, a: number, h: number, d: number): number {
  const ta = t + Math.max(0.0006, a);
  p.setValueAtTime(0, t);
  if (peak <= 0) return ta;
  p.linearRampToValueAtTime(peak, ta);
  if (h > 0) p.setValueAtTime(peak, ta + h);
  const te = ta + h + Math.max(0.004, d);
  p.exponentialRampToValueAtTime(peak * 0.001, te);
  p.linearRampToValueAtTime(0, te + 0.003);
  return te + 0.003;
}

/**
 * Swell envelope: exponential-ish rise (starts at -60 dB, so it is click-free), hold, release.
 */
export function envSwell(p: AudioParam, t: number, peak: number, a: number, h: number, r: number): number {
  p.setValueAtTime(0, t);
  if (peak <= 0) return t + a;
  p.linearRampToValueAtTime(peak * 0.001, t + 0.002);
  p.exponentialRampToValueAtTime(peak, t + 0.002 + Math.max(0.01, a));
  const th = t + 0.002 + Math.max(0.01, a) + Math.max(0, h);
  p.setValueAtTime(peak, th);
  const te = th + Math.max(0.01, r);
  p.exponentialRampToValueAtTime(peak * 0.001, te);
  p.linearRampToValueAtTime(0, te + 0.003);
  return te + 0.003;
}

/** Exponential ramp through a list of [dt, value] points (relative to t). Values must be > 0. */
export function rampPoints(p: AudioParam, t: number, pts: readonly (readonly [number, number])[]): void {
  if (!pts.length) return;
  p.setValueAtTime(pts[0][1], t + pts[0][0]);
  for (let i = 1; i < pts.length; i++) p.exponentialRampToValueAtTime(Math.max(1e-4, pts[i][1]), t + pts[i][0]);
}

/** Fade a param from its current automation state to `v` starting now-ish (safe on live params). */
export function glideParam(p: AudioParam, t: number, v: number, tau: number): void {
  p.cancelScheduledValues(t);
  p.setValueAtTime(p.value, t);
  p.setTargetAtTime(v, t, Math.max(0.001, tau));
}

/* ---------------------------------------------------------------- buffers */

export type NoiseColor = 'white' | 'pink' | 'brown';
const noiseCache = new Map<string, AudioBuffer>();

/** 2 s seamless-loop mono noise buffer (RMS ~0.3), shared across contexts of the same sample rate. */
export function noiseBuffer(sr: number, color: NoiseColor): AudioBuffer {
  const key = `${sr}|${color}`;
  const hit = noiseCache.get(key);
  if (hit) return hit;
  const L = Math.floor(sr * 2);
  const X = Math.floor(sr * 0.08);
  const raw = new Float32Array(L + X);
  const r = mulberry32(color === 'white' ? 11 : color === 'pink' ? 22 : 33);
  let b0 = 0, b1 = 0, b2 = 0, last = 0;
  for (let i = 0; i < raw.length; i++) {
    const w = r() * 2 - 1;
    if (color === 'white') raw[i] = w;
    else if (color === 'pink') {
      b0 = 0.99765 * b0 + w * 0.099046;
      b1 = 0.963 * b1 + w * 0.2965164;
      b2 = 0.57 * b2 + w * 1.0526913;
      raw[i] = b0 + b1 + b2 + w * 0.1848;
    } else {
      last = (last + 0.02 * w) / 1.02;
      raw[i] = last;
    }
  }
  const out = new Float32Array(L);
  for (let i = 0; i < L; i++) {
    if (i < X) {
      const k = i / X;
      out[i] = raw[i] * Math.sqrt(k) + raw[L + i] * Math.sqrt(1 - k);
    } else out[i] = raw[i];
  }
  let mean = 0;
  for (let i = 0; i < L; i++) mean += out[i];
  mean /= L;
  let ss = 0;
  for (let i = 0; i < L; i++) {
    out[i] -= mean;
    ss += out[i] * out[i];
  }
  const g = 0.3 / Math.sqrt(ss / L);
  for (let i = 0; i < L; i++) out[i] *= g;
  const buf = new AudioBuffer({ length: L, sampleRate: sr, numberOfChannels: 1 });
  buf.copyToChannel(out, 0);
  noiseCache.set(key, buf);
  return buf;
}

const irCache = new Map<string, AudioBuffer>();

/**
 * Synthesized stereo hall impulse response: short pre-delay, a few early reflections,
 * then decorrelated noise with an exponential decay that darkens over time.
 * Energy-normalized per channel (use with convolver.normalize = false).
 */
export function reverbIR(sr: number, seconds = 3.2, t60 = 2.7): AudioBuffer {
  const key = `${sr}|${seconds}|${t60}`;
  const hit = irCache.get(key);
  if (hit) return hit;
  const L = Math.floor(sr * seconds);
  const buf = new AudioBuffer({ length: L, sampleRate: sr, numberOfChannels: 2 });
  const pre = Math.floor(sr * 0.014);
  const fadeOut = Math.floor(sr * 0.35);
  for (let c = 0; c < 2; c++) {
    const r = mulberry32(777 + c * 131);
    const d = new Float32Array(L);
    let y = 0;
    for (let i = pre; i < L; i++) {
      const t = (i - pre) / sr;
      const fc = 1100 + 8500 * Math.exp(-t * 1.8);
      const a = Math.exp((-2 * Math.PI * fc) / sr);
      y = (1 - a) * (r() * 2 - 1) + a * y;
      const comp = Math.sqrt((1 + a) / (1 - a));
      let e = Math.exp((-6.9078 * t) / t60);
      if (t < 0.02) e *= 0.5 - 0.5 * Math.cos((Math.PI * t) / 0.02);
      if (i > L - fadeOut) e *= 0.5 + 0.5 * Math.cos((Math.PI * (i - (L - fadeOut))) / fadeOut);
      d[i] = y * comp * e;
    }
    // early reflections (tiny smoothed taps)
    for (let k = 0; k < 9; k++) {
      const te = 0.006 + r() * 0.075;
      const amp = (0.9 - te * 8) * (r() < 0.5 ? -1 : 1) * 1.6;
      const i0 = pre + Math.floor(te * sr);
      for (let j = 0; j < 12 && i0 + j < L; j++) d[i0 + j] += amp * Math.sin((Math.PI * j) / 12) * 0.25;
    }
    let ss = 0;
    for (let i = 0; i < L; i++) ss += d[i] * d[i];
    const g = 1 / Math.sqrt(ss || 1);
    for (let i = 0; i < L; i++) d[i] *= g;
    buf.copyToChannel(d, c);
  }
  irCache.set(key, buf);
  return buf;
}

const curveCache = new Map<string, Float32Array<ArrayBuffer>>();

/** tanh drive curve normalized to +-1 at the edges. */
export function driveCurve(drive: number): Float32Array<ArrayBuffer> {
  const key = `tanh${drive}`;
  const hit = curveCache.get(key);
  if (hit) return hit;
  const n = 2048;
  const c = new Float32Array(n);
  const norm = Math.tanh(drive);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(drive * x) / norm;
  }
  curveCache.set(key, c);
  return c;
}

/**
 * Safety soft-clipper for the master bus. The input is pre-scaled by 0.5, so the curve covers
 * real input amplitudes of +-2 (+6 dB). Linear below 0.8, smooth knee, asymptote 0.98.
 */
export function softClipCurve(): Float32Array<ArrayBuffer> {
  const key = 'softclip';
  const hit = curveCache.get(key);
  if (hit) return hit;
  const n = 4096;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = ((i / (n - 1)) * 2 - 1) * 2;
    const ax = Math.abs(x);
    const y = ax <= 0.8 ? ax : 0.8 + 0.18 * Math.tanh((ax - 0.8) / 0.18);
    c[i] = Math.sign(x) * y;
  }
  curveCache.set(key, c);
  return c;
}
