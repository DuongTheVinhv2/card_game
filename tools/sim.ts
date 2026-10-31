// Balance simulator: a greedy bot plays many full runs using the real game logic.
// Usage: npx tsx tools/sim.ts [runs=400] [verbose=0]
declare const process: { argv: string[] };
import { newRun, effectiveStats, healRun } from '../src/logic/run';
import { offerPatrons, choosePatron } from '../src/logic/patrons';
import {
  createBattle, startTurn, playHand, bossTurn, discardCards, canPlay, battleRewards, applyVictory, intentPreview,
} from '../src/logic/battle';
import type { BattleState } from '../src/logic/battle';
import { generateShop, buyItem, canBuy, rollGifts, sanctuaryOptions, rerollShop } from '../src/logic/shop';
import { addBoon, canAddBoon } from '../src/logic/run';
import { handRankIndex } from '../src/logic/hands';
import { LABOR_BY_ID } from '../src/logic/labors';
import type { Card } from '../src/logic/types';
import { RNG } from '../src/logic/rng';

const RUNS = Number(process.argv[2] || 400);
const VERBOSE = Number(process.argv[3] || 0);

function subsets(cards: Card[], maxK: number): Card[][] {
  const out: Card[][] = [];
  const n = cards.length;
  const rec = (start: number, cur: Card[]) => {
    if (cur.length > 0) out.push(cur.slice());
    if (cur.length === maxK) return;
    for (let i = start; i < n; i++) {
      cur.push(cards[i]);
      rec(i + 1, cur);
      cur.pop();
    }
  };
  rec(0, []);
  return out;
}

function bestPlay(b: BattleState): { ids: number[]; dmg: number; rank: number; value: number } {
  const st = effectiveStats(b.run);
  const missing = st.maxHp - b.run.hp;
  const incoming = intentPreview(b).total;
  let best = { ids: [] as number[], dmg: -1, rank: 0, value: -1 };
  for (const s of subsets(b.hand, 5)) {
    const ids = s.map((c) => c.id);
    if (!canPlay(b, ids).ok) continue;
    const r = playHand(b, ids, true);
    let value = r.damage;
    // value survival when it matters
    const lowHp = b.run.hp < st.maxHp * 0.45;
    value += Math.min(r.heal, missing) * (lowHp ? 6 : 1.5);
    value += Math.min(r.shield, Math.max(0, incoming - b.shield)) * (lowHp ? 6 : 2);
    if (r.damage >= b.boss.hp) value += 1e6;
    // prefer playing fewer cards at equal value (keep options)
    value -= s.length * 0.01;
    if (value > best.value) best = { ids, dmg: r.damage, rank: handRankIndex(r.handType), value };
  }
  return best;
}

function chooseDiscard(b: BattleState): number[] {
  const hand = b.hand;
  // flush draw?
  const byEl = new Map<string, Card[]>();
  for (const c of hand) byEl.set(c.element, [...(byEl.get(c.element) ?? []), c]);
  const bigEl = [...byEl.values()].sort((a, c) => c.length - a.length)[0];
  const byRank = new Map<number, Card[]>();
  for (const c of hand) byRank.set(c.rank, [...(byRank.get(c.rank) ?? []), c]);
  const keep = new Set<number>();
  if (bigEl.length >= 3) for (const c of bigEl) keep.add(c.id);
  else for (const g of byRank.values()) if (g.length >= 2) for (const c of g) keep.add(c.id);
  if (keep.size === 0) for (const c of hand.slice().sort((a, b2) => b2.rank - a.rank).slice(0, 2)) keep.add(c.id);
  const toss = hand.filter((c) => !keep.has(c.id)).sort((a, c) => a.rank - c.rank).slice(0, 5);
  return toss.map((c) => c.id);
}

interface BattleLog {
  labor: string;
  stage: number;
  won: boolean;
  turns: number;
  hpLost: number;
  maxHit: number;
}

