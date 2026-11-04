(async () => {
  const { SFX } = await import('/src/audio/sfx.ts');
  const { mulberry32, MODES } = await import('/src/audio/dsp.ts');
  const name = window.__dbgName || 'apotheosis';
  const SR = 48000;
  const ctx = new OfflineAudioContext(2, SR * 1, SR);
  SFX[name]({ ctx, out: ctx.destination, verb: null }, 0.05, { p: 1, r: mulberry32(42), key: { root: 62, mode: MODES.dorian } });
  const buf = await ctx.startRendering();
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  let best = 0, bi = 0;
  for (let i = 2; i < L.length; i++) {
    const x = (a) => (L[a] + R[a]) / 2;
    const d2 = Math.abs(x(i) - 2 * x(i - 1) + x(i - 2));
    if (d2 > best) { best = d2; bi = i; }
  }
  const rows = [];
  for (let i = bi - 6; i <= bi + 6; i++) rows.push(`${i} ${(i / SR).toFixed(5)} L=${L[i].toFixed(5)} R=${R[i].toFixed(5)}`);
  let first = -1; for (let i = 0; i < L.length; i++) if (Math.abs(L[i]) > 1e-4 || Math.abs(R[i]) > 1e-4) { first = i; break; }
  const on = [];
  for (let i = first - 2; i < first + 14; i++) on.push(`${i} L=${L[i].toFixed(5)} R=${R[i].toFixed(5)}`);
  return `maxd2=${best.toFixed(5)} at ${bi} (${(bi / SR).toFixed(4)}s)\n` + rows.join('\n') + '\nonset:\n' + on.join('\n');
})()
