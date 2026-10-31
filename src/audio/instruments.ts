// Higher-level instruments built on the primitives: aulos reed phrases, drone pads, percussion, gong, booms.

import { clamp, noiseBuffer } from './dsp';
import { bell, GONG, noise, route, tone, vrand, type Bus, type Place } from './voices';

/** Placement options for instruments whose start time is passed separately. */
export type Send = Omit<Place, 't'>;

function biquad(ctx: BaseAudioContext, type: BiquadFilterType, f: number, q: number, gain = 0): BiquadFilterNode {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  b.gain.value = gain;
  return b;
}

/* ------------------------------------------------------------------ aulos */

export interface ANote {
  t: number;
  f: number;
  d: number;
  v: number;
}

export interface AulosOpts extends Send {
  /** second pipe drone frequency */
  drone?: number;
  /** vibrato depth in cents */
  vib?: number;
  /** tone brightness multiplier (lowpass) */
  bright?: number;
  breath?: number;
}

/** Double-reed aulos: one voice per phrase, slurred pitch changes, tongued articulations, delayed vibrato. */
export function aulos(bus: Bus, notes: readonly ANote[], o: AulosOpts): number {
  if (!notes.length) return bus.ctx.currentTime;
  const ctx = bus.ctx;
  const ns = notes.map((n) => ({ ...n, d: Math.max(0.09, n.d) }));
  const t0 = ns[0].t;
  const last = ns[ns.length - 1];
  const end = last.t + last.d + 0.05;

  const amp = ctx.createGain();
  amp.gain.value = 0;
  const hp = biquad(ctx, 'highpass', 230, -3);
  const pk1 = biquad(ctx, 'peaking', 1150, 1.3, 6);
  const pk2 = biquad(ctx, 'peaking', 2700, 1.6, 4);
  const lp = biquad(ctx, 'lowpass', 3400 * (o.bright ?? 1), -1);
  hp.connect(pk1).connect(pk2).connect(lp).connect(amp);
  route(bus, amp, { ...o, t: t0 }, end);

  const oA = ctx.createOscillator();
  oA.type = 'sawtooth';
  const oB = ctx.createOscillator();
  oB.type = 'square';
  oB.detune.value = 6;
  const gA = ctx.createGain();
  gA.gain.value = 0.42;
  const gB = ctx.createGain();
  gB.gain.value = 0.16;
  oA.connect(gA).connect(hp);
  oB.connect(gB).connect(hp);

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5.3;
  const vg = ctx.createGain();
  vg.gain.value = 0;
  lfo.connect(vg);
  vg.connect(oA.detune);
  vg.connect(oB.detune);

  const br = ctx.createBufferSource();
  br.buffer = noiseBuffer(ctx.sampleRate, 'pink');
  br.loop = true;
  const brf = biquad(ctx, 'bandpass', 1700, 0.8);
  const brg = ctx.createGain();
  brg.gain.value = o.breath ?? 0.22;
  br.connect(brf).connect(brg).connect(hp);

  let oD: OscillatorNode | null = null;
  if (o.drone) {
    oD = ctx.createOscillator();
    oD.type = 'sawtooth';
    oD.frequency.value = o.drone;
    const gD = ctx.createGain();
    gD.gain.value = 0.17;
    oD.connect(gD).connect(hp);
  }

  const vib = o.vib ?? 16;
  ns.forEach((n, i) => {
    const prev = ns[i - 1];
    const next = ns[i + 1];
    const legIn = !!prev && n.t - (prev.t + prev.d) < 0.015;
    const legOut = !!next && next.t - (n.t + n.d) < 0.015;
    for (const f of [oA.frequency, oB.frequency]) {
      if (i === 0 || !legIn) f.setValueAtTime(n.f, n.t);
      else f.setTargetAtTime(n.f, n.t - 0.008, 0.012);
    }
    if (legIn && prev) {
      amp.gain.setValueAtTime(prev.v, n.t - 0.022);
      amp.gain.linearRampToValueAtTime(prev.v * 0.62, n.t);
      amp.gain.linearRampToValueAtTime(n.v, n.t + 0.03);
    } else {
      amp.gain.setValueAtTime(0, n.t);
      amp.gain.linearRampToValueAtTime(n.v, n.t + 0.035);
    }
    if (!legOut) {
      const rel = Math.min(0.08, n.d * 0.3);
      amp.gain.setValueAtTime(n.v, n.t + n.d - rel);
      amp.gain.linearRampToValueAtTime(0, n.t + n.d);
    }
    vg.gain.setValueAtTime(0, n.t);
    if (n.d > 0.22) {
      vg.gain.setValueAtTime(0, n.t + 0.12);
      vg.gain.linearRampToValueAtTime(vib, n.t + Math.min(0.45, n.d * 0.7));
      vg.gain.setValueAtTime(vib, n.t + n.d - 0.03);
      vg.gain.linearRampToValueAtTime(0, n.t + n.d);
    }
  });

  const srcs: AudioScheduledSourceNode[] = [oA, oB, lfo, br];
  if (oD) srcs.push(oD);
  for (const s of srcs) {
    if (s === br) br.start(t0, vrand() * 1.9);
    else s.start(t0);
    s.stop(end + 0.02);
  }
  return end;
}

