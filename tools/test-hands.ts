import { evaluateHand } from '../src/logic/hands';
import type { Card, Rank, Element } from '../src/logic/types';
let id = 1;
const c = (r: Rank, e: Element = 'fire'): Card => ({ id: id++, rank: r, element: e, enh: 'none' });
const cases: Array<[string, Card[], string, number, boolean?]> = [
  ['high', [c(2), c(5, 'water'), c(9, 'wind'), c(11, 'earth'), c(13, 'water')], 'high', 1],
  ['pair', [c(5), c(5, 'water'), c(9, 'wind')], 'pair', 2],
  ['twopair', [c(5), c(5, 'water'), c(9, 'wind'), c(9), c(2, 'earth')], 'twopair', 4],
  ['three', [c(7), c(7, 'water'), c(7, 'wind'), c(2)], 'three', 3],
  ['straight', [c(5), c(6, 'water'), c(7, 'wind'), c(8), c(9, 'earth')], 'straight', 5],
  ['wheel', [c(14), c(2, 'water'), c(3, 'wind'), c(4), c(5, 'earth')], 'straight', 5],
  ['flush', [c(2), c(6), c(9), c(11), c(4)], 'flush', 5],
  ['fullhouse', [c(3), c(3, 'water'), c(3, 'wind'), c(8), c(8, 'earth')], 'fullhouse', 5],
  ['four', [c(12), c(12, 'water'), c(12, 'wind'), c(12, 'earth'), c(2)], 'four', 4],
  ['sf', [c(5, 'wind'), c(6, 'wind'), c(7, 'wind'), c(8, 'wind'), c(9, 'wind')], 'straightflush', 5],
  ['royal', [c(10, 'earth'), c(11, 'earth'), c(12, 'earth'), c(13, 'earth'), c(14, 'earth')], 'royal', 5],
  ['4-flush (no rule)', [c(2), c(6), c(9), c(11), c(4, 'water')], 'high', 1],
  ['4-flush (ariadne)', [c(2), c(6), c(9), c(11), c(4, 'water')], 'flush', 4, true],
  ['4-straight (ariadne)', [c(5), c(6, 'water'), c(7, 'wind'), c(8), c(13, 'earth')], 'straight', 4, true],
];
let fail = 0;
for (const [name, cards, want, n, four] of cases) {
  const ev = evaluateHand(cards, { fourCard: !!four })!;
  const ok = ev.type === want && ev.scoring.length === n;
  if (!ok) fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(22)} -> ${ev.type} (${ev.scoring.length} scoring)`);
}
console.log(fail ? `${fail} failures` : 'all passed');
