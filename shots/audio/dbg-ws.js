(async () => {
  const { boom } = await import('/src/audio/instruments.ts');
  const { tone } = await import('/src/audio/voices.ts');
  const SR = 48000;
  const out = [];
  async function probe(label, fn) {
    const ctx = new OfflineAudioContext(2, SR / 2, SR);
    fn({ ctx, out: ctx.destination, verb: null });
    const buf = await ctx.startRendering();
    const L = buf.getChannelData(0);
    let best = 0, bi = 0, first = -1;
    for (let i = 2; i < L.length; i++) {
      if (first < 0 && Math.abs(L[i]) > 1e-4) first = i;
      const d2 = Math.abs(L[i] - 2 * L[i - 1] + L[i - 2]);
      if (d2 > best) { best = d2; bi = i; }
    }
    out.push(`${label}: first=${first} maxd2=${best.toFixed(5)} at ${bi} (+${bi - 2400})`);
  }
  await probe('boom drive1.3', (b) => boom(b, 0.05, 0.5, { f0: 90, f1: 32, d: 1.5, drive: 1.3 }));
  await probe('boom nodrive', (b) => boom(b, 0.05, 0.5, { f0: 90, f1: 32, d: 1.5 }));
  await probe('tone drive', (b) => tone(b, { t: 0.05, f: 90, f2: 32, glide: 0.75, v: 0.5, a: 0.002, d: 1.5, drive: 1.3 }));
  await probe('tone nodrive', (b) => tone(b, { t: 0.05, f: 90, f2: 32, glide: 0.75, v: 0.5, a: 0.002, d: 1.5 }));
  return out.join('\n');
})()
