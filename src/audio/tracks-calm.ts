// Title, map, shop, victory and defeat tracks.

import { MODES, pick, type Key, type Rng } from './dsp';
import { BAR, bell, choir, pluck } from './voices';
import { Pad, frameDrum, gong, krotala, rimTek, tambourine } from './instruments';
import { Track, genMotif, nearestTone, notesAt, triad, varyMotif, type MNote } from './music';

/** Four-bar melodic period: A, A', B, cadence - regenerated every period, adapted to each bar's chord. */
class Phrases {
  private a: MNote[] = [];
  private b: MNote[] = [];
  cur: MNote[] = [];
  silent = false;
  constructor(
    private readonly len: number,
    private readonly cells: readonly (readonly number[])[],
    private readonly lo: number,
    private readonly hi: number,
    private readonly strong: number,
  ) {}
  bar(r: Rng, pb: number, chord: number, nextChord: number, silenceP: number): void {
    const opts = (end?: number) => ({
      cells: this.cells, lo: this.lo, hi: this.hi, start: pick(r, [this.lo + 2, this.lo + 4, this.hi - 2]),
      chord: () => triad(chord), strong: this.strong, end,
    });
    if (pb === 0) {
      this.silent = r() < silenceP;
      this.a = genMotif(r, this.len, opts());
      this.b = genMotif(r, this.len, opts());
    }
    const src = pb === 0 ? this.a : pb === 1 ? varyMotif(r, this.a, this.lo, this.hi) : pb === 2 ? this.b : genMotif(r, this.len, opts(nextChord));
    this.cur = src.map((n) => (n.s % this.strong === 0 ? { ...n, d: nearestTone(n.d, triad(chord)) } : n));
  }
}

export class TitleTrack extends Track {
  bpm = 60;
  key: Key = { root: 50, mode: MODES.dorian };
  level = 1.1;
  private pad!: Pad;
  private prog = [0, 6, 3, 0];

  protected setup(t: number): void {
    this.pad = new Pad(this.bus, t, [this.f(-7), this.f(-3)], { v: 0.1, cutoff: 650, a: 3, wet: 0.5, detune: 8 });
    this.held.push(this.pad);
  }

  protected onStep(s: number, t: number): void {
    const bar = Math.floor(s / 16);
    const pos = s % 16;
    const sd = this.stepDur;
    if (pos === 0 && bar % 2 === 0) {
      if (bar % 8 === 0) this.prog = pick(this.r, [[0, 6, 3, 0], [0, 3, 6, 4], [0, 2, 6, 0], [0, 4, 6, 3]]);
      const ch = this.prog[(bar / 2) % 4];
      this.pad.setFreqs([this.f(ch - 7), this.f(ch - 3)], t, 2.5);
      triad(ch).forEach((d, i) => {
        choir(this.bus, { t, f: this.f(d), vowel: 'o', v: 0.035, a: 2.5, h: 2.5, d: 2.8, wet: 0.7, pan: (i - 1) * 0.35 });
      });
    }
    const ch = this.prog[Math.floor(bar / 2) % 4];
    if (pos === 0 && bar % 4 === 0) frameDrum(this.bus, t, 0.16, { f: 70, dark: true, wet: 0.5 });
    if (pos === 0 && bar % 8 === 4) gong(this.bus, t, this.f(-7), 0.05, 4, { wet: 0.6 });
    if ((pos === 0 || pos === 8) && this.chance(pos === 0 ? 0.75 : 0.35)) {
      const n = 3 + Math.floor(this.r() * 3);
      const tones = [...triad(ch), ch + 7];
      let d = pick(this.r, [7, 9, 11]);
      let tt = t;
      for (let i = 0; i < n; i++) {
        d = nearestTone(d + (i ? 2 : 0), tones);
        pluck(this.bus, { t: tt, f: this.f(d), v: 0.22 + this.r() * 0.08, wet: 0.6, pan: -0.3 + i * 0.15 });
        tt += sd * pick(this.r, [1, 1, 2]);
      }
    }
    if (pos === 12 && this.chance(0.3)) {
      bell(this.bus, { t, f: this.f(pick(this.r, [14, 16, 18])), partials: BAR, v: 0.03, d: 1.5, wet: 0.7, pan: this.r() - 0.5 });
    }
  }
}

export class MapTrack extends Track {
  bpm = 132;
  stepsPerBeat = 2;
  stepsPerBar = 7;
  key: Key = { root: 57, mode: MODES.dorian };
  level = 1.1;
  private pad!: Pad;
  private prog = [0, 0, 3, 0];
  private mel = new Phrases(7, [[3, 2, 2], [2, 1, 2, 2], [3, 1, 1, 2], [1, 2, 2, 2], [3, 4], [2, 2, 3]], 4, 12, 7);

