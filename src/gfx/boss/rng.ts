// Small deterministic helpers (seeded RNG + value noise) for the constellation creatures.

export type Rand = () => number;

/** mulberry32: tiny, fast, good enough for sampling. */
export function mulberry32(seed: number): Rand {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hash2(ix: number, iy: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** 2D value noise in [0,1]. */
export function vnoise(x: number, y: number, seed = 0): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

/** fractal value noise in ~[0,1]. */
export function fbm(x: number, y: number, seed = 0, oct = 4): number {
  let s = 0;
  let amp = 0.5;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    s += vnoise(x, y, seed + i * 17) * amp;
    norm += amp;
    x = x * 2.03 + 11.7;
    y = y * 2.03 - 7.3;
    amp *= 0.5;
  }
  return s / norm;
}

/** ridged noise: thin bright filaments (nebula wisps). */
export function ridged(x: number, y: number, seed = 0, oct = 3): number {
  let s = 0;
  let amp = 0.6;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    const n = 1 - Math.abs(vnoise(x, y, seed + i * 31) * 2 - 1);
    s += n * n * amp;
    norm += amp;
    x = x * 2.1 + 3.1;
    y = y * 2.1 + 1.7;
    amp *= 0.5;
  }
  return s / norm;
}
