// Track factory + per-track master-tone policy.

import type { MusicTrack } from './audio';
import type { Track } from './music';
import { DefeatTrack, MapTrack, ShopTrack, TitleTrack, VictoryTrack } from './tracks-calm';
import { BattleTrack, BossTrack } from './tracks-battle';

export type PlayableTrack = Exclude<MusicTrack, 'none'>;

export function createTrack(name: PlayableTrack, ctx: BaseAudioContext, dry: AudioNode, wet: AudioNode, seed: number): Track {
  switch (name) {
    case 'title':
      return new TitleTrack(ctx, dry, wet, seed);
    case 'map':
      return new MapTrack(ctx, dry, wet, seed);
    case 'shop':
      return new ShopTrack(ctx, dry, wet, seed);
    case 'battle':
      return new BattleTrack(ctx, dry, wet, seed);
    case 'boss':
      return new BossTrack(ctx, dry, wet, seed);
    case 'victory':
      return new VictoryTrack(ctx, dry, wet, seed);
    case 'defeat':
      return new DefeatTrack(ctx, dry, wet, seed);
  }
}

/** Music-bus lowpass cutoff: battle/boss brighten with intensity, everything else is open. */
export function toneCutoff(track: MusicTrack, intensity: number): number {
  if (track === 'battle' || track === 'boss') return 3200 + 14000 * Math.pow(Math.min(1, Math.max(0, intensity)), 1.3);
  return 18000;
}