  protected setup(t: number): void {
    this.pad = new Pad(this.bus, t, [this.f(-7), this.f(-3)], { v: 0.07, cutoff: 900, a: 2, wet: 0.35 });
    this.held.push(this.pad);
  }

  protected onStep(s: number, t: number): void {
    const bar = Math.floor(s / 7);
    const pos = s % 7;
    const pb = bar % 4;
    if (pos === 0) {
      if (pb === 0) this.prog = pick(this.r, [[0, 0, 3, 0], [0, 6, 3, 0], [0, 3, 6, 4], [0, 2, 6, 0], [0, 4, 3, 0]]);
      this.mel.bar(this.r, pb, this.prog[pb], this.prog[(pb + 1) % 4], 0.25);
      this.pad.setFreqs([this.f(this.prog[pb] - 7), this.f(this.prog[pb] - 3)], t, 0.8);
      pluck(this.bus, { t, f: this.f(this.prog[pb] - 7), v: 0.24, damp: 1.0, wet: 0.2, pan: -0.2 });
    }
    const ch = this.prog[pb];
    if (pos === 0) frameDrum(this.bus, t, 0.28, { f: 84, wet: 0.15 });
    if (pos === 3 || pos === 5) rimTek(this.bus, t, 0.12, { wet: 0.15, pan: 0.25 });
    if (pb === 3 && pos === 5) frameDrum(this.bus, t, 0.16, { f: 84, wet: 0.15 });
    if ((pos === 2 || pos === 6) && this.chance(0.3)) rimTek(this.bus, t, 0.05, { pan: 0.3 });
    if (pos === 4) pluck(this.bus, { t, f: this.f(ch - 3), v: 0.12, damp: 0.5, wet: 0.2, pan: -0.25 });
    if (!this.mel.silent) {
      for (const n of notesAt(this.mel.cur, pos)) {
        pluck(this.bus, { t, f: this.f(n.d + 7), v: 0.3 * n.v, wet: 0.35, pan: 0.15, bright: n.v > 0.9 });
      }
    } else if (pos === 0 && this.chance(0.6)) {
      triad(ch).forEach((d, i) => pluck(this.bus, { t: t + i * this.stepDur, f: this.f(d + 7), v: 0.2, wet: 0.4, pan: 0.2 }));
    }
  }
}

export class ShopTrack extends Track {
  bpm = 112;
  swing8 = 0.3;
  key: Key = { root: 55, mode: MODES.mixolydian };
  level = 1.25;
  private pad!: Pad;
  private prog = [0, 6, 0, 3];
  private mel = new Phrases(16, [[2, 2, 4], [4, 2, 2], [2, 2, 2, 2], [6, 2], [3, 3, 2], [4, 4]], 6, 14, 8);

  protected setup(t: number): void {
    this.pad = new Pad(this.bus, t, [this.f(-7), this.f(-3)], { v: 0.045, cutoff: 1400, a: 1.5, wet: 0.3 });
    this.held.push(this.pad);
  }

  protected onStep(s: number, t: number): void {
    const bar = Math.floor(s / 16);
    const pos = s % 16;
    const pb = bar % 4;
    if (pos === 0) {
      if (pb === 0) this.prog = pick(this.r, [[0, 6, 0, 3], [0, 3, 6, 0], [0, 4, 6, 0], [0, 3, 4, 0]]);
      this.mel.bar(this.r, pb, this.prog[pb], this.prog[(pb + 1) % 4], 0.15);
      this.pad.setFreqs([this.f(this.prog[pb] - 7), this.f(this.prog[pb] - 3)], t, 0.4);
    }
    const ch = this.prog[pb];
    if (pos % 2 === 0) tambourine(this.bus, t, pos % 8 === 4 ? 0.085 : 0.045, { pan: 0.35, open: pos === 14 && this.chance(0.3) });
    if (pos === 4 || pos === 12) krotala(this.bus, t, 0.08, { pan: -0.3 });
    if (pos === 0) frameDrum(this.bus, t, 0.24, { f: 100 });
    if (pos === 10 || (pos === 7 && this.chance(0.4))) frameDrum(this.bus, t, 0.13, { f: 100 });
    if (pos === 0) pluck(this.bus, { t, f: this.f(ch - 7), v: 0.24, damp: 0.4, pan: -0.15 });
    if (pos === 8) pluck(this.bus, { t, f: this.f(ch - 3), v: 0.2, damp: 0.35, pan: -0.15 });
    if (pos === 4 || pos === 12) {
      [ch + 7, ch + 9, ch + 11].forEach((d, i) => pluck(this.bus, { t: t + i * 0.012, f: this.f(d), v: 0.09, damp: 0.2, pan: 0.1 }));
    }
    if (!this.mel.silent) {
      for (const n of notesAt(this.mel.cur, pos)) {
        pluck(this.bus, { t, f: this.f(n.d + 7), v: 0.28 * n.v, wet: 0.25, pan: 0.2, bright: true, damp: n.l * this.stepDur + 0.25 });
        if (n.orn) pluck(this.bus, { t: t + this.stepDur * 0.5, f: this.f(n.d + 7 + n.orn), v: 0.12, wet: 0.25, pan: 0.2, bright: true, damp: 0.2 });
      }
    }
  }
}