/* -------------------------------------------------------------- drone pad */

export interface PadOpts extends Send {
  v: number;
  cutoff: number;
  q?: number;
  /** attack seconds */
  a?: number;
  detune?: number;
  type?: OscillatorType;
  /** cutoff LFO depth (fraction of cutoff) */
  lfoDepth?: number;
}

/** Persistent detuned-saw drone with slow filter movement; frequencies glide on chord changes. */
export class Pad {
  private oscs: OscillatorNode[] = [];
  private lfo: OscillatorNode;
  private lfoGain: GainNode;
  readonly filt: BiquadFilterNode;
  readonly amp: GainNode;
  private t0: number;
  private a: number;
  private v: number;
  private nf: number;
  stopped = false;

  constructor(bus: Bus, t: number, freqs: readonly number[], o: PadOpts) {
    const ctx = bus.ctx;
    this.t0 = t;
    this.a = Math.max(0.05, o.a ?? 1.5);
    this.v = o.v;
    this.nf = freqs.length;
    this.filt = biquad(ctx, 'lowpass', o.cutoff, o.q ?? 0);
    this.amp = ctx.createGain();
    this.amp.gain.value = 0;
    this.amp.gain.setValueAtTime(0, t);
    this.amp.gain.linearRampToValueAtTime(o.v * 0.001, t + 0.01);
    this.amp.gain.exponentialRampToValueAtTime(o.v, t + this.a);
    const mix = ctx.createGain();
    mix.gain.value = 1 / Math.sqrt(freqs.length * 2);
    mix.connect(this.filt).connect(this.amp);
    route(bus, this.amp, { ...o, t }, t);
    this.lfo = ctx.createOscillator();
    this.lfo.frequency.value = 0.05 + vrand() * 0.05;
    this.lfoGain = ctx.createGain();
    this.lfoGain.gain.value = o.cutoff * (o.lfoDepth ?? 0.3);
    this.lfo.connect(this.lfoGain).connect(this.filt.frequency);
    this.lfo.start(t);
    const det = o.detune ?? 7;
    freqs.forEach((f) => {
      for (const dc of [-det, det]) {
        const osc = ctx.createOscillator();
        osc.type = o.type ?? 'sawtooth';
        osc.frequency.value = f;
        osc.detune.value = dc + (vrand() * 2 - 1) * 2;
        osc.connect(mix);
        osc.start(t);
        this.oscs.push(osc);
      }
    });
  }

  /** glide to new pitches (same count as constructed; extra values ignored, missing repeat) */
  setFreqs(freqs: readonly number[], t: number, glide = 0.35): void {
    if (this.stopped || !freqs.length) return;
    for (let i = 0; i < this.nf; i++) {
      const f = freqs[i % freqs.length];
      this.oscs[i * 2].frequency.setTargetAtTime(f, t, glide / 3);
      this.oscs[i * 2 + 1].frequency.setTargetAtTime(f, t, glide / 3);
    }
  }

  setCutoff(c: number, t: number, tau = 0.6): void {
    if (this.stopped) return;
    this.filt.frequency.setTargetAtTime(c, t, tau);
    this.lfoGain.gain.setTargetAtTime(c * 0.3, t, tau);
  }

  stop(t: number, r = 1.2): void {
    if (this.stopped) return;
    this.stopped = true;
    const g = this.amp.gain;
    if (t < this.t0 + this.a) {
      // still in the attack: recompute the exact curve value so cancelling cannot jump
      const k = clamp((t - this.t0 - 0.01) / (this.a - 0.01), 0, 1);
      const val = t <= this.t0 + 0.01 ? this.v * 0.001 * clamp((t - this.t0) / 0.01, 0, 1) : this.v * Math.pow(0.001, 1 - k);
      g.cancelScheduledValues(t);
      g.setValueAtTime(val, t);
    }
    g.setTargetAtTime(0, t, r / 7);
    const end = t + r * 1.15;
    for (const o of this.oscs) o.stop(end);
    this.lfo.stop(end);
  }
}

/* ------------------------------------------------------------ percussion */

