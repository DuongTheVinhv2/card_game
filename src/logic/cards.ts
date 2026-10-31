import type { Card, Element, Enhancement, Rank } from './types';
import { ELEMENTS, RANKS, RANK_NAME } from './types';
import { ELEMENT_INFO } from './elements';

export interface EnhInfo {
  name: string;
  desc: string;
}

export const ENH_INFO: Record<Enhancement, EnhInfo> = {
  none: { name: 'Plain', desc: '' },
  bronze: { name: 'Bronze', desc: '+15 Power' },
  divine: { name: 'Divine', desc: '+4 Mult when scored' },
  olympian: { name: 'Olympian', desc: '×1.5 Mult when scored' },
  gilded: { name: 'Gilded', desc: '+3 Drachmae when scored' },
  marble: { name: 'Marble', desc: '×1.5 Mult while held in hand' },
  crystal: { name: 'Crystal', desc: '×2 Mult when scored · 1 in 4 chance to shatter' },
};

export const BRONZE_BONUS = 15;

/** Card power grows with rank: 2..10, J=11, Q=12, K=13, A=14 (+ enhancements). */
export function cardPower(c: Card): number {
  return c.rank + (c.enh === 'bronze' ? BRONZE_BONUS : 0);
}

export function cardName(c: Card): string {
  return `${RANK_NAME[c.rank]} of ${ELEMENT_INFO[c.element].name}`;
}

export function createStandardDeck(nextId: () => number): Card[] {
  const deck: Card[] = [];
  for (const element of ELEMENTS) {
    for (const rank of RANKS) deck.push({ id: nextId(), rank, element, enh: 'none' });
  }
  return deck;
}

export function cloneCard(c: Card): Card {
  return { id: c.id, rank: c.rank, element: c.element, enh: c.enh };
}

export function bumpRank(r: Rank): Rank {
  return (r >= 14 ? 2 : r + 1) as Rank;
}

export function elementCounts(cards: Card[]): Record<Element, number> {
  const out: Record<Element, number> = { fire: 0, water: 0, wind: 0, earth: 0 };
  for (const c of cards) out[c.element]++;
  return out;
}

export function sortCards(cards: Card[], mode: 'rank' | 'element'): Card[] {
  const elIndex = (e: Element) => ELEMENTS.indexOf(e);
  return cards.slice().sort((a, b) =>
    mode === 'rank'
      ? b.rank - a.rank || elIndex(a.element) - elIndex(b.element)
      : elIndex(a.element) - elIndex(b.element) || b.rank - a.rank,
  );
}
