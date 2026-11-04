(async () => {
  const { SFX } = await import('/src/audio/sfx.ts');
  const { mulberry32, MODES } = await import('/src/audio/dsp.ts');
  const { setVoiceRandom } = await import('/src/audio/voices.ts');
  setVoiceRandom(mulberry32(2024));
  const name = 'apotheosis';
  const SR = 48000;
  const ctx = new OfflineAudioContext(2, SR * 1, SR);
  SFX[name]({ ctx, out: ctx.destination, verb: null }, 0.05, { p: 1, r: mulberry32(42), key: { root: 62, mode: MODES.dorian } });
  const buf = await ctx.startRendering();
  setVoiceRandom(null);
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  const x = (a) => (L[a] + R[a]) / 2;
  let best = 0, bi = 0;
  for (let i = 2304; i < 2560; i++) { const d2 = Math.abs(x(i) - 2 * x(i - 1) + x(i - 2)); if (d2 > best) { best = d2; bi = i; } }
  const rows = [];
  for (let i = bi - 5; i <= bi + 5; i++) rows.push(`${i} L=${L[i].toFixed(5)} R=${R[i].toFixed(5)} d2=${(x(i) - 2 * x(i - 1) + x(i - 2)).toFixed(5)}`);
  let s2 = 0; for (let i = 2560; i < 2816; i++) { const d2 = x(i) - 2 * x(i - 1) + x(i - 2); s2 += d2 * d2; }
  return `block9 maxd2=${best.toFixed(5)} at ${bi}; next block d2rms=${Math.sqrt(s2 / 256).toFixed(6)}\n` + rows.join('\n');
})()
