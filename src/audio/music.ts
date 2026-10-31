// Generative music: a step-sequenced Track base class driven by an external lookahead scheduler
// (live: 25 ms timer, ~0.12 s ahead; offline: one scheduleUntil() call), plus melody helpers.

import { clamp, degMidi, mtof, mulberry32, pick, type Key, type Rng } from './dsp';
import type { Bus } from './voices';
import { aulos, type ANote } from './instruments';

/** A note inside a motif: step offset, length (steps), scale degree, velocity, optional grace-note ornament. */
export interface MNote {
  s: number;
  l: number;
  d: number;
  v: number;
  orn?: number;
}

/** Diagnostics hook: exceptions thrown inside a step are swallowed (the scheduler must survive) but reported here. */
export const trackDiagnostics: { onError: ((e: unknown) => void) | null } = { onError: null };

export interface Stoppable {
  stop(t: number, r?: number): void;
}

export abstract class Track {
  readonly ctx: BaseAudioContext;
  readonly bus: Bus;
  readonly gain: GainNode;
  readonly wetGain: GainNode;
  protected r: Rng;
  abstract readonly bpm: number;
  abstract key: Key;
  stepsPerBar = 16;
  stepsPerBeat = 4;
  /** fraction of a step that odd 16th steps are delayed by */
  swing = 0;
  /** 8th-note shuffle: fraction of an 8th that off-beat 8ths (step % 4 === 2) are delayed by */
  swing8 = 0;
  /** overall track level */
  level = 1;
  intensity = 0;
  stopped = false;
  protected held: Stoppable[] = [];
  private nextT = 0;
  private stepN = 0;
  private t0 = 0;
  private fadeIn = 0.01;

  constructor(ctx: BaseAudioContext, dry: AudioNode, wet: AudioNode, seed: number) {
    this.ctx = ctx;
    this.r = mulberry32(seed);
    this.gain = ctx.createGain();
    this.wetGain = ctx.createGain();
    this.gain.gain.value = 0;
    this.wetGain.gain.value = 0;
    this.gain.connect(dry);
    this.wetGain.connect(wet);
    this.bus = { ctx, out: this.gain, verb: this.wetGain };
  }

  get stepDur(): number {
    return 60 / this.bpm / this.stepsPerBeat;
  }

  start(t: number, fade: number): void {
    this.t0 = t;
    this.fadeIn = Math.max(0.01, fade);
    this.nextT = t + 0.02;
    for (const p of [this.gain.gain, this.wetGain.gain]) {
      p.setValueAtTime(0, t);
      p.linearRampToValueAtTime(this.level, t + this.fadeIn);
    }
    this.setup(t);
  }

  /**
   * Schedule every step whose time is < until. Steps that are already more than 50 ms late
   * (main-thread stall) are skipped instead of being fired in a burst.
   */
  scheduleUntil(until: number, now = -Infinity): void {
    while (!this.stopped && this.nextT < until) {
      const s = this.stepN;
      const t = this.nextT + (s % 2 === 1 ? this.swing * this.stepDur : 0) + (s % 4 === 2 ? this.swing8 * 2 * this.stepDur : 0);
      if (t >= now - 0.05) {
        try {
          this.onStep(s, Math.max(t, now));
        } catch (e) {
          trackDiagnostics.onError?.(e); // a bad step must never kill the scheduler
        }
      }
      this.stepN++;
      this.nextT += this.stepDur;
    }
  }

  /** fade out and release persistent voices; returns the time everything is silent */
  stop(t: number, fade: number): number {
    if (this.stopped) return t;
    this.stopped = true;
    const v = this.level * clamp((t - this.t0) / this.fadeIn, 0, 1);
    for (const p of [this.gain.gain, this.wetGain.gain]) {
      p.cancelScheduledValues(t);
      p.setValueAtTime(v, t);
      p.linearRampToValueAtTime(0, t + Math.max(0.02, fade));
    }
    for (const h of this.held) h.stop(t + fade, 0.3);
    return t + fade + 0.5;
  }

  disconnect(): void {
    this.gain.disconnect();
    this.wetGain.disconnect();
  }

  setIntensity(v: number): void {
    this.intensity = clamp(v, 0, 1);
  }

  /** frequency of a scale degree (+ octaves) in the track key */
  protected f(deg: number, oct = 0): number {
    return mtof(degMidi(this.key, deg) + 12 * oct);
  }

  protected chance(p: number): boolean {
    return this.r() < p;
  }

  /** play an aulos phrase from a motif starting at time t (grace-note ornaments expanded) */
  protected aulosMotif(m: readonly MNote[], t: number, deg0: number, v: number, opts: { drone?: number; wet?: number; pan?: number; vib?: number; bright?: number }): void {
    const sd = this.stepDur;
    const notes: ANote[] = [];
    m.forEach((n, i) => {
      const nt = t + n.s * sd;
      const nextS = m[i + 1]?.s;
      const legato = nextS !== undefined && nextS === n.s + n.l;
      const dur = legato ? n.l * sd : Math.max(0.1, n.l * sd * 0.9);
      if (n.orn && n.l >= 3) {
        notes.push({ t: nt, f: this.f(deg0 + n.d + n.orn), d: 0.055, v: v * n.v * 0.8 });
        notes.push({ t: nt + 0.055, f: this.f(deg0 + n.d), d: dur - 0.055, v: v * n.v });
      } else notes.push({ t: nt, f: this.f(deg0 + n.d), d: dur, v: v * n.v });
    });
    aulos(this.bus, notes, opts);
  }

