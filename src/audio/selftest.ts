// Offline self-test: renders every SFX and ~6 s of every music track through OfflineAudioContext using
// exactly the same synthesis code as the live engine, then measures level / NaN / click metrics.

import { MODES, mulberry32, type Key } from './dsp';
import { createMixer } from './mixer';
import { SFX, SFX_NAMES, chipAt, multAt } from './sfx';
import type { SfxFn } from './sfxkit';
import { setVoiceRandom } from './voices';
import { createTrack, toneCutoff, type PlayableTrack } from './tracks';
import { trackDiagnostics } from './music';

export interface TestRow {
  name: string;
  /** seconds from onset to the last sample above -80 dBFS (dry render) */
  dur: number;
  /** full-mix (dry + reverb) peak, unity bus gains, no limiter */
  peak: number;
  /** RMS over the active region, dBFS */
  rmsDb: number;
  /** peak / RMS in dB */
  crest: number;
  nan: boolean;
  /** largest sample step in the first 3 samples after onset (dry) */
  startJump: number;
  /** max |x| in the 5 ms before the dry signal falls silent */
  endLevel: number;
  /** max |x| in the final 10 ms of the full render (must be ~0) */
  tail: number;
  /** strongest isolated 2nd-difference spike relative to its neighbourhood (tonal clicks) */
  click: number;
  /** time (s) of the strongest click candidate */
  clickT: number;
  /** zero-crossing brightness estimate (Hz) */
  zcHz: number;
  issues: string;
}

const SR = 48000;
const KEY: Key = { root: 62, mode: MODES.dorian };
const T0 = 0.05;

interface Stats {
  peak: number;
  rms: number;
  nan: boolean;
  first: number;
  last: number;
  startJump: number;
  endLevel: number;
  tail: number;
  click: number;
  clickT: number;
  zcHz: number;
}

function analyze(buf: AudioBuffer): Stats {
  const L = buf.getChannelData(0);
  const R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  const n = L.length;
  let peak = 0;
  let nan = false;
  let first = -1;
  let last = -1;
  for (let i = 0; i < n; i++) {
    const a = L[i], b = R[i];
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      nan = true;
      continue;
    }
    const m = Math.max(Math.abs(a), Math.abs(b));
    if (m > peak) peak = m;
    if (m > 1e-4) {
      if (first < 0) first = i;
      last = i;
    }
  }
  let ss = 0;
  let zc = 0;
  if (first >= 0) {
    for (let i = first; i <= last; i++) {
      ss += (L[i] * L[i] + R[i] * R[i]) * 0.5;
      if (i > first && (L[i] >= 0) !== (L[i - 1] >= 0)) zc++;
    }
  }
  const cnt = first >= 0 ? last - first + 1 : 1;
  const rms = Math.sqrt(ss / cnt);
  let startJump = 0;
  if (first >= 0) {
    for (let i = first; i < Math.min(n, first + 3); i++) {
      const pa = i > 0 ? L[i - 1] : 0, pb = i > 0 ? R[i - 1] : 0;
      startJump = Math.max(startJump, Math.abs(L[i] - pa), Math.abs(R[i] - pb));
    }
  }
  let endLevel = 0;
  if (last >= 0) {
    for (let i = Math.max(0, last - Math.floor(SR * 0.005)); i <= last; i++) endLevel = Math.max(endLevel, Math.abs(L[i]), Math.abs(R[i]));
  }
  let tail = 0;
  for (let i = Math.max(0, n - Math.floor(SR * 0.01)); i < n; i++) tail = Math.max(tail, Math.abs(L[i]), Math.abs(R[i]));
  // click detector on the mid signal: block-wise max |d2| vs neighbouring blocks' d2 RMS
  const B = 256;
  const nb = Math.floor(n / B);
  const bRms = new Float32Array(nb);
  const bMax = new Float32Array(nb);
  let x1 = 0, x2 = 0;
  for (let k = 0; k < nb; k++) {
    let s2 = 0, mx = 0;
    for (let i = k * B; i < (k + 1) * B; i++) {
      const x = (L[i] + R[i]) * 0.5;
      const d2 = x - 2 * x1 + x2;
      x2 = x1;
      x1 = x;
      s2 += d2 * d2;
      if (Math.abs(d2) > mx) mx = Math.abs(d2);
    }
    bRms[k] = Math.sqrt(s2 / B);
    bMax[k] = mx;
  }
  let click = 0;
  let clickT = 0;
  for (let k = 1; k < nb - 1; k++) {
    if (bMax[k] < 0.02) continue;
    const ref = Math.max(1e-6, bRms[k - 1], bRms[k + 1], bRms[k] * 0.25);
    if (bMax[k] / ref > click) {
      click = bMax[k] / ref;
      clickT = (k * B) / SR;
    }
  }
  return { peak, rms, nan, first, last, startJump, endLevel, tail, click, clickT, zcHz: (zc / Math.max(1e-9, cnt / SR)) / 2 };
}