export class VictoryTrack extends Track {
  bpm = 84;
  key: Key = { root: 50, mode: MODES.ionian };
  level = 1.25;
  private pad!: Pad;
  private prog = [0, 3, 4, 0];
  private mel = new Phrases(16, [[8, 8], [4, 4, 8], [12, 4], [6, 2, 8]], 7, 14, 8);
  private arp = [0, 2, 4, 7, 4, 2, 4, 7];

  protected setup(t: number): void {
    this.pad = new Pad(this.bus, t, [this.f(-7), this.f(-3), this.f(-5)], { v: 0.06, cutoff: 1100, a: 2, wet: 0.4 });
    this.held.push(this.pad);
  }

  protected onStep(s: number, t: number): void {
    const bar = Math.floor(s / 16);
    const pos = s % 16;
    const pb = bar % 4;
    if (pos === 0) {
      if (pb === 0) {
        this.prog = pick(this.r, [[0, 3, 4, 0], [0, 5, 3, 4], [0, 3, 0, 4], [0, 1, 4, 0]]);
        this.arp = pick(this.r, [[0, 2, 4, 7, 4, 2, 4, 7], [0, 4, 7, 9, 7, 4, 2, 4], [7, 4, 2, 0, 2, 4, 7, 4]]);
      }
      this.mel.bar(this.r, pb, this.prog[pb], this.prog[(pb + 1) % 4], 0.2);
      const c = this.prog[pb];
      this.pad.setFreqs([this.f(c - 7), this.f(c - 3), this.f(c - 5)], t, 0.6);
    }
    const ch = this.prog[pb];
    if (pos % 2 === 0) pluck(this.bus, { t, f: this.f(ch + this.arp[pos / 2]), v: pos % 4 === 0 ? 0.17 : 0.13, wet: 0.35, pan: -0.25, damp: 0.6 });
    if (pos === 0) frameDrum(this.bus, t, 0.2, { f: 90, wet: 0.2 });
    if (pos === 8) frameDrum(this.bus, t, 0.13, { f: 90, wet: 0.2 });
    if (pos === 4 || pos === 12) tambourine(this.bus, t, 0.05, { pan: 0.3 });
    if (!this.mel.silent) {
      for (const n of notesAt(this.mel.cur, pos)) pluck(this.bus, { t, f: this.f(n.d + 7), v: 0.26 * n.v, wet: 0.45, pan: 0.2, bright: true });
    }
  }
}

export class DefeatTrack extends Track {
  bpm = 54;
  key: Key = { root: 45, mode: MODES.phrygian };
  level = 1.2;
  private pad!: Pad;
  private prog = [0, 1, 0, 6];
  private walker = 11;

  protected setup(t: number): void {
    this.pad = new Pad(this.bus, t, [this.f(0), this.f(4)], { v: 0.075, cutoff: 480, a: 2.5, wet: 0.45 });
    this.held.push(this.pad);
  }

  protected onStep(s: number, t: number): void {
    const bar = Math.floor(s / 16);
    const pos = s % 16;
    const pb = bar % 4;
    if (pos === 0) {
      if (pb === 0) this.prog = pick(this.r, [[0, 1, 0, 6], [0, 5, 1, 0], [0, 3, 1, 0], [0, 6, 5, 1]]);
      const c = this.prog[pb];
      this.pad.setFreqs([this.f(c), this.f(c + 4)], t, 1.5);
      if (bar % 8 === 4) {
        const m = genMotif(this.r, 32, { cells: [[8, 8], [4, 4, 8], [12, 4]], lo: 4, hi: 9, start: 8, chord: () => triad(c), end: 0, strong: 8 });
        this.aulosMotif(m, t, 7, 0.09, { drone: this.f(7), wet: 0.45, vib: 12, bright: 0.75 });
      }
    }
    if (pos === 0) frameDrum(this.bus, t, 0.22, { f: 62, dark: true, wet: 0.3 });
    if (pos === 2) frameDrum(this.bus, t, 0.13, { f: 60, dark: true, wet: 0.3 });
    if ((pos === 0 || pos === 8) && this.chance(0.55)) {
      this.walker = this.walker <= 5 ? pick(this.r, [11, 12, 9]) : this.walker - 1;
      pluck(this.bus, { t: t + 0.05, f: this.f(this.walker + 7), v: 0.18, wet: 0.5, pan: 0.2 });
    }
  }
}
