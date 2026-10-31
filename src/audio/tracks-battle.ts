// Battle and boss tracks: driving frame drums, lyre ostinati, aulos phrases; setIntensity() adds layers.

import { MODES, pick, type Key } from './dsp';
import { BAR, bell, choir, pluck } from './voices';
import { Pad, boom, frameDrum, krotala, rimTek, subPulse, tambourine } from './instruments';
import { Track, genMotif, notesAt, triad, type MNote } from './music';

const AULOS_CELLS = [[4, 4, 8], [8, 8], [6, 2, 8], [4, 2, 2, 8], [2, 2, 4, 8], [3, 1, 4, 8], [4, 2, 2, 4, 4], [6, 2, 4, 4]] as const;
const LYRE_CELLS = [[2, 2, 4], [4, 4], [2, 2, 2, 2], [6, 2], [4, 2, 2], [3, 3, 2], [2, 1, 1, 4]] as const;

export class BattleTrack extends Track {
  bpm = 104;
  key: Key = { root: 50, mode: MODES.dorian };
  level = 1.05;
  private pad!: Pad;
  private prog = [0, 6, 3, 0];
  private ost = [0, 4, 7, 4, 9, 7, 4, 2];
  private call: MNote[] = [];
  private fill = false;

  protected setup(t: number): void {
    this.pad = new Pad(this.bus, t, [this.f(-7), this.f(-3)], { v: 0.07, cutoff: 500, a: 1.2, wet: 0.25 });
    this.held.push(this.pad);
  }

  protected onStep(s: number, t: number): void {
    const I = this.intensity;
    const bar = Math.floor(s / 16);
    const pos = s % 16;
    const pb = bar % 4;
    if (pos === 0) {
      if (pb === 0) {
        this.prog = pick(this.r, [[0, 6, 3, 0], [0, 2, 6, 0], [0, 0, 6, 4], [0, 3, 6, 4], [0, 6, 0, 3]]);
        this.ost = pick(this.r, [[0, 4, 7, 4, 9, 7, 4, 2], [0, 2, 4, 7, 4, 2, 0, 2], [0, 7, 4, 7, 2, 7, 4, 7], [7, 4, 2, 0, 2, 4, 7, 9]]);
        this.fill = this.chance(0.5 + I * 0.4);
        if (I > 0.85) boom(this.bus, t, 0.3, { f0: 90, f1: 36, d: 0.9, wet: 0.15 });
      }
      const c = this.prog[pb];
      this.pad.setFreqs([this.f(c - 7), this.f(c - 3)], t, 0.3);
      this.pad.setCutoff(450 + 1500 * I, t, 0.4);
      this.call = [];
      if (pb % 2 === 0) {
        const chordAt = (x: number) => triad(this.prog[(pb + Math.floor(x / 16)) % 4]);
        if (I > 0.15 && this.chance(0.2 + 0.6 * I)) {
          const m = genMotif(this.r, 32, { cells: AULOS_CELLS, lo: 5, hi: 14, start: 9, chord: chordAt, end: this.prog[(pb + 2) % 4], rest: 0.1 });
          this.aulosMotif(m, t, 0, 0.1 + 0.04 * I, { drone: this.f(7), wet: 0.3, pan: -0.15, vib: 18, bright: 0.85 + 0.3 * I });
        } else if (this.chance(0.6)) {
          this.call = genMotif(this.r, 16, { cells: LYRE_CELLS, lo: 9, hi: 16, start: 11, chord: chordAt, rest: 0.2 });
        }
      }
    }
    const ch = this.prog[pb];
    // drums
    const dums: Record<number, number> = { 0: 0.36, 6: 0.2, 8: 0.3 };
    if (I > 0.5) dums[10] = 0.14;
    if (I > 0.65) {
      dums[3] = 0.17;
      dums[11] = 0.17;
    }
    const teks: Record<number, number> = { 4: 0.2, 12: 0.22, 14: 0.1 };
    if (this.fill && pb === 3 && pos >= 12) {
      if (pos % 2 === 0) frameDrum(this.bus, t, 0.2 + (pos - 12) * 0.04, { f: 96 + (pos - 12) * 6, wet: 0.12 });
      else rimTek(this.bus, t, 0.12 + (pos - 12) * 0.03, { pan: 0.2 });
    } else {
      if (dums[pos]) frameDrum(this.bus, t, dums[pos] * (0.85 + 0.3 * I), { f: 92, wet: 0.1 });
      if (teks[pos]) rimTek(this.bus, t, teks[pos], { wet: 0.1, pan: 0.2 });
    }
    if (I >= 0.25 && pos % 2 === 0) tambourine(this.bus, t, (pos % 8 === 4 ? 0.07 : 0.04) * (0.7 + 0.6 * I), { pan: 0.35 });
    if (I >= 0.8 && pos % 2 === 1) tambourine(this.bus, t, 0.03, { pan: 0.4 });
    if (I >= 0.65 && pos % 4 === 2) krotala(this.bus, t, 0.07, { pan: -0.35 });
    if (I >= 0.45 && (pos === 0 || pos === 8 || (I > 0.75 && pos % 4 === 0))) subPulse(this.bus, t, this.f(ch - 7), 0.2, 0.3);
    // lyre ostinato (8ths; 16th octave shimmer when intense)
    if (pos % 2 === 0) {
      const d = ch + 7 + this.ost[pos / 2];
      pluck(this.bus, { t, f: this.f(d), v: (pos % 4 === 0 ? 0.2 : 0.15) * (0.8 + 0.4 * I), damp: 0.16, bright: I > 0.5, pan: 0.2, wet: 0.12 });
    } else if (I >= 0.45) {
      const d = ch + 14 + this.ost[(pos - 1) / 2];
      pluck(this.bus, { t, f: this.f(d), v: 0.07 + 0.04 * I, damp: 0.1, bright: true, pan: 0.35, wet: 0.12 });
    }
    for (const n of notesAt(this.call, pos)) {
      pluck(this.bus, { t, f: this.f(n.d + 7), v: 0.24 * n.v, bright: true, pan: -0.25, wet: 0.3 });
    }
  }
}

