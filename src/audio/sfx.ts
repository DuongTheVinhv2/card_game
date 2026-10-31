// SFX registry + per-sound playback policy (ducking, rate limits, priority).

import type { SfxName } from './audio';
import type { SfxFn } from './sfxkit';
import { UI_SFX } from './sfx-ui';
import { COMBAT_SFX } from './sfx-combat';
import { BOSS_SFX } from './sfx-boss';
import { STINGER_SFX } from './sfx-stingers';

export { chipAt, multAt } from './sfx-combat';

const RAW: Record<SfxName, SfxFn> = { ...UI_SFX, ...COMBAT_SFX, ...BOSS_SFX, ...STINGER_SFX };

/** Loudness trims (mastering table), measured with the offline self-test. */
const TRIM: Partial<Record<SfxName, number>> = {
  deal: 2.5, cardFlip: 1.8, discard: 2.2, whoosh: 2.2, shuffle: 1.5,
  bigTotal: 0.65, hitFire: 0.78, hitWind: 1.8, hitWater: 1.4, hitEarth: 0.55, hitHeavy: 0.72, weak: 1.8,
  bossRoar: 0.6, bossAttack: 0.8, bossDeath: 0.72, bossIntro: 0.78,
  enhance: 0.7, shatter: 1.5, mapStep: 0.65, error: 0.65,
};

function trimmed(fn: SfxFn, g: number | undefined): SfxFn {
  if (g === undefined || g === 1) return fn;
  return (b, t, k) => {
    const o = b.ctx.createGain();
    o.gain.value = g;
    o.connect(b.out);
    let v: GainNode | null = null;
    if (b.verb) {
      v = b.ctx.createGain();
      v.gain.value = g;
      v.connect(b.verb);
    }
    return fn({ ctx: b.ctx, out: o, verb: v }, t, k);
  };
}

export const SFX = Object.fromEntries(
  (Object.keys(RAW) as SfxName[]).map((n) => [n, trimmed(RAW[n], TRIM[n])]),
) as Record<SfxName, SfxFn>;
export const SFX_NAMES = Object.keys(SFX) as SfxName[];

/** Automatic music ducking for big moments: [amount 0..1, seconds]. */
export const SFX_DUCK: Partial<Record<SfxName, readonly [number, number]>> = {
  xmult: [0.2, 0.5],
  bigTotal: [0.45, 1.4],
  hitHeavy: [0.25, 0.4],
  critical: [0.15, 0.4],
  bossRoar: [0.35, 1.2],
  bossAttack: [0.25, 0.5],
  bossIntro: [0.5, 2.0],
  bossDeath: [0.6, 2.6],
  levelUp: [0.2, 0.8],
  victory: [0.85, 2.8],
  defeat: [0.85, 2.8],
  apotheosis: [0.9, 4.8],
};

/** Minimum seconds between two triggers of the same sound (prevents machine-gunning). */
export const SFX_GAP: Partial<Record<SfxName, number>> = {
  hover: 0.035, deal: 0.018, cardFlip: 0.02, chip: 0.012, mult: 0.012, coin: 0.03,
  button: 0.03, buttonSoft: 0.03, mapStep: 0.05, select: 0.02, deselect: 0.02, error: 0.15,
};

/** Dropped first when too many voices are active. */
export const SFX_LOW_PRIORITY: ReadonlySet<SfxName> = new Set<SfxName>([
  'hover', 'deal', 'cardFlip', 'chip', 'coin', 'buttonSoft', 'mapStep', 'boonTrigger',
]);
