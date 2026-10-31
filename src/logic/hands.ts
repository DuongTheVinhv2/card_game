import type { Card, HandType } from './types';
import { ELEMENTS, HAND_ORDER } from './types';

export interface HandInfo {
  name: string;
  power: number;
  mult: number;
  lvPower: number;
  lvMult: number;
  constellation: string;
  desc: string;
}

/** Base Power × Mult per poker hand. Multipliers strictly increase with the hand's strength. */
export const HAND_INFO: Record<HandType, HandInfo> = {
  high: { name: 'High Card', power: 5, mult: 1, lvPower: 10, lvMult: 1, constellation: 'Monoceros', desc: 'Only your highest card scores.' },
  pair: { name: 'Pair', power: 10, mult: 2, lvPower: 15, lvMult: 1, constellation: 'Gemini', desc: 'Two cards of the same rank.' },
  twopair: { name: 'Two Pair', power: 20, mult: 3, lvPower: 20, lvMult: 1, constellation: 'Pisces', desc: 'Two different pairs.' },
  three: { name: 'Three of a Kind', power: 30, mult: 4, lvPower: 20, lvMult: 2, constellation: 'Triangulum', desc: 'Three cards of the same rank.' },
  straight: { name: 'Straight', power: 30, mult: 5, lvPower: 30, lvMult: 2, constellation: 'Sagitta', desc: 'Five cards in consecutive rank.' },
  flush: { name: 'Flush', power: 35, mult: 6, lvPower: 15, lvMult: 2, constellation: 'Aquarius', desc: 'Five cards of the same element.' },
  fullhouse: { name: 'Full House', power: 40, mult: 7, lvPower: 25, lvMult: 2, constellation: 'Pleiades', desc: 'Three of a kind plus a pair.' },
  four: { name: 'Four of a Kind', power: 60, mult: 9, lvPower: 30, lvMult: 3, constellation: 'Crux', desc: 'Four cards of the same rank.' },
  straightflush: { name: 'Straight Flush', power: 100, mult: 12, lvPower: 40, lvMult: 4, constellation: 'Draco', desc: 'A straight of a single element.' },
  royal: { name: 'Royal Flush', power: 120, mult: 16, lvPower: 50, lvMult: 5, constellation: 'Corona Borealis', desc: '10 J Q K A of a single element.' },
};

export function handBase(type: HandType, level: number): { power: number; mult: number } {
  const h = HAND_INFO[type];
  const l = Math.max(1, level) - 1;
  return { power: h.power + h.lvPower * l, mult: h.mult + h.lvMult * l };
}

export function handRankIndex(t: HandType): number {
  return HAND_ORDER.indexOf(t);
}

/** "contains" semantics (Balatro style): a Full House contains a Pair and Three of a Kind, etc. */
export function handContains(type: HandType, part: 'pair' | 'twopair' | 'three' | 'straight' | 'flush'): boolean {
  switch (part) {
    case 'pair':
      return type === 'pair' || type === 'twopair' || type === 'three' || type === 'fullhouse' || type === 'four';
    case 'twopair':
      return type === 'twopair' || type === 'fullhouse';
    case 'three':
      return type === 'three' || type === 'fullhouse' || type === 'four';
    case 'straight':
      return type === 'straight' || type === 'straightflush' || type === 'royal';
    case 'flush':
      return type === 'flush' || type === 'straightflush' || type === 'royal';
  }
}

export interface HandRules {
  /** Ariadne's Thread: straights & flushes can be made with 4 cards */
  fourCard: boolean;
}

export interface HandEval {
  type: HandType;
  /** scoring cards, in played order */
  scoring: Card[];
}

function findStraight(cards: Card[], need: number): Card[] | null {
  const byRank = new Map<number, Card>();
  for (const c of cards) if (!byRank.has(c.rank)) byRank.set(c.rank, c);
  for (let top = 14; top >= need; top--) {
    const run: Card[] = [];
    for (let r = top; r > top - need; r--) {
      const c = byRank.get(r === 1 ? 14 : r);
      if (!c) break;
      run.push(c);
    }
    if (run.length === need) return run;
  }
  return null;
}

function findFlush(cards: Card[], need: number): Card[] | null {
  let best: Card[] | null = null;
  for (const el of ELEMENTS) {
    const cs = cards.filter((c) => c.element === el);
    if (cs.length >= need && (!best || cs.length > best.length)) best = cs;
  }
  return best;
}

/** Evaluate up to 5 played cards. */
export function evaluateHand(cards: Card[], rules: HandRules = { fourCard: false }): HandEval | null {
  if (cards.length === 0) return null;
  const order = new Map<number, number>();
  cards.forEach((c, i) => order.set(c.id, i));
  const inOrder = (cs: Card[]) => cs.slice().sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  const needs = rules.fourCard ? [5, 4] : [5];

  // straight flush / royal
  for (const need of needs) {
    const fl = findFlush(cards, need);
    if (fl) {
      const sf = findStraight(fl, need);
      if (sf) {
        const ranks = sf.map((c) => c.rank);
        const royal = Math.max(...ranks) === 14 && Math.min(...ranks) >= 10;
        return { type: royal ? 'royal' : 'straightflush', scoring: inOrder(sf) };
      }
    }
  }

  const groups = new Map<number, Card[]>();
  for (const c of cards) {
    const g = groups.get(c.rank);
    if (g) g.push(c);
    else groups.set(c.rank, [c]);
  }
  const gs = [...groups.values()].sort((a, b) => b.length - a.length || b[0].rank - a[0].rank);

  if (gs[0].length >= 4) return { type: 'four', scoring: inOrder(gs[0].slice(0, 4)) };
  if (gs[0].length === 3 && gs[1] && gs[1].length >= 2) {
    return { type: 'fullhouse', scoring: inOrder([...gs[0], ...gs[1].slice(0, 2)]) };
  }

  for (const need of needs) {
    const fl = findFlush(cards, need);
    if (fl) return { type: 'flush', scoring: inOrder(fl) };
  }
  for (const need of needs) {
    const st = findStraight(cards, need);
    if (st) return { type: 'straight', scoring: inOrder(st) };
  }
  if (gs[0].length === 3) return { type: 'three', scoring: inOrder(gs[0]) };
  if (gs[0].length === 2 && gs[1] && gs[1].length === 2) return { type: 'twopair', scoring: inOrder([...gs[0], ...gs[1]]) };
  if (gs[0].length === 2) return { type: 'pair', scoring: inOrder(gs[0]) };
  const high = cards.reduce((a, b) => (b.rank > a.rank ? b : a));
  return { type: 'high', scoring: [high] };
}
