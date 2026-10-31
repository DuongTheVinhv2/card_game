// DODEKATHLOS procedural audio engine: no audio files - every sound is synthesized with Web Audio.
// Public API (imported by the game). All calls are safe before init(): they are ignored (or remembered,
// for music / intensity / volume settings) and never throw.

import { MODES, clamp, glideParam, mulberry32, type Key } from './dsp';
import { createMixer, type Mixer } from './mixer';
import { SFX, SFX_DUCK, SFX_GAP, SFX_LOW_PRIORITY, chipAt, multAt } from './sfx';
import type { SfxFn } from './sfxkit';
import { trackDiagnostics, type Track } from './music';
import { createTrack, toneCutoff } from './tracks';

export type SfxName =
  | 'hover' | 'select' | 'deselect' | 'deal' | 'shuffle' | 'discard' | 'playHand' | 'cardFlip'
  | 'chip' | 'mult' | 'xmult' | 'total' | 'bigTotal'
  | 'hitFire' | 'hitWater' | 'hitWind' | 'hitEarth' | 'hitHeavy' | 'critical' | 'resist' | 'weak'
  | 'bossRoar' | 'bossAttack' | 'bossCharge' | 'bossGuard' | 'bossDeath' | 'bossIntro'
  | 'playerHurt' | 'shieldGain' | 'shieldBlock' | 'heal' | 'pierce'
  | 'coin' | 'buy' | 'sell' | 'reroll' | 'button' | 'buttonSoft' | 'error' | 'levelUp' | 'boonTrigger'
  | 'whoosh' | 'scrollUse' | 'enhance' | 'shatter' | 'mapStep' | 'nodeSelect' | 'victory' | 'defeat' | 'apotheosis';
export type MusicTrack = 'none' | 'title' | 'map' | 'battle' | 'boss' | 'shop' | 'victory' | 'defeat';
export interface PlayOpts {
  /** playback-rate style multiplier, 1 = default */
  pitch?: number;
  /** 0..1+ */
  volume?: number;
  /** -1..1 */
  pan?: number;
  /** seconds */
  delay?: number;
}

type VolKind = 'master' | 'music' | 'sfx';

