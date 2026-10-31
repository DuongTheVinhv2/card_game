// Core shared types for DODEKATHLOS.

export type Element = 'fire' | 'water' | 'wind' | 'earth';
export const ELEMENTS: Element[] = ['fire', 'water', 'wind', 'earth'];

/** 2..10 face value, 11 = J, 12 = Q, 13 = K, 14 = A */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
export const RANKS: Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
export const RANK_LABEL: Record<Rank, string> = {
  2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9', 10: '10',
  11: 'J', 12: 'Q', 13: 'K', 14: 'A',
};
export const RANK_NAME: Record<Rank, string> = {
  2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine', 10: 'Ten',
  11: 'Hoplite', 12: 'Queen', 13: 'King', 14: 'Ace',
};

/** Persistent card modifications. */
export type Enhancement = 'none' | 'bronze' | 'divine' | 'olympian' | 'gilded' | 'marble' | 'crystal';

export interface Card {
  id: number;
  rank: Rank;
  element: Element;
  enh: Enhancement;
}

export type HandType =
  | 'high' | 'pair' | 'twopair' | 'three' | 'straight' | 'flush'
  | 'fullhouse' | 'four' | 'straightflush' | 'royal';

export const HAND_ORDER: HandType[] = [
  'high', 'pair', 'twopair', 'three', 'straight', 'flush', 'fullhouse', 'four', 'straightflush', 'royal',
];

/** The twelve labors (+ the hero, used for title / victory art). */
export type CreatureId =
  | 'lion' | 'hydra' | 'hind' | 'boar' | 'stables' | 'birds'
  | 'bull' | 'mares' | 'hippolyta' | 'geryon' | 'ladon' | 'cerberus'
  | 'heracles';

export type IntentKind = 'strike' | 'heavy' | 'volley' | 'guard' | 'roar' | 'drain' | 'curse';