const db = (x: number): number => (x > 0 ? 20 * Math.log10(x) : -999);
const r3 = (x: number): number => Math.round(x * 1000) / 1000;
const r1 = (x: number): number => Math.round(x * 10) / 10;

function issuesOf(full: Stats, dry: Stats | null, kind: 'sfx' | 'music'): string {
  const out: string[] = [];
  if (full.nan || dry?.nan) out.push('NaN');
  if (full.peak < 0.02) out.push('SILENT');
  if (full.peak > 0.98) out.push('CLIP');
  if (full.tail > 0.001) out.push('TAIL');
  if (dry && dry.startJump > 0.1) out.push('START-CLICK');
  if (dry && dry.endLevel > 0.01) out.push('END-CLICK');
  const c = dry ?? full;
  if (c.click > 60) out.push('CLICK?');
  return out.join(' ');
}

async function renderSfxBuf(fn: SfxFn, withVerb: boolean): Promise<AudioBuffer> {
  const probe = new OfflineAudioContext(2, 128, SR);
  const end = fn({ ctx: probe, out: probe.destination, verb: null }, T0, { p: 1, r: mulberry32(42), key: KEY });
  const len = Math.ceil((end + (withVerb ? 3.45 : 0.1)) * SR);
  const ctx = new OfflineAudioContext(2, len, SR);
  if (withVerb) {
    const mix = createMixer(ctx, ctx.destination, { finalStage: false });
    fn({ ctx, out: mix.sfxDry, verb: mix.sfxWet }, T0, { p: 1, r: mulberry32(42), key: KEY });
  } else {
    fn({ ctx, out: ctx.destination, verb: null }, T0, { p: 1, r: mulberry32(42), key: KEY });
  }
  return ctx.startRendering();
}

async function testSfx(name: string, fn: SfxFn): Promise<TestRow> {
  const dryBuf = await renderSfxBuf(fn, false);
  const fullBuf = await renderSfxBuf(fn, true);
  const dry = analyze(dryBuf);
  const full = analyze(fullBuf);
  return {
    name,
    dur: r3(dry.first >= 0 ? (dry.last - dry.first) / SR : 0),
    peak: r3(full.peak),
    rmsDb: r1(db(dry.rms)),
    crest: r1(db(full.peak) - db(dry.rms)),
    nan: full.nan || dry.nan,
    startJump: r3(dry.startJump),
    endLevel: Math.round(dry.endLevel * 1e5) / 1e5,
    tail: Math.round(full.tail * 1e5) / 1e5,
    click: r1(dry.click),
    clickT: r3(dry.clickT),
    zcHz: Math.round(dry.zcHz),
    issues: issuesOf(full, dry, 'sfx'),
  };
}

export async function renderMusicBuf(track: PlayableTrack, intensity: number, seconds = 6, finalStage = false): Promise<AudioBuffer> {
  const len = Math.ceil((seconds + 3.45) * SR);
  const ctx = new OfflineAudioContext(2, len, SR);
  const mix = createMixer(ctx, ctx.destination, { finalStage });
  mix.musicTone.frequency.value = toneCutoff(track, intensity);
  const tr = createTrack(track, ctx, mix.musicDry, mix.musicWet, 1234);
  tr.setIntensity(intensity);
  tr.start(0, 0.05);
  tr.scheduleUntil(seconds - 0.4);
  tr.stop(seconds - 0.4, 0.35);
  return ctx.startRendering();
}

async function testMusic(track: PlayableTrack, intensity: number): Promise<TestRow> {
  const buf = await renderMusicBuf(track, intensity);
  const s = analyze(buf);
  return {
    name: `music:${track}${intensity ? '@' + intensity : ''}`,
    dur: r3(s.first >= 0 ? (s.last - s.first) / SR : 0),
    peak: r3(s.peak),
    rmsDb: r1(db(s.rms)),
    crest: r1(db(s.peak) - db(s.rms)),
    nan: s.nan,
    startJump: r3(s.startJump),
    endLevel: 0,
    tail: Math.round(s.tail * 1e5) / 1e5,
    click: r1(s.click),
    clickT: r3(s.clickT),
    zcHz: Math.round(s.zcHz),
    issues: issuesOf(s, null, 'music'),
  };
}