export class BossTrack extends Track {
  bpm = 96;
  key: Key = { root: 52, mode: MODES.phrygianDom };
  level = 0.72;
  private pad!: Pad;
  private prog = [0, 0, 1, 0];
  private riff = [0, 1, 0, 2, 0, 1, -1, 0];

  protected setup(t: number): void {
    this.pad = new Pad(this.bus, t, [this.f(-14), this.f(-10), this.f(-7)], { v: 0.1, cutoff: 260, a: 1.5, wet: 0.3, detune: 12, q: 3 });
    this.held.push(this.pad);
  }

  protected onStep(s: number, t: number): void {
    const I = this.intensity;
    const bar = Math.floor(s / 16);
    const pos = s % 16;
    const pb = bar % 4;
    if (pos === 0) {
      if (pb === 0) {
        this.prog = pick(this.r, [[0, 0, 1, 0], [0, 1, 6, 0], [0, 3, 1, 0], [0, 6, 1, 0]]);
        this.riff = pick(this.r, [[0, 1, 0, 2, 0, 1, -1, 0], [0, 0, 1, 0, 2, 1, 0, -1], [0, 4, 3, 2, 1, 0, 1, 2], [0, 1, 2, 1, 0, -1, -2, -1]]);
        if (I >= 0.4) {
          triad(this.prog[0]).forEach((d, i) => choir(this.bus, { t, f: this.f(d), vowel: 'o', v: 0.03 + 0.02 * I, a: 1.6, h: 2.5, d: 2, wet: 0.5, pan: (i - 1) * 0.3 }));
        }
      }
      const c = this.prog[pb];
      this.pad.setFreqs([this.f(c - 14), this.f(c - 10), this.f(c - 7)], t, 0.5);
      this.pad.setCutoff(260 + 900 * I, t, 0.5);
      if (pb % 2 === 0 && I > 0.15 && this.chance(0.2 + 0.6 * I)) {
        const chordAt = (x: number) => triad(this.prog[(pb + Math.floor(x / 16)) % 4]);
        const m = genMotif(this.r, 32, { cells: AULOS_CELLS, lo: 5, hi: 13, start: 8, chord: chordAt, end: 0, rest: 0.08, leap: 0.22 });
        m.forEach((n) => {
          if (n.l >= 4 && this.chance(0.5)) n.orn = pick(this.r, [1, -1]);
        });
        this.aulosMotif(m, t, 0, 0.11 + 0.04 * I, { drone: this.f(7), wet: 0.35, pan: 0.15, vib: 24, bright: 0.8 + 0.35 * I });
      }
      if (I >= 0.85) boom(this.bus, t, 0.22, { f0: 80, f1: 30, d: 0.8, wet: 0.15 });
    }
    const ch = this.prog[pb];
    const dums: Record<number, number> = { 0: 0.42, 3: 0.26, 8: 0.36 };
    if (I > 0.3) dums[11] = 0.2;
    if (I >= 0.55) {
      dums[6] = 0.16;
      dums[14] = 0.16;
    }
    if (dums[pos]) frameDrum(this.bus, t, dums[pos] * (0.85 + 0.3 * I), { f: 64, dark: true, wet: 0.12 });
    if (pos === 4 || pos === 12) rimTek(this.bus, t, 0.2, { wet: 0.12, pan: -0.2 });
    if (pos === 0 || pos === 8 || (I >= 0.75 && pos % 4 === 0)) subPulse(this.bus, t, this.f(ch - 14), 0.26, 0.35);
    if (I >= 0.35 && pos % 2 === 0) tambourine(this.bus, t, 0.04 + 0.04 * I, { pan: 0.35 });
    if (I >= 0.75 && pos % 2 === 1) tambourine(this.bus, t, 0.03, { pan: 0.4 });
    if (I >= 0.55 && pos % 4 === 2) krotala(this.bus, t, 0.08, { pan: -0.35 });
    if (pos % 2 === 0) {
      const d = ch + this.riff[pos / 2];
      pluck(this.bus, { t, f: this.f(d), v: (pos % 4 === 0 ? 0.24 : 0.18) * (0.8 + 0.4 * I), damp: 0.14, bright: I > 0.6, pan: 0.15, wet: 0.1 });
    }
    if (pos === 15 && pb === 3 && this.chance(0.5)) {
      bell(this.bus, { t, f: this.f(pick(this.r, [8, 10, 11])), partials: BAR, v: 0.04, d: 1.2, wet: 0.5 });
    }
  }
}