/** Snapshot for debugging / dev overlays (see AudioEngine.getStats). */
export interface AudioStats {
  ready: boolean;
  state: string;
  music: MusicTrack;
  intensity: number;
  /** active SFX instances */
  voices: number;
  /** internal errors swallowed so far (warned in dev builds) */
  errors: number;
  /** master output peak / RMS over the last ~43 ms */
  outPeak: number;
  outRms: number;
}
const STORE_KEY = 'dodek.audio';
const DEFAULT_VOL: Record<VolKind, number> = { master: 0.8, music: 0.55, sfx: 0.8 };
const TIMER_MS = 25;
const LOOKAHEAD = 0.12;
const HIDDEN_LOOKAHEAD = 1.5;
const MAX_VOICES = 40;
const DEFAULT_KEY: Key = { root: 62, mode: MODES.dorian };
const TRACKS: ReadonlySet<string> = new Set<MusicTrack>(['none', 'title', 'map', 'battle', 'boss', 'shop', 'victory', 'defeat']);
/** finite number or default (sanitizes NaN / undefined from game code) */
const fin = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private mix: Mixer | null = null;
  private failed = false;
  private vol: Record<VolKind, number> = { ...DEFAULT_VOL };
  private muted = false;
  private want: MusicTrack = 'none';
  private wantFade = 1.5;
  private playing: MusicTrack = 'none';
  private cur: Track | null = null;
  private fading: { track: Track; until: number }[] = [];
  private intensity = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastPlay = new Map<string, number>();
  private voices = 0;
  private duckLevel = 1;
  private duckUntil = 0;
  private rng = mulberry32((Math.random() * 4294967296) >>> 0);
  private errors = 0;
  private meter: AnalyserNode | null = null;
  private meterBuf: Float32Array<ArrayBuffer> | null = null;

  constructor() {
    this.load();
  }

  /** true once the AudioContext exists and is running */
  get ready(): boolean {
    return !!this.ctx && !!this.mix && this.ctx.state === 'running';
  }

  /** create/resume the AudioContext; call from a user gesture. Safe to call many times. */
  init(): void {
    if (this.failed) return;
    try {
      if (!this.ctx) {
        const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
        const AC = w.AudioContext ?? w.webkitAudioContext;
        if (!AC) {
          this.failed = true;
          return;
        }
        const ctx = new AC({ latencyHint: 'interactive' });
        this.ctx = ctx;
        this.mix = createMixer(ctx, ctx.destination, { finalStage: true });
        this.meter = ctx.createAnalyser();
        this.meter.fftSize = 2048;
        this.mix.output.connect(this.meter);
        trackDiagnostics.onError = (e) => this.report(e);
        this.applyVolumes(true);
        ctx.addEventListener('statechange', () => this.onState());
      }
      if (this.ctx.state !== 'running') {
        this.ctx.resume().then(() => this.onState(), () => undefined);
      }
      this.onState();
    } catch (e) {
      this.failed = true;
      this.report(e);
    }
  }

  play(name: SfxName, opts?: PlayOpts): void {
    const fn = SFX[name];
    if (!fn || !this.trigger(name, fn, opts, SFX_GAP[name] ?? 0.008, SFX_LOW_PRIORITY.has(name))) return;
    const dk = SFX_DUCK[name];
    if (!dk) return;
    const amount = dk[0] * clamp(fin(opts?.volume, 1), 0, 1);
    const delay = clamp(fin(opts?.delay, 0), 0, 30);
    if (delay > 0.03) setTimeout(() => this.duck(amount, dk[1]), delay * 1000);
    else this.duck(amount, dk[1]);
  }

  /** Balatro-style score count-up tick: index 0,1,2,... rises in pitch (musical steps of the current mode) */
  scoreTick(index: number): void {
    const deg = clamp(Math.floor(fin(index, 0)), 0, 14);
    this.trigger(`tick${deg}`, (b, t, k) => chipAt(b, t, k, deg), undefined, 0.01, true);
  }

  /** mult tick: brighter, rising */
  multTick(index: number): void {
    const deg = clamp(Math.floor(fin(index, 0)), 0, 12);
    this.trigger(`mtick${deg}`, (b, t, k) => multAt(b, t, k, deg), undefined, 0.01, true);
  }

  /** crossfade to a track (default fade 1.5s). 'none' fades out. */
  setMusic(track: MusicTrack, fadeSec = 1.5): void {
    if (!TRACKS.has(track)) return;
    this.want = track;
    this.wantFade = Math.max(0.01, fin(fadeSec, 1.5));
    if (!this.ready || track === this.playing) return;
    try {
      this.switchTrack(track, this.wantFade);
    } catch (e) {
      this.report(e);
    }
  }

  /** 0..1 battle tension (adds percussion layers / faster rhythm / brighter filter) */
  setIntensity(v: number): void {
    this.intensity = clamp(fin(v, this.intensity), 0, 1);
    this.cur?.setIntensity(this.intensity);
    this.applyTone();
  }

  setVolume(kind: VolKind, v: number): void {
    if (!(kind in this.vol)) return;
    this.vol[kind] = clamp(fin(v, this.vol[kind]), 0, 1);
    this.save();
    this.applyVolumes(false);
  }

  getVolume(kind: VolKind): number {
    return this.vol[kind] ?? 0;
  }

  setMuted(m: boolean): void {
    this.muted = !!m;
    this.save();
    this.applyVolumes(false);
  }

  /** ducks music briefly (e.g. under big hits / stingers) */
  duck(amount = 0.5, seconds = 0.6): void {
    if (!this.ready || !this.mix || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const active = now < this.duckUntil;
      const level = Math.min(1 - clamp(fin(amount, 0.5), 0, 1), active ? this.duckLevel : 1);
      const until = Math.max(now + clamp(fin(seconds, 0.6), 0.05, 30), active ? this.duckUntil : 0);
      this.duckLevel = level;
      this.duckUntil = until;
      for (const p of [this.mix.musicDuck.gain, this.mix.musicDuckW.gain]) {
        glideParam(p, now, level, 0.04);
        p.setTargetAtTime(1, until, 0.35);
      }
    } catch (e) {
      this.report(e);
    }
  }

  /* ----------------------------------------------------------- additions */

  /** currently requested music track */
  get music(): MusicTrack {
    return this.want;
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** debug snapshot: context state, active voices, swallowed errors, output level */
  getStats(): AudioStats {
    let outPeak = 0;
    let outRms = 0;
    if (this.meter) {
      const b = this.meterBuf ?? (this.meterBuf = new Float32Array(this.meter.fftSize));
      this.meter.getFloatTimeDomainData(b);
      let ss = 0;
      for (let i = 0; i < b.length; i++) {
        const a = Math.abs(b[i]);
        if (a > outPeak) outPeak = a;
        ss += b[i] * b[i];
      }
      outRms = Math.sqrt(ss / b.length);
    }
    return {
      ready: this.ready, state: this.ctx?.state ?? 'none', music: this.playing, intensity: this.intensity,
      voices: this.voices, errors: this.errors, outPeak, outRms,
    };
  }

  /* ------------------------------------------------------------ internals */

  private report(e: unknown): void {
    this.errors++;
    if (import.meta.env?.DEV && this.errors <= 5) console.warn('[audio]', e);
  }

  private onState(): void {
    if (!this.ready) return;
    if (!this.timer) this.timer = setInterval(() => this.tick(), TIMER_MS);
    if (this.want !== this.playing) {
      try {
        this.switchTrack(this.want, this.wantFade);
      } catch (e) {
        this.report(e);
      }
    }
  }

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    try {
      const hidden = typeof document !== 'undefined' && document.hidden;
      const now = ctx.currentTime;
      this.cur?.scheduleUntil(now + (hidden ? HIDDEN_LOOKAHEAD : LOOKAHEAD), now);
      if (this.fading.length) {
        this.fading = this.fading.filter((f) => {
          if (now < f.until) return true;
          f.track.disconnect();
          return false;
        });
      }
    } catch (e) {
      this.report(e);
    }
  }

  private switchTrack(name: MusicTrack, fade: number): void {
    const ctx = this.ctx;
    const mix = this.mix;
    if (!ctx || !mix) return;
    const now = ctx.currentTime + 0.03;
    if (this.cur) {
      const end = this.cur.stop(now, fade);
      this.fading.push({ track: this.cur, until: end + 0.5 });
      this.cur = null;
    }
    this.playing = name;
    if (name !== 'none') {
      const tr = createTrack(name, ctx, mix.musicDry, mix.musicWet, (this.rng() * 4294967296) >>> 0);
      tr.setIntensity(this.intensity);
      tr.start(now, fade);
      tr.scheduleUntil(now + LOOKAHEAD);
      this.cur = tr;
    }
    this.applyTone();
  }

  private applyTone(): void {
    if (!this.ready || !this.mix || !this.ctx) return;
    this.mix.musicTone.frequency.setTargetAtTime(toneCutoff(this.playing, this.intensity), this.ctx.currentTime, 0.4);
  }

  /** schedule one SFX instance; returns false when it was ignored (not ready, rate-limited, voice cap) */
  private trigger(id: string, fn: SfxFn, opts: PlayOpts | undefined, gap: number, lowPriority: boolean): boolean {
    if (!this.ready || !this.ctx || !this.mix) return false;
    try {
      const ctx = this.ctx;
      const mix = this.mix;
      const vol = clamp(fin(opts?.volume, 1), 0, 4);
      if (vol <= 0) return false;
      const t = ctx.currentTime + 0.01 + clamp(fin(opts?.delay, 0), 0, 30);
      const prev = this.lastPlay.get(id);
      if (prev !== undefined && Math.abs(t - prev) < gap) return false;
      if (this.voices >= MAX_VOICES * (lowPriority ? 1 : 1.5)) return false;
      this.lastPlay.set(id, t);

      const out = ctx.createGain();
      out.gain.value = vol;
      const wet = ctx.createGain();
      wet.gain.value = vol;
      let dry: AudioNode = out;
      const pan = clamp(fin(opts?.pan, 0), -1, 1);
      if (pan) {
        const p = ctx.createStereoPanner();
        p.pan.value = pan;
        out.connect(p);
        dry = p;
      }
      dry.connect(mix.sfxDry);
      wet.connect(mix.sfxWet);
      const pitch = clamp(fin(opts?.pitch, 1), 0.25, 4);
      const end = fn({ ctx, out, verb: wet }, t, { p: pitch, r: this.rng, key: this.tickKey() });
      this.voices++;
      const ms = Math.max(60, (end - ctx.currentTime + 0.25) * 1000);
      setTimeout(() => {
        this.voices--;
        try {
          out.disconnect();
          wet.disconnect();
          if (dry !== out) dry.disconnect();
        } catch {
          /* ignore */
        }
      }, ms);
      return true;
    } catch (e) {
      this.report(e); // never throw into game code
      return false;
    }
  }

  /** key of the current music, root normalized to C4..B4 (so melodic SFX sit in the music's mode) */
  private tickKey(): Key {
    const k = this.cur?.key ?? DEFAULT_KEY;
    return { root: 60 + ((((k.root - 60) % 12) + 12) % 12), mode: k.mode };
  }

  private applyVolumes(immediate: boolean): void {
    const mix = this.mix;
    const ctx = this.ctx;
    if (!mix || !ctx) return;
    const pairs: [AudioParam, number][] = [
      [mix.masterVol.gain, this.muted ? 0 : this.vol.master],
      [mix.sfxVol.gain, this.vol.sfx],
      [mix.sfxVolW.gain, this.vol.sfx],
      [mix.musicVol.gain, this.vol.music],
      [mix.musicVolW.gain, this.vol.music],
    ];
    for (const [p, v] of pairs) {
      if (immediate) p.value = v;
      else glideParam(p, ctx.currentTime, v, 0.03);
    }
  }

  private load(): void {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORE_KEY) : null;
      if (!raw) return;
      const s = JSON.parse(raw) as Partial<Record<VolKind, unknown>> & { muted?: unknown };
      for (const k of Object.keys(DEFAULT_VOL) as VolKind[]) {
        const v = s[k];
        if (typeof v === 'number' && Number.isFinite(v)) this.vol[k] = clamp(v, 0, 1);
      }
      this.muted = s.muted === true;
    } catch {
      /* ignore corrupt storage */
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ ...this.vol, muted: this.muted }));
    } catch {
      /* storage unavailable */
    }
  }
}

/** singleton */
export const audio: AudioEngine = new AudioEngine();
