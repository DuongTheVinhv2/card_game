import type { Element, Enhancement } from './types';

export type ScrollId =
  | 'pyre' | 'tides' | 'gales' | 'stone'
  | 'strength' | 'forge' | 'apollo' | 'ichor' | 'midas' | 'pygmalion' | 'thetis'
  | 'fates' | 'reflection' | 'haste' | 'nectar';

export interface ScrollDef {
  id: ScrollId;
  name: string;
  icon: string;
  tint: string;
  price: number;
  desc: string;
  /** number of selected hand cards required ([min, max]); null = no target */
  target: [number, number] | null;
  /** can only be used during a battle */
  battleOnly: boolean;
  /** element conversion */
  toElement?: Element;
  /** enhancement applied */
  toEnh?: Enhancement;
}

export const SCROLLS: ScrollDef[] = [
  { id: 'pyre', name: 'Scroll of Pyre', icon: 'fire', tint: '#ff5a1f', price: 3, desc: 'Turn up to 3 selected cards into Fire.', target: [1, 3], battleOnly: true, toElement: 'fire' },
  { id: 'tides', name: 'Scroll of Tides', icon: 'water', tint: '#1fa3ff', price: 3, desc: 'Turn up to 3 selected cards into Water.', target: [1, 3], battleOnly: true, toElement: 'water' },
  { id: 'gales', name: 'Scroll of Gales', icon: 'wind', tint: '#2fd99a', price: 3, desc: 'Turn up to 3 selected cards into Wind.', target: [1, 3], battleOnly: true, toElement: 'wind' },
  { id: 'stone', name: 'Scroll of Stone', icon: 'earth', tint: '#d99a3a', price: 3, desc: 'Turn up to 3 selected cards into Earth.', target: [1, 3], battleOnly: true, toElement: 'earth' },
  { id: 'strength', name: 'Labor of Strength', icon: 'club', tint: '#e8c27a', price: 3, desc: 'Raise the rank of up to 2 selected cards by 1.', target: [1, 2], battleOnly: true },
  { id: 'forge', name: 'Forge of Hephaestus', icon: 'hammer', tint: '#d0874a', price: 3, desc: 'Enhance up to 2 selected cards into Bronze (+15 Power).', target: [1, 2], battleOnly: true, toEnh: 'bronze' },
  { id: 'apollo', name: 'Blessing of Apollo', icon: 'sun', tint: '#ffd35a', price: 4, desc: 'Enhance 1 selected card into Divine (+4 Mult when scored).', target: [1, 1], battleOnly: true, toEnh: 'divine' },
  { id: 'ichor', name: 'Ichor of the Gods', icon: 'chalice', tint: '#ffcf3f', price: 5, desc: 'Enhance 1 selected card into Olympian (×1.5 Mult when scored).', target: [1, 1], battleOnly: true, toEnh: 'olympian' },
  { id: 'midas', name: 'Touch of Midas', icon: 'coin', tint: '#f2c94c', price: 3, desc: 'Enhance up to 2 selected cards into Gilded (+3 Drachmae when scored).', target: [1, 2], battleOnly: true, toEnh: 'gilded' },
  { id: 'pygmalion', name: "Pygmalion's Chisel", icon: 'chisel', tint: '#dfe6ee', price: 4, desc: 'Enhance 1 selected card into Marble (×1.5 Mult while held in hand).', target: [1, 1], battleOnly: true, toEnh: 'marble' },
  { id: 'thetis', name: 'Tears of Thetis', icon: 'gem', tint: '#9fe8ff', price: 4, desc: 'Enhance 1 selected card into Crystal (×2 Mult, 1 in 4 chance to shatter).', target: [1, 1], battleOnly: true, toEnh: 'crystal' },
  { id: 'fates', name: 'Shears of the Fates', icon: 'shears', tint: '#c9b6ff', price: 3, desc: 'Destroy up to 2 selected cards permanently.', target: [1, 2], battleOnly: true },
  { id: 'reflection', name: 'Reflection', icon: 'mirror', tint: '#b8d4ff', price: 4, desc: 'Select 2 cards: the left one becomes a copy of the right one.', target: [2, 2], battleOnly: true },
  { id: 'haste', name: 'Haste of Hermes', icon: 'caduceus', tint: '#8fe3c8', price: 3, desc: 'Gain 2 Discards this battle.', target: null, battleOnly: true },
  { id: 'nectar', name: 'Nectar', icon: 'heal', tint: '#ff8fb1', price: 3, desc: 'Heal 30% of your max HP.', target: null, battleOnly: false },
];

export const SCROLL_BY_ID: Record<ScrollId, ScrollDef> = Object.fromEntries(SCROLLS.map((s) => [s.id, s])) as Record<ScrollId, ScrollDef>;

export const MAX_CONSUMABLES = 2;
