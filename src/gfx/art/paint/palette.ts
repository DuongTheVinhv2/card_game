// Painting palette derived from ELEMENT_INFO (main / glow / dark) plus print-ready inks.
import { ELEMENT_INFO } from '../../../logic/elements';
import type { Element } from '../../../logic/types';

export interface ElemArt {
  main: string;
  glow: string;
  dark: string;
  /** rank / index ink on parchment (saturated, high contrast) */
  ink: string;
  inkDeep: string;
  /** pip gradient top → mid → bottom */
  pip: [string, string, string];
  /** pottery ground for court-card panels */
  clay: string;
  clayLight: string;
  clayDeep: string;
  label: string;
}

export const ELEM_ART: Record<Element, ElemArt> = {
  fire: {
    main: ELEMENT_INFO.fire.color, glow: ELEMENT_INFO.fire.glow, dark: ELEMENT_INFO.fire.dark,
    ink: '#b52e0b', inkDeep: '#5c1606',
    pip: ['#ffa04e', '#ee4c18', '#8a1c06'],
    clay: '#df8448', clayLight: '#f4b179', clayDeep: '#a24c1c',
    label: 'Fire',
  },
  water: {
    main: ELEMENT_INFO.water.color, glow: ELEMENT_INFO.water.glow, dark: ELEMENT_INFO.water.dark,
    ink: '#0a5da8', inkDeep: '#062a4d',
    pip: ['#74d4ff', '#1b8ae0', '#08447f'],
    clay: '#6fb3cf', clayLight: '#a8daea', clayDeep: '#2f7397',
    label: 'Water',
  },
  wind: {
    main: ELEMENT_INFO.wind.color, glow: ELEMENT_INFO.wind.glow, dark: ELEMENT_INFO.wind.dark,
    ink: '#0a7a52', inkDeep: '#073b2b',
    pip: ['#74f2c2', '#17ab77', '#075c3c'],
    clay: '#84c79c', clayLight: '#b9e5c8', clayDeep: '#468a62',
    label: 'Wind',
  },
  earth: {
    main: ELEMENT_INFO.earth.color, glow: ELEMENT_INFO.earth.glow, dark: ELEMENT_INFO.earth.dark,
    ink: '#8a5013', inkDeep: '#3d2507',
    pip: ['#f7c873', '#c98528', '#6e400c'],
    clay: '#d7a45c', clayLight: '#eecb8c', clayDeep: '#966524',
    label: 'Earth',
  },
};

/** black-figure paint colours */
export const POTTERY = {
  black: '#1b130e',
  blackHi: '#3a2c22',
  red: '#8e2c1c',
  white: '#f4ecd9',
};
