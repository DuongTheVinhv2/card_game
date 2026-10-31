import { degFreq, type Key, type Rng } from './dsp';
import type { Bus } from './voices';

/** Per-call context for an SFX renderer. */
export interface SfxKit {
  /** pitch multiplier (1 = default) */
  p: number;
  r: Rng;
  /** current musical key (so melodic SFX sit in the music's mode) */
  key: Key;
}

/** Renders one sound effect starting at absolute time t; returns the time it becomes silent. */
export type SfxFn = (bus: Bus, t: number, k: SfxKit) => number;

/** Frequency of a scale degree in the kit's key, times the pitch multiplier. */
export const kf = (k: SfxKit, deg: number): number => degFreq(k.key, deg) * k.p;
/** Symmetric random jitter multiplier: 1 +- amt. */
export const jit = (k: SfxKit, amt: number): number => 1 + (k.r() * 2 - 1) * amt;
/** max() of end times. */
export const last = (...ends: number[]): number => Math.max(...ends);
