// Star-chart patterns for the hand level-up ("constellation") cards.
// Coordinates are normalised 0..1 inside the chart area (x right, y down); magnitude 0..1 (1 = brightest).
import type { HandType } from '../../logic/types';

export interface ConstellationPattern {
  stars: [number, number, number][];
  lines: [number, number][];
}

export const CONSTELLATION_NAME: Record<HandType, string> = {
  high: 'Monoceros',
  pair: 'Gemini',
  twopair: 'Pisces',
  three: 'Triangulum',
  straight: 'Sagitta',
  flush: 'Aquarius',
  fullhouse: 'Pleiades',
  four: 'Crux',
  straightflush: 'Draco',
  royal: 'Corona Borealis',
};

export const CONSTELLATION_STARS: Record<HandType, ConstellationPattern> = {
  // The Unicorn — a faint zig-zag between Orion and Canis Minor
  high: {
    stars: [
      [0.16, 0.2, 0.55], [0.3, 0.3, 0.45], [0.42, 0.24, 0.5], [0.5, 0.42, 0.62], [0.62, 0.55, 0.85],
      [0.74, 0.5, 0.5], [0.86, 0.38, 0.4], [0.55, 0.7, 0.55], [0.44, 0.84, 0.45], [0.7, 0.8, 0.35],
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [4, 7], [7, 8], [7, 9]],
  },
  // The Twins — Castor & Pollux heads at the top, two parallel bodies
  pair: {
    stars: [
      [0.36, 0.1, 0.9], [0.62, 0.14, 1.0], // Castor, Pollux
      [0.3, 0.3, 0.5], [0.6, 0.32, 0.55],
      [0.26, 0.5, 0.45], [0.58, 0.52, 0.6],
      [0.18, 0.7, 0.55], [0.36, 0.72, 0.5], [0.52, 0.74, 0.65], [0.7, 0.72, 0.5],
      [0.14, 0.88, 0.45], [0.48, 0.9, 0.55], [0.78, 0.86, 0.4],
    ],
    lines: [[0, 2], [2, 4], [4, 6], [4, 7], [6, 10], [1, 3], [3, 5], [5, 8], [5, 9], [8, 11], [9, 12], [2, 3]],
  },
  // The Fishes — the Circlet joined by a long cord to the second fish at Alrescha
  twopair: {
    stars: [
      [0.08, 0.3, 0.45], [0.16, 0.2, 0.5], [0.26, 0.24, 0.45], [0.27, 0.36, 0.5], [0.17, 0.42, 0.45], [0.1, 0.38, 0.4], // circlet
      [0.38, 0.48, 0.45], [0.52, 0.6, 0.5], [0.66, 0.74, 0.55], [0.8, 0.86, 0.75], // cord to Alrescha
      [0.78, 0.66, 0.45], [0.74, 0.46, 0.55], [0.7, 0.28, 0.5], [0.8, 0.14, 0.6], [0.66, 0.12, 0.4],
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [3, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13], [12, 14], [13, 14]],
  },
  // The Triangle
  three: {
    stars: [[0.2, 0.68, 0.85], [0.78, 0.3, 1.0], [0.7, 0.62, 0.7], [0.72, 0.48, 0.35], [0.4, 0.4, 0.25]],
    lines: [[0, 1], [1, 3], [3, 2], [2, 0]],
  },
  // The Arrow
  straight: {
    stars: [[0.12, 0.72, 0.6], [0.2, 0.84, 0.55], [0.42, 0.62, 0.65], [0.62, 0.46, 0.75], [0.86, 0.26, 0.9], [0.75, 0.3, 0.3]],
    lines: [[0, 2], [1, 2], [2, 3], [3, 4]],
  },
  // The Water-Bearer — the jar asterism and the falling stream
  flush: {
    stars: [
      [0.14, 0.18, 0.6], [0.3, 0.22, 0.85], [0.44, 0.3, 0.9], [0.54, 0.22, 0.55], [0.6, 0.3, 0.5], [0.52, 0.38, 0.6], // jar
      [0.4, 0.46, 0.55], [0.34, 0.6, 0.6], [0.46, 0.68, 0.5], [0.6, 0.76, 0.55], [0.74, 0.84, 0.65], [0.86, 0.72, 0.45],
      [0.28, 0.78, 0.45], [0.2, 0.9, 0.55],
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 2], [2, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [7, 12], [12, 13]],
  },
  // The Seven Sisters — a tight little dipper
  fullhouse: {
    stars: [
      [0.52, 0.48, 1.0], [0.72, 0.5, 0.75], [0.8, 0.44, 0.6], [0.36, 0.36, 0.7], [0.28, 0.52, 0.65], [0.42, 0.62, 0.7],
      [0.6, 0.66, 0.55], [0.3, 0.3, 0.4], [0.64, 0.32, 0.35],
    ],
    lines: [[3, 4], [4, 5], [5, 0], [0, 3], [0, 1], [1, 2], [5, 6]],
  },
  // The Southern Cross
  four: {
    stars: [[0.5, 0.12, 0.8], [0.48, 0.86, 1.0], [0.22, 0.46, 0.85], [0.76, 0.52, 0.6], [0.62, 0.64, 0.35]],
    lines: [[0, 1], [2, 3]],
  },
  // The Dragon — head lozenge, long winding body
  straightflush: {
    stars: [
      [0.2, 0.2, 0.9], [0.32, 0.14, 0.7], [0.36, 0.26, 0.55], [0.22, 0.32, 0.5], // head
      [0.42, 0.4, 0.55], [0.56, 0.36, 0.6], [0.66, 0.24, 0.5], [0.8, 0.3, 0.55], [0.84, 0.48, 0.6],
      [0.72, 0.6, 0.55], [0.56, 0.62, 0.5], [0.44, 0.72, 0.65], [0.5, 0.86, 0.55], [0.68, 0.9, 0.5],
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 0], [2, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 12], [12, 13]],
  },
  // The Northern Crown — a semicircle of seven stars around Alphecca
  royal: {
    stars: [
      [0.14, 0.4, 0.5], [0.2, 0.6, 0.6], [0.34, 0.74, 0.65], [0.52, 0.78, 1.0], [0.68, 0.72, 0.6], [0.8, 0.6, 0.55], [0.86, 0.42, 0.5],
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6]],
  },
};
