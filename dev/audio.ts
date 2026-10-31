import { audio, type MusicTrack, type SfxName } from '../src/audio/audio';
import { SFX_NAMES } from '../src/audio/sfx';
import { runSelfTest, type SelfTestResult } from '../src/audio/selftest';

const $ = (id: string) => document.getElementById(id) as HTMLElement;
const status = $('status');

function btn(parent: HTMLElement, label: string, onClick: (b: HTMLButtonElement) => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.addEventListener('click', () => {
    audio.init();
    onClick(b);
  });
  parent.appendChild(b);
  return b;
}

function slider(parent: HTMLElement, label: string, value: number, onInput: (v: number) => void): void {
  const l = document.createElement('label');
  l.textContent = label;
  const s = document.createElement('input');
  s.type = 'range';
  s.min = '0';
  s.max = '1';
  s.step = '0.01';
  s.value = String(value);
  const out = document.createElement('span');
  out.textContent = Number(value).toFixed(2);
  s.addEventListener('input', () => {
    onInput(Number(s.value));
    out.textContent = Number(s.value).toFixed(2);
  });
  l.append(s, out);
  parent.appendChild(l);
}

$('init').addEventListener('click', () => audio.init());
setInterval(() => {
  status.textContent = audio.ready ? `running - music: ${audio.music}` : 'not initialized (click anything)';
}, 250);

// mixer
const mixer = $('mixer');
for (const k of ['master', 'music', 'sfx'] as const) slider(mixer, k, audio.getVolume(k), (v) => audio.setVolume(k, v));
slider(mixer, 'intensity', 0, (v) => audio.setIntensity(v));
btn(mixer, 'mute', (b) => {
  audio.setMuted(!audio.isMuted());
  b.classList.toggle('on', audio.isMuted());
});
btn(mixer, 'duck 0.6 / 1s', () => audio.duck(0.6, 1));

// music
const tracks: MusicTrack[] = ['none', 'title', 'map', 'battle', 'boss', 'shop', 'victory', 'defeat'];
const musicBtns: HTMLButtonElement[] = [];
for (const tr of tracks) {
  musicBtns.push(
    btn($('music'), tr, (b) => {
      audio.setMusic(tr);
      musicBtns.forEach((x) => x.classList.toggle('on', x === b));
    }),
  );
}

// ticks
btn($('ticks'), 'score count-up x12', () => {
  for (let i = 0; i < 12; i++) setTimeout(() => audio.scoreTick(i), i * 90);
});
btn($('ticks'), 'mult count-up x8', () => {
  for (let i = 0; i < 8; i++) setTimeout(() => audio.multTick(i), i * 140);
});
btn($('ticks'), 'full hand (chips -> mult -> total)', () => {
  for (let i = 0; i < 6; i++) setTimeout(() => audio.scoreTick(i), i * 110);
  for (let i = 0; i < 3; i++) setTimeout(() => audio.multTick(i), 750 + i * 160);
  setTimeout(() => audio.play('xmult'), 1300);
  setTimeout(() => audio.play('total'), 1900);
});

// sfx
for (const name of SFX_NAMES) btn($('sfx'), name, () => audio.play(name as SfxName));

// self-test
async function selfTest(only?: string[]): Promise<{ ms: number; failures: string[]; rows: (string | number | boolean)[][] }> {
  const out = $('out');
  out.textContent = 'rendering...';
  const res: SelfTestResult = await runSelfTest((r) => {
    out.textContent += `\n${r.name}`;
  }, only);
  out.innerHTML = '';
  out.textContent = res.table + `\n\n${res.rows.length} rows in ${res.ms} ms. Failures: ${res.failures.length ? res.failures.join('; ') : 'none'}`;
  if (res.failures.length) out.classList.add('bad');
  console.log('[audio self-test]\n' + res.table);
  return {
    ms: res.ms,
    failures: res.failures,
    rows: res.rows.map((r) => [r.name, r.dur, r.peak, r.rmsDb, r.nan, r.startJump, r.endLevel, r.click, r.clickT, r.issues]),
  };
}
$('selftest').addEventListener('click', () => void selfTest());
// console / headless: __audioSelfTest() = all SFX + 6 s tracks + mix + crossfade (~35 s);
// __audioSelfTest(['all']) adds 32 s generative runs; __audioSelfTest(['bossRoar', 'music:boss', 'long:']) = subset
(window as unknown as { __audioSelfTest: typeof selfTest }).__audioSelfTest = selfTest;

