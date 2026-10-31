import type { Element } from './types';

/** A ▶ B : A beats B.  Water ▶ Fire ▶ Wind ▶ Earth ▶ Water */
export const BEATS: Record<Element, Element> = { water: 'fire', fire: 'wind', wind: 'earth', earth: 'water' };
/** The element that beats the key element. */
export const BEATEN_BY: Record<Element, Element> = { fire: 'water', wind: 'fire', earth: 'wind', water: 'earth' };

export interface ElementInfo {
  name: string;
  /** main saturated color */
  color: string;
  /** light / glow color */
  glow: string;
  /** deep shade (text on light, panels) */
  dark: string;
  signature: string;
  sigShort: string;
  sigDesc: string;
  verbBeats: string;
}

export const ELEMENT_INFO: Record<Element, ElementInfo> = {
  fire: {
    name: 'Fire', color: '#ff5a1f', glow: '#ffb15c', dark: '#5c1606',
    signature: 'Fury', sigShort: '+1 Mult',
    sigDesc: 'Each scoring Fire card adds +1 Mult.',
    verbBeats: 'Fire devours Wind',
  },
  water: {
    name: 'Water', color: '#1fa3ff', glow: '#86e1ff', dark: '#062a4d',
    signature: 'Renewal', sigShort: 'Heal',
    sigDesc: 'Each scoring Water card heals you for half its Power.',
    verbBeats: 'Water quenches Fire',
  },
  wind: {
    name: 'Wind', color: '#2fd99a', glow: '#b9ffe2', dark: '#073b2b',
    signature: 'Pierce', sigShort: 'Pierce 25%',
    sigDesc: 'Each scoring Wind card ignores 25% of the enemy DEF.',
    verbBeats: 'Wind erodes Earth',
  },
  earth: {
    name: 'Earth', color: '#d99a3a', glow: '#ffd88a', dark: '#3d2507',
    signature: 'Bulwark', sigShort: 'Shield',
    sigDesc: 'Each scoring Earth card grants Shield equal to its Power.',
    verbBeats: 'Earth swallows Water',
  },
};
