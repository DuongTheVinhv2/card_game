import type { Card, HandType } from './types';
import { HAND_ORDER } from './types';
import { createStandardDeck } from './cards';
import type { LaborInstance } from './labors';
import { generateLabors } from './labors';
import type { BoonInst } from './boons';
import { BOON_BY_ID, MAX_BOONS } from './boons';
import type { ScrollId } from './scrolls';
import { MAX_CONSUMABLES } from './scrolls';
import { RNG } from './rng';
import { weaponDef, type WeaponId } from './weapons';

export interface BaseStats {
  maxHp: number;
  atk: number;
  def: number;
  handSize: number;
  /** discards available at the start of each battle */
  discards: number;
  /** cap for discard regeneration */
  maxDiscards: number;
}

export interface EffectiveStats extends BaseStats {
  /** fraction of enemy DEF ignored by every hand (Sickle of Kronos) */
  pierce: number;
}

export const BASE_STATS: BaseStats = { maxHp: 100, atk: 10, def: 4, handSize: 8, discards: 3, maxDiscards: 5 };
export const START_GOLD = 4;

export type NodeKind = 'labor' | 'spoils' | 'agora' | 'sanctuary' | 'apotheosis';
export interface MapNode {
  kind: NodeKind;
  /** index into run.labors for labor nodes */
  labor?: number;
}

export interface RunStats {
  handsPlayed: number;
  damageDealt: number;
  bestHit: number;
  bestHitHand: HandType | null;
  cardsDiscarded: number;
  turns: number;
  damageTaken: number;
  healed: number;
  goldEarned: number;
}

export interface RunMods {
  /** fraction of max HP restored after each victory */
  healAfter: number;
  /** flat discount on Agora prices */
  discount: number;
}

export interface RunState {
  weapon?: WeaponId;
  version: 1;
  seed: number;
  rngState: number;
  patron: string | null;
  base: BaseStats;
  hp: number;
  deck: Card[];
  nextId: number;
  boons: BoonInst[];
  nextUid: number;
  consumables: ScrollId[];
  handLevels: Record<HandType, number>;
  handPlays: Record<HandType, number>;
  gold: number;
  labors: LaborInstance[];
  laborsDefeated: number;
  nodes: MapNode[];
  nodeIndex: number;
  stats: RunStats;
  mods: RunMods;
  endless: boolean;
  startedAt: number;
}

export function buildNodes(laborCount: number): MapNode[] {
  const nodes: MapNode[] = [];
  for (let i = 0; i < laborCount; i++) {
    nodes.push({ kind: 'labor', labor: i });
    if (i < laborCount - 1) {
      nodes.push({ kind: 'spoils' }, { kind: 'agora' }, { kind: 'sanctuary' });
    }
  }
  nodes.push({ kind: 'apotheosis' });
  return nodes;
}

function zeroHands(v: number): Record<HandType, number> {
  return Object.fromEntries(HAND_ORDER.map((h) => [h, v])) as Record<HandType, number>;
}

export function newRun(seed: number): RunState {
  const rng = new RNG(seed);
  let id = 1;
  const deck = createStandardDeck(() => id++);
  const labors = generateLabors(rng, 3);
  return {
    version: 1,
    seed,
    rngState: rng.s,
    patron: null,
    base: { ...BASE_STATS },
    hp: BASE_STATS.maxHp,
    deck,
    nextId: id,
    boons: [],
    nextUid: 1,
    consumables: [],
    handLevels: zeroHands(1),
    handPlays: zeroHands(0),
    gold: START_GOLD,
    labors,
    laborsDefeated: 0,
    nodes: buildNodes(labors.length),
    nodeIndex: 0,
    stats: {
      handsPlayed: 0, damageDealt: 0, bestHit: 0, bestHitHand: null, cardsDiscarded: 0,
      turns: 0, damageTaken: 0, healed: 0, goldEarned: 0,
    },
    mods: { healAfter: 0.3, discount: 0 },
    endless: false,
    startedAt: Date.now(),
  };
}

/** Use (and persist) the run-level RNG stream. */
export function runRng(run: RunState): RNG {
  const r = new RNG(1);
  r.s = run.rngState;
  return r;
}
export function saveRng(run: RunState, rng: RNG): void {
  run.rngState = rng.s;
}