/**
 * Live-engine smoke test (real AudioContext; headless Chrome needs --autoplay-policy=no-user-gesture-required):
 * pre-init calls, garbage inputs, music + intensity, every SFX stacked, ticks, duck, crossfade, mute, persistence.
 * Returns a text log with output meter readings.
 */
async function liveSmoke(): Promise<string> {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const log: string[] = [];
  const st = (label: string) => {
    const s = audio.getStats();
    log.push(`${label.padEnd(26)} ready=${s.ready} state=${s.state} music=${s.music} I=${s.intensity} voices=${s.voices} errors=${s.errors} peak=${s.outPeak.toFixed(3)} rms=${s.outRms.toFixed(4)}`);
  };
  const before = { music: audio.getVolume('music'), sfx: audio.getVolume('sfx') };
  audio.play('hover');
  audio.scoreTick(3);
  audio.duck();
  audio.setMusic('battle', 0.6);
  audio.setIntensity(0.3);
  st('pre-init');
  audio.init();
  audio.init();
  await sleep(300);
  const junk = audio as unknown as { play(n: string, o?: object): void; setMusic(t: string): void };
  junk.play('nonexistent');
  audio.play('hover', { delay: NaN, volume: NaN, pitch: NaN, pan: NaN });
  audio.duck(NaN, NaN);
  audio.scoreTick(NaN);
  junk.setMusic('bogus');
  audio.setIntensity(NaN);
  audio.play('coin', { pitch: 50, volume: 9, pan: 7, delay: -3 });
  st('after init + junk input');
  let maxRms = 0;
  for (let i = 0; i < 8; i++) {
    await sleep(250);
    maxRms = Math.max(maxRms, audio.getStats().outRms);
  }
  log.push(`battle@0.3 max out rms over 2 s = ${maxRms.toFixed(4)}`);
  for (const n of SFX_NAMES) {
    audio.play(n as SfxName, { volume: 0.9, pitch: 1 + (Math.random() - 0.5) * 0.1, pan: Math.random() - 0.5 });
    await sleep(45);
  }
  st('all SFX queued');
  let peak = 0;
  for (let i = 0; i < 16; i++) {
    await sleep(250);
    peak = Math.max(peak, audio.getStats().outPeak);
  }
  log.push(`max out peak while SFX ring out = ${peak.toFixed(3)}`);
  audio.setIntensity(1);
  for (let i = 0; i < 14; i++) {
    audio.scoreTick(i);
    await sleep(40);
  }
  for (let i = 0; i < 6; i++) {
    audio.multTick(i);
    await sleep(60);
  }
  audio.play('bigTotal');
  await sleep(1500);
  st('intensity 1 + ticks');
  audio.setMusic('boss');
  await sleep(2500);
  st('boss');
  audio.setMuted(true);
  await sleep(300);
  st('muted');
  audio.setMuted(false);
  audio.setMusic('none', 1);
  await sleep(4500);
  st('none (expect silence)');
  audio.setVolume('music', before.music);
  audio.setVolume('sfx', before.sfx);
  log.push('stored=' + localStorage.getItem('dodek.audio'));
  return log.join('\n');
}
(window as unknown as { __audioLiveSmoke: typeof liveSmoke }).__audioLiveSmoke = liveSmoke;
