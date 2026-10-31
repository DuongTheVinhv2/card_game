import * as THREE from 'three';
import type { Element } from '../logic/types';

/** Linear-space colours tuned for additive / HDR rendering (values may exceed 1 for bloom). */
export interface ElementPalette {
  /** white-hot core tint (stars, bright particles) */
  core: THREE.Color;
  /** main body glow */
  glow: THREE.Color;
  /** deep accent (nebula fill, shadows of the glow) */
  accent: THREE.Color;
}

const hex = (h: string) => new THREE.Color(h);

export const ELEMENT_PALETTE: Record<Element, ElementPalette> = {
  fire: { core: hex('#ffe2b8'), glow: hex('#ff6a1f'), accent: hex('#c41a00') },
  water: { core: hex('#dff7ff'), glow: hex('#2aa8ff'), accent: hex('#0a3dd6') },
  wind: { core: hex('#eafff6'), glow: hex('#2fe0a0'), accent: hex('#008f7a') },
  earth: { core: hex('#fff1cf'), glow: hex('#e0a040'), accent: hex('#8a4e0c') },
};

/** Neutral gold palette for the hero / title constellation. */
export const HERO_PALETTE: ElementPalette = { core: hex('#fff6dc'), glow: hex('#ffc861'), accent: hex('#b87a1a') };
