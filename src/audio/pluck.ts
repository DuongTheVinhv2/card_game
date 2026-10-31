// Karplus-Strong plucked string (lyre / kithara), pre-rendered once per (sampleRate, midi, brightness)
// into mono AudioBuffers that are shared by every context (AudioBuffers are context-independent).

import { clamp, mtof, mulberry32 } from './dsp';

/** LRU cache: Map iteration order = recency. Re-rendering an evicted string costs ~1 ms. */
const cache = new Map<string, AudioBuffer>();
const MAX_CACHED = 56;

/** Number of cached string buffers (for diagnostics). */
export const pluckCacheSize = (): number => cache.size;

export function pluckBuffer(sr: number, midi: number, bright: 0 | 1): AudioBuffer {
  const key = `${sr}|${midi}|${bright}`;
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  while (cache.size >= MAX_CACHED) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }

  const f = mtof(midi);
  const t60 = clamp(2.2 - (midi - 48) * 0.042, 0.6, 2.3);
  const len = Math.floor(sr * Math.min(t60 + 0.1, 2.2));
  const out = new Float32Array(len);

  // loop: delay d (fractional, linear interp) + 2-tap lowpass (adds S samples of delay)
  const D = sr / f;
  const S = bright ? 0.3 : 0.44;
  const d = D - S;
  const di = Math.floor(d);
  const fr = d - di;
  const gLoop = Math.pow(10, -3 / (f * t60));

  // excitation: one period of lowpassed noise, pluck-position comb, DC removed, soft onset
  const N = Math.max(4, Math.round(D));
  const r = mulberry32(midi * 977 + bright * 131 + 7);
  const fc = bright ? 7500 : 3400;
  const a = Math.exp((-2 * Math.PI * fc) / sr);
  const ex = new Float32Array(N);
  let y = 0;
  for (let i = 0; i < N; i++) {
    y = (1 - a) * (r() * 2 - 1) + a * y;
    ex[i] = y;
  }
  const P = Math.max(1, Math.round(N * 0.16));
  const e2 = new Float32Array(N);
  let mean = 0;
  for (let i = 0; i < N; i++) {
    e2[i] = ex[i] - (i >= P ? ex[i - P] * 0.9 : 0);
    mean += e2[i];
  }
  mean /= N;
  const onset = Math.min(N, Math.floor(sr * 0.0008));
  for (let i = 0; i < N; i++) {
    e2[i] -= mean;
    if (i < onset) e2[i] *= 0.5 - 0.5 * Math.cos((Math.PI * i) / onset);
  }

  let prevDel = 0;
  for (let n = 0; n < len; n++) {
    const ia = n - di;
    const ya = ia >= 0 ? out[ia] : 0;
    const yb = ia >= 1 ? out[ia - 1] : 0;
    const del = ya + (yb - ya) * fr;
    const lp = (1 - S) * del + S * prevDel;
    prevDel = del;
    out[n] = (n < N ? e2[n] : 0) + gLoop * lp;
  }

  // gentle body resonance (~300 Hz bandpass, mixed in) for a wooden soundbox feel
  const w0 = (2 * Math.PI * 300) / sr;
  const q = 1.4;
  const alpha = Math.sin(w0) / (2 * q);
  const b0 = alpha, b2 = -alpha, a0 = 1 + alpha, a1 = -2 * Math.cos(w0), a2 = 1 - alpha;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  let peak = 0;
  for (let n = 0; n < len; n++) {
    const x = out[n];
    const yb = (b0 * x + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = yb;
    const v = x + yb * 0.6;
    out[n] = v;
    const av = Math.abs(v);
    if (av > peak) peak = av;
  }

  // normalize + fade out the last 80 ms so the buffer always ends at exactly zero
  const gain = peak > 0 ? 0.9 / peak : 1;
  const fade = Math.min(len, Math.floor(sr * 0.08));
  for (let n = 0; n < len; n++) {
    let k = gain;
    if (n >= len - fade) k *= 0.5 + 0.5 * Math.cos((Math.PI * (n - (len - fade))) / fade);
    out[n] *= k;
  }
  out[len - 1] = 0;

  const buf = new AudioBuffer({ length: len, sampleRate: sr, numberOfChannels: 1 });
  buf.copyToChannel(out, 0);
  cache.set(key, buf);
  return buf;
}