function simBattle(run: ReturnType<typeof newRun>, idx: number): BattleLog {
  const b = createBattle(run, idx);
  startTurn(b);
  const hpStart = run.hp;
  let maxHit = 0;
  let guard = 0;
  while (!b.over && guard++ < 60) {
    // discard phase
    let tries = 0;
    while (b.discards > 0 && tries++ < 2) {
      const bp = bestPlay(b);
      const lethal = bp.dmg >= b.boss.hp;
      if (lethal || bp.rank >= handRankIndex('straight')) break;
      if (b.discards < 2 && bp.rank >= handRankIndex('twopair')) break;
      const ids = chooseDiscard(b);
      if (!ids.length) break;
      discardCards(b, ids);
    }
    const bp = bestPlay(b);
    const r = playHand(b, bp.ids);
    maxHit = Math.max(maxHit, r.damage);
    if (b.over) break;
    bossTurn(b);
    if (b.over) break;
    startTurn(b);
  }
  return {
    labor: b.boss.def.id,
    stage: run.labors[idx].stage,
    won: b.over === 'won',
    turns: b.turn,
    hpLost: hpStart - run.hp,
    maxHit,
  };
}

const stageStats = [0, 1, 2].map(() => ({ fights: 0, wins: 0, turns: 0, hpLost: 0, maxHit: 0 }));
const laborStats: Record<string, { fights: number; wins: number }> = {};
let runWins = 0;

for (let i = 0; i < RUNS; i++) {
  const seed = (i * 2654435761) >>> 0;
  const run = newRun(seed);
  const rng = new RNG(seed ^ 0xabcdef);
  const patrons = offerPatrons(run);
  choosePatron(run, rng.pick(patrons).id);
  let lost = false;
  for (const node of run.nodes) {
    if (node.kind === 'labor') {
      const idx = node.labor!;
      const b2 = simBattle(run, idx);
      const ss = stageStats[b2.stage];
      ss.fights++;
      ss.turns += b2.turns;
      ss.hpLost += b2.hpLost;
      ss.maxHit = Math.max(ss.maxHit, b2.maxHit);
      laborStats[b2.labor] ??= { fights: 0, wins: 0 };
      laborStats[b2.labor].fights++;
      if (!b2.won) {
        lost = true;
        if (VERBOSE) console.log(`run ${i} lost at stage ${b2.stage} vs ${b2.labor} after ${b2.turns} turns`);
        break;
      }
      ss.wins++;
      laborStats[b2.labor].wins++;
      // rewards
      const fake = createBattle(run, idx);
      const rw = battleRewards(fake);
      run.gold += rw.total;
      run.laborsDefeated++;
      healRun(run, rw.heal);
    } else if (node.kind === 'spoils') {
      const gifts = rollGifts(run);
      if (gifts.length && canAddBoon(run)) addBoon(run, rng.pick(gifts));
    } else if (node.kind === 'agora') {
      const shop = generateShop(run);
      for (let pass = 0; pass < 3; pass++) {
        const all = [...shop.items, ...shop.elixirs].filter((it) => canBuy(run, it).ok);
        all.sort((a, c) => (a.kind === 'boon' ? -1 : 0) - (c.kind === 'boon' ? -1 : 0));
        for (const it of all) if (canBuy(run, it).ok && (it.kind !== 'scroll')) buyItem(run, it);
        if (run.gold >= shop.rerollCost + 5 && pass < 2) rerollShop(run, shop);
      }
    } else if (node.kind === 'sanctuary') {
      const opts = sanctuaryOptions(run);
      const st = effectiveStats(run);
      const pick = run.hp < st.maxHp * 0.6 ? opts[0] : rng.pick(opts.slice(1));
      pick.apply(run);
    }
  }
  if (!lost) runWins++;
}

console.log(`\nRuns: ${RUNS}   full-run win rate: ${((runWins / RUNS) * 100).toFixed(1)}%`);
stageStats.forEach((s, i) => {
  if (!s.fights) return;
  console.log(
    `Stage ${i + 1}: fights ${s.fights}  win ${((s.wins / s.fights) * 100).toFixed(1)}%  avg turns ${(s.turns / s.fights).toFixed(2)}  avg HP lost ${(s.hpLost / s.fights).toFixed(1)}  max hit ${s.maxHit}`,
  );
});
console.log('\nPer labor win rate:');
for (const [k, v] of Object.entries(laborStats).sort((a, b) => LABOR_BY_ID[a[0] as keyof typeof LABOR_BY_ID].index - LABOR_BY_ID[b[0] as keyof typeof LABOR_BY_ID].index)) {
  console.log(`  ${k.padEnd(10)} ${((v.wins / v.fights) * 100).toFixed(1)}%  (${v.fights})`);
}