/**
 * Long render (exercises period/progression changes, motif regeneration, aulos phrases, fills) with an
 * intensity ramp 0 -> 1 applied while scheduling in 1 s chunks - like the live lookahead scheduler.
 */
async function testLong(track: PlayableTrack, seconds: number): Promise<TestRow> {
  const errs: string[] = [];
  const prevHook = trackDiagnostics.onError;
  trackDiagnostics.onError = (e) => errs.push(String(e));
  const len = Math.ceil((seconds + 3.45) * SR);
  const ctx = new OfflineAudioContext(2, len, SR);
  const mix = createMixer(ctx, ctx.destination, { finalStage: false });
  const tr = createTrack(track, ctx, mix.musicDry, mix.musicWet, 777);
  tr.start(0, 0.5);
  const ramp = track === 'battle' || track === 'boss';
  for (let t = 0; t < seconds - 0.5; t += 1) {
    const i = ramp ? Math.min(1, t / (seconds * 0.8)) : 0;
    tr.setIntensity(i);
    mix.musicTone.frequency.setValueAtTime(toneCutoff(track, i), t);
    tr.scheduleUntil(Math.min(t + 1, seconds - 0.5));
  }
  tr.stop(seconds - 0.5, 0.45);
  const s = analyze(await ctx.startRendering());
  trackDiagnostics.onError = prevHook;
  return rowOf(`long:${track}${ramp ? '(I 0->1)' : ''}`, s, errs);
}

/** Crossfade battle -> boss -> none in one render (checks the switching path for clicks). */
async function testCrossfade(): Promise<TestRow> {
  const errs: string[] = [];
  const prevHook = trackDiagnostics.onError;
  trackDiagnostics.onError = (e) => errs.push(String(e));
  const len = Math.ceil(14 * SR);
  const ctx = new OfflineAudioContext(2, len, SR);
  const mix = createMixer(ctx, ctx.destination, { finalStage: false });
  const a = createTrack('battle', ctx, mix.musicDry, mix.musicWet, 5);
  a.setIntensity(0.7);
  a.start(0, 0.3);
  a.scheduleUntil(4);
  a.stop(4, 1.5);
  const b = createTrack('boss', ctx, mix.musicDry, mix.musicWet, 6);
  b.setIntensity(0.4);
  b.start(4, 1.5);
  b.scheduleUntil(9.5);
  b.stop(9.5, 1.0);
  const s = analyze(await ctx.startRendering());
  trackDiagnostics.onError = prevHook;
  return rowOf('xfade:battle->boss->none', s, errs);
}

function rowOf(name: string, s: Stats, errs: string[]): TestRow {
  const issues = [issuesOf(s, null, 'music'), errs.length ? `ERR(${errs.length}): ${errs[0]}` : ''].filter(Boolean).join(' ');
  return {
    name, dur: r3(s.first >= 0 ? (s.last - s.first) / SR : 0), peak: r3(s.peak), rmsDb: r1(db(s.rms)),
    crest: r1(db(s.peak) - db(s.rms)), nan: s.nan, startJump: r3(s.startJump), endLevel: 0,
    tail: Math.round(s.tail * 1e5) / 1e5, click: r1(s.click), clickT: r3(s.clickT), zcHz: Math.round(s.zcHz), issues,
  };
}