  protected abstract setup(t: number): void;
  protected abstract onStep(step: number, t: number): void;
}

/* --------------------------------------------------------- melody helpers */

/** nearest degree to d whose pitch class is in `tones` (degrees, any octave) */
export function nearestTone(d: number, tones: readonly number[]): number {
  let best = d;
  let bd = 1e9;
  for (const tt of tones) {
    const cls = ((tt % 7) + 7) % 7;
    for (let o = -4; o <= 4; o++) {
      const c = cls + 7 * o;
      const dist = Math.abs(c - d);
      if (dist < bd) {
        bd = dist;
        best = c;
      }
    }
  }
  return best;
}

export const triad = (root: number): number[] => [root, root + 2, root + 4];

export interface MotifOpts {
  /** rhythm cells (lengths in steps) */
  cells: readonly (readonly number[])[];
  lo: number;
  hi: number;
  start: number;
  /** chord tones (degrees) sounding at a step */
  chord: (s: number) => readonly number[];
  rest?: number;
  leap?: number;
  /** final note is pulled to this chord root */
  end?: number;
  /** strong-beat spacing in steps */
  strong?: number;
}

type Contour = 'arch' | 'rise' | 'fall' | 'valley' | 'wave';
const CONTOURS: readonly Contour[] = ['arch', 'arch', 'rise', 'fall', 'valley', 'wave'];
function contourAt(c: Contour, x: number): number {
  switch (c) {
    case 'arch':
      return Math.sin(Math.PI * x);
    case 'rise':
      return x;
    case 'fall':
      return 1 - x;
    case 'valley':
      return 1 - Math.sin(Math.PI * x);
    case 'wave':
      return 0.5 + 0.5 * Math.sin(2 * Math.PI * x);
  }
}

/**
 * Contour-guided motif: the line steers toward a randomly chosen melodic shape (arch, rise, fall,
 * valley, wave) with mostly stepwise motion, note repeats and occasional leaps; strong beats land on
 * chord tones and the last note can be pulled to a cadence tone.
 */
export function genMotif(r: Rng, len: number, o: MotifOpts): MNote[] {
  const out: MNote[] = [];
  const shape = pick(r, CONTOURS);
  const span = o.hi - o.lo;
  const want = (s: number) => o.lo + span * (0.1 + 0.8 * contourAt(shape, s / Math.max(1, len - 1)));
  let s = 0;
  let d = clamp(Math.round(want(0)), o.lo, o.hi);
  const strongEvery = o.strong ?? 8;
  while (s < len) {
    const cell = pick(r, o.cells);
    for (const l0 of cell) {
      if (s >= len) break;
      const l = Math.min(l0, len - s);
      const strong = s % strongEvery === 0;
      if (!strong && out.length && r() < (o.rest ?? 0.12)) {
        s += l;
        continue;
      }
      if (out.length) {
        const w = want(s);
        let step: number;
        const x = r();
        if (x < (o.leap ?? 0.15)) step = pick(r, [-3, 3, -4, 4, -2, 2]);
        else if (x < (o.leap ?? 0.15) + 0.14) step = 0;
        else step = pick(r, [1, 1, 1, 2]) * (Math.abs(w - d) < 0.6 ? pick(r, [-1, 1]) : Math.sign(w - d));
        d += step;
      }
      if (strong) d = nearestTone(d, o.chord(s));
      if (d < o.lo) d = o.lo + (o.lo - d);
      if (d > o.hi) d = o.hi - (d - o.hi);
      d = clamp(d, o.lo, o.hi);
      out.push({ s, l, d, v: strong ? 1 : 0.78 + r() * 0.14 });
      s += l;
    }
  }
  if (o.end !== undefined && out.length) {
    const n = out[out.length - 1];
    n.d = clamp(nearestTone(n.d, [o.end, o.end + 4]), o.lo, o.hi);
  }
  return out;
}

/** Variation of a motif: sequence (transpose), new ending, ornaments or rhythmic split. */
export function varyMotif(r: Rng, m: readonly MNote[], lo: number, hi: number): MNote[] {
  const v = m.map((n) => ({ ...n }));
  const op = r();
  if (op < 0.3) {
    const sh = pick(r, [-2, -1, 1, 2]);
    v.forEach((n) => (n.d = clamp(n.d + sh, lo, hi)));
  } else if (op < 0.55) {
    for (let i = Math.max(0, v.length - 2); i < v.length; i++) v[i].d = clamp(v[i].d + pick(r, [-2, -1, 1, 2]), lo, hi);
  } else if (op < 0.78) {
    v.forEach((n) => {
      if (n.l >= 3 && r() < 0.45) n.orn = pick(r, [1, -1]);
    });
  } else {
    const out: MNote[] = [];
    v.forEach((n) => {
      if (n.l >= 4 && n.l % 2 === 0 && r() < 0.4) {
        out.push({ ...n, l: n.l / 2 });
        out.push({ ...n, s: n.s + n.l / 2, l: n.l / 2, d: clamp(n.d + pick(r, [-1, 1]), lo, hi), v: n.v * 0.85, orn: undefined });
      } else out.push(n);
    });
    return out;
  }
  return v;
}

/** notes of a motif that start at a given step */
export const notesAt = (m: readonly MNote[], s: number): MNote[] => m.filter((n) => n.s === s);
