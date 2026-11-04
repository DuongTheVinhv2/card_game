import { genMotif, varyMotif, triad } from '../../src/audio/music';
import { mulberry32, MODES, degMidi } from '../../src/audio/dsp';
const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const nm = (m: number) => NAMES[m % 12] + (Math.floor(m / 12) - 1);
const r = mulberry32(5);
const key = { root: 50, mode: MODES.dorian };
const prog = [0, 6, 3, 0];
for (let p = 0; p < 3; p++) {
  const m = genMotif(r, 32, { cells: [[4, 4, 8], [8, 8], [6, 2, 8], [4, 2, 2, 8]], lo: 5, hi: 14, start: 9, chord: (x) => triad(prog[Math.floor(x / 16)]), end: prog[2], rest: 0.1 });
  console.log('aulos', m.map((n) => `${n.s}:${nm(degMidi(key, n.d))}x${n.l}`).join(' '));
  const v = varyMotif(r, m, 5, 14);
  console.log(' vary', v.map((n) => `${n.s}:${nm(degMidi(key, n.d))}x${n.l}${n.orn ? '~' : ''}`).join(' '));
}
const bk = { root: 52, mode: MODES.phrygianDom };
console.log('boss scale', [0, 1, 2, 3, 4, 5, 6, 7].map((d) => nm(degMidi(bk, d))).join(' '));