/** Worst case through the real master chain at default volumes: intense battle + big hits + bigTotal. */
async function testMix(): Promise<TestRow> {
  const seconds = 6;
  const len = Math.ceil((seconds + 3.45) * SR);
  const ctx = new OfflineAudioContext(2, len, SR);
  const mix = createMixer(ctx, ctx.destination, { finalStage: true });
  mix.masterVol.gain.value = 0.8;
  mix.sfxVol.gain.value = mix.sfxVolW.gain.value = 0.8;
  mix.musicVol.gain.value = mix.musicVolW.gain.value = 0.55;
  mix.musicTone.frequency.value = toneCutoff('battle', 1);
  const tr = createTrack('battle', ctx, mix.musicDry, mix.musicWet, 99);
  tr.setIntensity(1);
  tr.start(0, 0.05);
  tr.scheduleUntil(seconds - 0.4);
  tr.stop(seconds - 0.4, 0.35);
  const bus = { ctx, out: mix.sfxDry, verb: mix.sfxWet };
  const kit = { p: 1, r: mulberry32(7), key: KEY };
  SFX.hitHeavy(bus, 1.0, kit);
  SFX.hitEarth(bus, 1.02, kit);
  SFX.xmult(bus, 1.5, kit);
  SFX.bigTotal(bus, 2.0, kit);
  SFX.bossRoar(bus, 3.5, kit);
  for (let i = 0; i < 8; i++) chipAt(bus, 0.2 + i * 0.07, kit, i);
  const s = analyze(await ctx.startRendering());
  return {
    name: 'MIX(final chain, defaults)', dur: r3((s.last - s.first) / SR), peak: r3(s.peak), rmsDb: r1(db(s.rms)),
    crest: r1(db(s.peak) - db(s.rms)), nan: s.nan, startJump: r3(s.startJump), endLevel: 0, tail: r3(s.tail), click: r1(s.click), clickT: r3(s.clickT), zcHz: Math.round(s.zcHz),
    issues: issuesOf(s, null, 'music'),
  };
}

function formatTable(rows: TestRow[]): string {
  const cols: (keyof TestRow)[] = ['name', 'dur', 'peak', 'rmsDb', 'crest', 'nan', 'startJump', 'endLevel', 'tail', 'click', 'clickT', 'zcHz', 'issues'];
  const w = cols.map((c) => Math.max(String(c).length, ...rows.map((r) => String(r[c]).length)));
  const line = (vals: string[]) => vals.map((v, i) => v.padEnd(w[i])).join(' | ');
  return [line(cols.map(String)), w.map((x) => '-'.repeat(x)).join('-+-'), ...rows.map((r) => line(cols.map((c) => String(r[c]))))].join('\n');
}

export interface SelfTestResult {
  rows: TestRow[];
  failures: string[];
  table: string;
  ms: number;
}

export async function runSelfTest(onRow?: (r: TestRow) => void, only?: readonly string[]): Promise<SelfTestResult> {
  setVoiceRandom(mulberry32(2024));
  try {
    return await runAll(onRow, only);
  } finally {
    setVoiceRandom(null);
  }
}

async function runAll(onRow?: (r: TestRow) => void, only?: readonly string[]): Promise<SelfTestResult> {
  // default: everything except the slow 32 s 'long:' renders; ['all'] = everything; otherwise name/prefix filter
  const all = !!only?.includes('all');
  const want = (n: string) =>
    all || (!only || only.length === 0 ? !n.startsWith('long:') : only.some((o) => n === o || n.startsWith(o)));
  const t0 = performance.now();
  const rows: TestRow[] = [];
  const push = (r: TestRow) => {
    rows.push(r);
    onRow?.(r);
  };
  for (const name of SFX_NAMES) if (want(name)) push(await testSfx(name, SFX[name]));
  const ticks: [string, SfxFn][] = [
    ['scoreTick(0)', (b, t, k) => chipAt(b, t, k, 0)],
    ['scoreTick(14)', (b, t, k) => chipAt(b, t, k, 14)],
    ['multTick(0)', (b, t, k) => multAt(b, t, k, 0)],
    ['multTick(12)', (b, t, k) => multAt(b, t, k, 12)],
  ];
  for (const [n, fn] of ticks) if (want(n)) push(await testSfx(n, fn));
  const tracks: [PlayableTrack, number][] = [
    ['title', 0], ['map', 0], ['shop', 0], ['battle', 0], ['battle', 1], ['boss', 0], ['boss', 1], ['victory', 0], ['defeat', 0],
  ];
  for (const [tr, i] of tracks) if (want(`music:${tr}${i ? '@' + i : ''}`)) push(await testMusic(tr, i));
  if (want('MIX')) push(await testMix());
  if (want('long:')) for (const tr of ['title', 'map', 'shop', 'battle', 'boss', 'victory', 'defeat'] as const) push(await testLong(tr, 32));
  if (want('xfade')) push(await testCrossfade());
  const failures = rows.filter((r) => r.issues).map((r) => `${r.name}: ${r.issues}`);
  return { rows, failures, table: formatTable(rows), ms: Math.round(performance.now() - t0) };
}
