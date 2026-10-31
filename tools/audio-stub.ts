// Silent stand-in for src/audio/audio.ts (only used by vite.stub.config.ts for early testing).
export type SfxName = string;
export type MusicTrack = 'none' | 'title' | 'map' | 'battle' | 'boss' | 'shop' | 'victory' | 'defeat';
export interface PlayOpts { pitch?: number; volume?: number; pan?: number; delay?: number }
export class AudioEngine {
  ready = false;
  init(): void {}
  play(_n: SfxName, _o?: PlayOpts): void {}
  scoreTick(_i: number): void {}
  multTick(_i: number): void {}
  setMusic(_t: MusicTrack, _f?: number): void {}
  setIntensity(_v: number): void {}
  setVolume(_k: 'master' | 'music' | 'sfx', _v: number): void {}
  getVolume(_k: 'master' | 'music' | 'sfx'): number { return 0.5; }
  setMuted(_m: boolean): void {}
  duck(_a?: number, _s?: number): void {}
}
export const audio = new AudioEngine();
