(async () => {
  const { audio } = await import('/src/audio/audio.ts');
  const { SFX_NAMES } = await import('/src/audio/sfx.ts');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = [];
  const st = (label) => { const s = audio.getStats(); log.push(`${label.padEnd(26)} ready=${s.ready} state=${s.state} music=${s.music} I=${s.intensity} voices=${s.voices} errors=${s.errors} peak=${s.outPeak.toFixed(3)} rms=${s.outRms.toFixed(4)}`); return s; };
  // pre-init calls must be ignored silently
  audio.play('hover'); audio.scoreTick(3); audio.duck(); audio.setMusic('battle', 0.6); audio.setIntensity(0.3);
  st('pre-init');
  audio.init(); audio.init();
  await new Promise((r) => setTimeout(r, 200));
  // garbage inputs must be ignored / sanitized without errors
  audio.play('nonexistent'); audio.play('hover', { delay: NaN, volume: NaN, pitch: NaN, pan: NaN });
  audio.duck(NaN, NaN); audio.scoreTick(NaN); audio.multTick(-5); audio.setMusic('bogus'); audio.setIntensity(NaN);
  audio.setVolume('music', NaN); audio.play('coin', { pitch: 50, volume: 9, pan: 7, delay: -3 });
  await sleep(400);
  st('after init (battle wanted)');
  let maxRms = 0;
  for (let i = 0; i < 8; i++) { await sleep(250); maxRms = Math.max(maxRms, audio.getStats().outRms); }
  log.push(`battle@0.3 max rms over 2s = ${maxRms.toFixed(4)}`);
  for (const n of SFX_NAMES) { audio.play(n, { volume: 0.9, pitch: 1 + (Math.random() - 0.5) * 0.1, pan: (Math.random() - 0.5) }); await sleep(45); }
  st('after all SFX queued');
  let peakDuring = 0;
  for (let i = 0; i < 16; i++) { await sleep(250); peakDuring = Math.max(peakDuring, audio.getStats().outPeak); }
  log.push(`peak while SFX ring out = ${peakDuring.toFixed(3)}`);
  audio.setIntensity(1);
  for (let i = 0; i < 14; i++) { audio.scoreTick(i); await sleep(40); }
  for (let i = 0; i < 6; i++) { audio.multTick(i); await sleep(60); }
  audio.play('bigTotal');
  audio.duck(0.8, 1);
  await sleep(1500);
  st('intensity 1 + ticks');
  audio.setMusic('boss');
  await sleep(2500);
  st('boss');
  audio.setVolume('music', 0.3); audio.setVolume('sfx', 0.7);
  st('volumes set');
  audio.setMuted(true); await sleep(300); st('muted');
  audio.setMuted(false); await sleep(300);
  audio.setMusic('none', 1);
  await sleep(4500);
  st('none (should be ~silent)');
  log.push('stored=' + localStorage.getItem('dodek.audio'));
  audio.setVolume('music', 0.55); audio.setVolume('sfx', 0.8);
  return log.join('\n');
})()