export interface DrumOpts extends Send {
  f?: number;
  /** darker skin noise */
  dark?: boolean;
}

/** Frame drum / tympanon "dum": pitched membrane thump + skin noise. */
export function frameDrum(bus: Bus, t: number, v: number, o: DrumOpts = {}): number {
  const f = o.f ?? 92;
  const p: Place = { t, wet: o.wet, pan: o.pan, dest: o.dest };
  let end = tone(bus, { ...p, f: f * 2.2, f2: f, glide: 0.035, v, a: 0.0015, d: 0.42 });
  end = Math.max(end, tone(bus, { ...p, f: f * 2.6, f2: f * 1.59, glide: 0.03, v: v * 0.2, a: 0.001, d: 0.16 }));
  end = Math.max(end, noise(bus, { ...p, color: 'pink', ft: 'lowpass', f: o.dark ? 520 : 1100, q: -3, v: v * 0.5, a: 0.0008, d: 0.065 }));
  return end;
}

/** Frame drum rim "tek": bright slap. */
export function rimTek(bus: Bus, t: number, v: number, o: Send = {}): number {
  const p: Place = { t, wet: o.wet, pan: o.pan, dest: o.dest };
  const e1 = noise(bus, { ...p, f: 3300, q: 1.3, v, a: 0.0006, d: 0.045 });
  const e2 = tone(bus, { ...p, f: 640, f2: 470, glide: 0.03, v: v * 0.32, a: 0.0008, d: 0.035 });
  return Math.max(e1, e2);
}

/** Tambourine: jingle shimmer (closed or open). */
export function tambourine(bus: Bus, t: number, v: number, o: Send & { open?: boolean } = {}): number {
  const p: Place = { t, wet: o.wet, pan: o.pan, dest: o.dest };
  const d = o.open ? 0.22 : 0.075;
  const e1 = noise(bus, { ...p, f: 9200, q: 1.1, v, a: 0.0015, d });
  const e2 = noise(bus, { ...p, f: 7300, q: 7, v: v * 0.9, a: 0.003, d: d * 1.4 });
  return Math.max(e1, e2);
}

/** Krotala (wooden clappers): short dry clack. */
export function krotala(bus: Bus, t: number, v: number, o: Send = {}): number {
  const p: Place = { t, wet: o.wet, pan: o.pan, dest: o.dest };
  const e1 = noise(bus, { ...p, f: 2300, q: 4, v, a: 0.0005, d: 0.028 });
  const e2 = tone(bus, { ...p, type: 'triangle', f: 1480, v: v * 0.3, a: 0.0006, d: 0.022 });
  return Math.max(e1, e2);
}

/** Low sub pulse (plus a quiet 2nd harmonic so small speakers still feel it). */
export function subPulse(bus: Bus, t: number, f: number, v: number, d = 0.35, o: Send = {}): number {
  const p: Place = { t, dest: o.dest };
  const e1 = tone(bus, { ...p, f, v, a: 0.012, h: d * 0.15, d });
  const e2 = tone(bus, { ...p, f: f * 2, v: v * 0.22, a: 0.012, d: d * 0.6 });
  return Math.max(e1, e2);
}

/** Cinematic boom: pitch-dropping sine with optional saturation plus a noise body. */
export function boom(bus: Bus, t: number, v: number, o: Send & { f0?: number; f1?: number; d?: number; drive?: number } = {}): number {
  const p: Place = { t, wet: o.wet, pan: o.pan, dest: o.dest };
  const d = o.d ?? 0.9;
  let end = tone(bus, { ...p, f: o.f0 ?? 110, f2: o.f1 ?? 38, glide: d * 0.5, v, a: 0.002, d, drive: o.drive });
  end = Math.max(end, noise(bus, { ...p, color: 'brown', ft: 'lowpass', f: 380, q: -3, v: v * 0.9, a: 0.002, d: d * 0.35 }));
  return end;
}

/** Bronze gong with bloom (high partials swell in late) and a noisy wash. */
export function gong(bus: Bus, t: number, f: number, v: number, d = 3, o: Send = {}): number {
  const p: Place = { t, wet: o.wet, pan: o.pan, dest: o.dest };
  let end = bell(bus, { ...p, f, partials: GONG, v, a: 0.004, d, bloom: 0.05, spread: 6 });
  end = Math.max(end, noise(bus, { ...p, color: 'pink', f: f * 4.5, q: 1.4, v: v * 0.35, a: 0.25, d: d * 0.5, swell: true }));
  end = Math.max(end, tone(bus, { ...p, f: f * 0.5, v: v * 0.4, a: 0.004, d: d * 0.4 }));
  return end;
}