export function effectiveStats(run: RunState): EffectiveStats {
  const s: EffectiveStats = { ...run.base, pierce: 0 };
  const weapon = weaponDef(run.weapon);
  s.atk += weapon.atk;
  s.def = Math.max(0, s.def + weapon.def);
  if (weapon.id === 'bow') s.pierce += 0.2;
  for (const inst of run.boons) {
    const st = BOON_BY_ID[inst.id]?.stats;
    if (!st) continue;
    s.maxHp += st.maxHp ?? 0;
    s.atk += st.atk ?? 0;
    s.def += st.def ?? 0;
    s.handSize += st.handSize ?? 0;
    s.discards += st.discards ?? 0;
    s.maxDiscards += st.maxDiscards ?? 0;
    s.pierce += st.pierce ?? 0;
  }
  s.maxHp = Math.max(10, s.maxHp);
  s.handSize = Math.max(5, s.handSize);
  s.discards = Math.max(0, s.discards);
  s.maxDiscards = Math.max(s.discards, s.maxDiscards);
  s.pierce = Math.min(1, s.pierce);
  return s;
}

export function hasFourCardRule(run: RunState): boolean {
  return run.boons.some((b) => BOON_BY_ID[b.id]?.fourCard);
}

export function hasBoon(run: RunState, id: string): boolean {
  return run.boons.some((b) => b.id === id);
}

export function canAddBoon(run: RunState): boolean {
  return run.boons.length < MAX_BOONS;
}

export function addBoon(run: RunState, id: string): BoonInst | null {
  if (!canAddBoon(run)) return null;
  const before = effectiveStats(run).maxHp;
  const inst: BoonInst = { id, uid: run.nextUid++, counter: 0 };
  run.boons.push(inst);
  const after = effectiveStats(run).maxHp;
  if (after > before) run.hp += after - before;
  clampHp(run);
  return inst;
}

export function boonSellValue(inst: BoonInst): number {
  const d = BOON_BY_ID[inst.id];
  return Math.max(1, Math.floor((d?.price ?? 2) / 2));
}

export function removeBoon(run: RunState, uid: number): BoonInst | null {
  const i = run.boons.findIndex((b) => b.uid === uid);
  if (i < 0) return null;
  const [inst] = run.boons.splice(i, 1);
  clampHp(run);
  return inst;
}

export function clampHp(run: RunState): void {
  const max = effectiveStats(run).maxHp;
  run.hp = Math.max(0, Math.min(max, Math.round(run.hp)));
}

export function healRun(run: RunState, amount: number): number {
  const max = effectiveStats(run).maxHp;
  const before = run.hp;
  run.hp = Math.min(max, run.hp + Math.max(0, Math.round(amount)));
  const healed = run.hp - before;
  run.stats.healed += healed;
  return healed;
}

export function canAddConsumable(run: RunState): boolean {
  return run.consumables.length < MAX_CONSUMABLES;
}

export function currentNode(run: RunState): MapNode | undefined {
  return run.nodes[run.nodeIndex];
}

/** The labor index that the run is currently heading towards. */
export function nextLaborIndex(run: RunState): number {
  for (let i = run.nodeIndex; i < run.nodes.length; i++) {
    const n = run.nodes[i];
    if (n.kind === 'labor' && n.labor !== undefined) return n.labor;
  }
  return run.labors.length - 1;
}

export function mostPlayedHand(run: RunState): HandType {
  let best: HandType = 'pair';
  let n = -1;
  for (const h of HAND_ORDER) {
    if (run.handPlays[h] > n) {
      n = run.handPlays[h];
      best = h;
    }
  }
  return best;
}

const SAVE_KEY = 'dodek.run.v1';

export function saveRun(run: RunState | null): void {
  try {
    if (!run) localStorage.removeItem(SAVE_KEY);
    else localStorage.setItem(SAVE_KEY, JSON.stringify(run));
  } catch {
    /* storage unavailable */
  }
}

export function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const run = JSON.parse(raw) as RunState;
    if (run.version !== 1 || !run.deck || !run.nodes) return null;
    return run;
  } catch {
    return null;
  }
}
