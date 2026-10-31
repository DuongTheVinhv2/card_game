// Shared low-level helpers for the procedural painters: seeded RNG, value noise,
// colour math, offscreen canvases, rounded rects and text fitting.

export type Ctx = CanvasRenderingContext2D;

// ───────────────────────────── random ─────────────────────────────

export function mulberry32(seed: number): () => number {
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
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** 2D value noise (smooth, 0..1) with fbm helper */
export function makeNoise(seed: number) {
  const rnd = mulberry32(seed);
  const P = new Uint8Array(512);
  const V = new Float32Array(256);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
  for (let i = 0; i < 256; i++) V[i] = rnd();
  const noise = (x: number, y: number): number => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const X = xi & 255, Y = yi & 255;
    const a = V[P[P[X] + Y]], b = V[P[P[X + 1] + Y]], c = V[P[P[X] + Y + 1]], d = V[P[P[X + 1] + Y + 1]];
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x: number, y: number, oct = 4, lac = 2.03, gain = 0.5): number => {
    let s = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      s += amp * noise(x * f + i * 17.3, y * f - i * 9.1);
      norm += amp;
      amp *= gain;
      f *= lac;
    }
    return s / norm;
  };
  return { noise, fbm };
}

// ───────────────────────────── colour ─────────────────────────────

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgbToHex([r, g, b]: RGB): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}
/** amt > 0 → toward white, amt < 0 → toward black */
export function shade(hex: string, amt: number): string {
  return amt >= 0 ? mix(hex, '#ffffff', amt) : mix(hex, '#000000', -amt);
}

// ───────────────────────────── canvases ─────────────────────────────

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  return [c, g];
}

const cache = new Map<string, HTMLCanvasElement>();
/** set `globalThis.__ART_PROFILE = true` to log every cached layer build time */
const profiling = () => (globalThis as { __ART_PROFILE?: boolean }).__ART_PROFILE === true;
/** memoised offscreen layer */
export function cached(key: string, w: number, h: number, paint: (g: Ctx) => void): HTMLCanvasElement {
  let c = cache.get(key);
  if (!c) {
    const t0 = profiling() ? performance.now() : 0;
    const [cv, g] = makeCanvas(w, h);
    paint(g);
    cache.set(key, cv);
    c = cv;
    if (t0) console.log(`[art] built ${key} in ${(performance.now() - t0).toFixed(1)}ms`);
  }
  return c;
}
export function clearArtCache(): void {
  cache.clear();
}

// ───────────────────────────── shapes ─────────────────────────────

export function rrPath(g: Ctx | Path2D, x: number, y: number, w: number, h: number, r: number): void {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.arcTo(x + w, y, x + w, y + r, r);
  g.lineTo(x + w, y + h - r);
  g.arcTo(x + w, y + h, x + w - r, y + h, r);
  g.lineTo(x + r, y + h);
  g.arcTo(x, y + h, x, y + h - r, r);
  g.lineTo(x, y + r);
  g.arcTo(x, y, x + r, y, r);
  g.closePath();
}
export function rr(x: number, y: number, w: number, h: number, r: number): Path2D {
  const p = new Path2D();
  rrPath(p, x, y, w, h, r);
  return p;
}

// ───────────────────────────── text ─────────────────────────────

export function font(weight: number | string, size: number, family: string): string {
  return `${weight} ${size.toFixed(1)}px ${family}`;
}

/** largest font size (<= maxSize) so that text fits maxW; returns size */
export function fitText(g: Ctx, text: string, weight: number | string, family: string, maxSize: number, maxW: number, minSize = 8, spacing = 0): number {
  let size = maxSize;
  for (let i = 0; i < 40 && size > minSize; i++) {
    g.font = font(weight, size, family);
    const w = g.measureText(text).width + spacing * size * Math.max(0, text.length - 1);
    if (w <= maxW) break;
    size *= Math.max(0.8, Math.min(0.985, maxW / w));
  }
  return Math.max(minSize, size);
}

/** draw text with manual letter spacing (em fraction), centred at x */
export function spacedText(g: Ctx, text: string, x: number, y: number, spacingEm: number, mode: 'fill' | 'stroke' = 'fill'): number {
  const size = parseFloat(/(\d+(?:\.\d+)?)px/.exec(g.font)?.[1] ?? '16');
  const sp = spacingEm * size;
  const widths = [...text].map((ch) => g.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + sp * Math.max(0, text.length - 1);
  const prevAlign = g.textAlign;
  g.textAlign = 'left';
  let cx = x - total / 2;
  [...text].forEach((ch, i) => {
    if (mode === 'fill') g.fillText(ch, cx, y);
    else g.strokeText(ch, cx, y);
    cx += widths[i] + sp;
  });
  g.textAlign = prevAlign;
  return total;
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const TAU = Math.PI * 2;
