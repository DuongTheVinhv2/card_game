// Decorative building blocks: metal gradients, Greek key bands, laurel, rays,
// palmettes, ribbons and medallions.
import { IconB, mirrorX, leaf, strokeD, circle, join, rot as rotShape, type Shape, type Pt } from '../pathKit';
import { laurelBranch } from '../iconDefs';
import { rgba, type Ctx, TAU } from './util';

export type Metal = 'gold' | 'paleGold' | 'bronze' | 'silver' | 'pearl' | 'ice' | 'slate' | 'iron';

const STOPS: Record<Metal, [number, string][]> = {
  gold: [[0, '#7a5414'], [0.16, '#e8c15a'], [0.3, '#fff2b5'], [0.48, '#d6a23c'], [0.66, '#8f6418'], [0.84, '#f2cf6b'], [1, '#9c6f1d']],
  paleGold: [[0, '#a98a4a'], [0.2, '#f3e2a8'], [0.36, '#fffbea'], [0.55, '#e6cc86'], [0.75, '#b8975a'], [0.9, '#f7e9bd'], [1, '#c4a466']],
  bronze: [[0, '#4a240e'], [0.18, '#b06a34'], [0.33, '#f3b884'], [0.5, '#a35a28'], [0.68, '#5e2f12'], [0.85, '#d18f58'], [1, '#6e3a17']],
  silver: [[0, '#5c6878'], [0.18, '#c9d4e2'], [0.32, '#ffffff'], [0.5, '#a9b6c8'], [0.68, '#6b7788'], [0.85, '#e3eaf4'], [1, '#7d8a9c']],
  pearl: [[0, '#b9c3dc'], [0.25, '#ffffff'], [0.5, '#dfe4f4'], [0.72, '#fff4f8'], [1, '#c4cde4']],
  ice: [[0, '#4f98c4'], [0.22, '#d8f3ff'], [0.38, '#ffffff'], [0.58, '#93cff0'], [0.8, '#e8faff'], [1, '#5fa8d0']],
  slate: [[0, '#3b4048'], [0.25, '#8d939c'], [0.42, '#cfd3d8'], [0.6, '#7a8089'], [0.8, '#a8adb5'], [1, '#4a5058']],
  iron: [[0, '#1b1a1a'], [0.3, '#5a5552'], [0.45, '#8c857e'], [0.65, '#3a3634'], [1, '#1d1b1a']],
};

export function metalGrad(g: Ctx, x0: number, y0: number, x1: number, y1: number, m: Metal): CanvasGradient {
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of STOPS[m]) gr.addColorStop(o, c);
  return gr;
}
/** representative mid colour of a metal (for flat strokes) */
export const METAL_MID: Record<Metal, string> = {
  gold: '#c9962f', paleGold: '#d9bf7f', bronze: '#a35a28', silver: '#a9b6c8', pearl: '#dfe4f4', ice: '#93cff0', slate: '#7a8089', iron: '#4a4542',
};
const ICON_STOPS: Record<Metal, [string, string, string, string]> = {
  gold: ['#fff6cf', '#f2cb5e', '#c08a2a', '#6e4910'],
  paleGold: ['#fffbea', '#f3e2a8', '#c9ab6a', '#80632f'],
  bronze: ['#ffdcb8', '#eba468', '#ac5e29', '#55270e'],
  silver: ['#ffffff', '#e2e9f2', '#9fadc1', '#55627a'],
  pearl: ['#ffffff', '#eef0fa', '#c4cbe2', '#7e88a8'],
  ice: ['#ffffff', '#cdefff', '#6fb8e0', '#2a6690'],
  slate: ['#eceff3', '#adb3bc', '#6b717a', '#2f3339'],
  iron: ['#bdb6ae', '#7a736c', '#3d3835', '#151312'],
};
/** clean vertical metal fill for large icons / glyphs (top light → bottom dark) */
export function iconFill(g: Ctx, x: number, y: number, s: number, m: Metal): CanvasGradient {
  const st = ICON_STOPS[m];
  const gr = g.createLinearGradient(x, y, x + s * 0.18, y + s);
  gr.addColorStop(0, st[0]);
  gr.addColorStop(0.36, st[1]);
  gr.addColorStop(0.72, st[2]);
  gr.addColorStop(1, st[3]);
  return gr;
}

/** fill a path with metal + soft top sheen + dark rim */
export function metalIcon(g: Ctx, p: Path2D, x: number, y: number, s: number, m: Metal, glow?: string, glowBlur = 24): void {
  g.save();
  if (glow) {
    g.shadowColor = glow;
    g.shadowBlur = glowBlur;
  }
  g.fillStyle = iconFill(g, x, y, s, m);
  g.fill(p);
  g.restore();
  g.save();
  g.clip(p);
  const sh = g.createLinearGradient(x, y, x + s * 0.5, y + s * 0.62);
  sh.addColorStop(0, 'rgba(255,255,255,0.38)');
  sh.addColorStop(0.42, 'rgba(255,255,255,0.06)');
  sh.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.fillStyle = sh;
  g.fillRect(x, y, s, s);
  g.restore();
  g.lineWidth = Math.max(1.2, s * 0.009);
  g.strokeStyle = rgba(METAL_DARK[m], 0.9);
  g.stroke(p);
}

export const METAL_DARK: Record<Metal, string> = {
  gold: '#5a3c0c', paleGold: '#7d6332', bronze: '#3a1a08', silver: '#3f4a58', pearl: '#7e88a8', ice: '#2d6a92', slate: '#2a2e34', iron: '#0e0d0d',
};

export function shapePath(s: Shape | IconB): Path2D {
  const b = s instanceof IconB ? s : new IconB().add(s);
  return new Path2D(b.d());
}

// ───────────────────────────── Greek key ─────────────────────────────

/**
 * Running meander (Greek key) band inside the rect. `rules` adds thin lines along both edges.
 * The key line weight equals one grid cell; the pattern is fitted to an integer number of keys.
 */
export function meanderBand(
  g: Ctx, x: number, y: number, w: number, h: number, color: string | CanvasGradient,
  opts: { rules?: boolean; weight?: number; bg?: string | CanvasGradient; pad?: number; vertical?: boolean } = {},
): void {
  g.save();
  if (opts.vertical) {
    // draw as horizontal band rotated 90° around the rect
    g.translate(x + w, y);
    g.rotate(Math.PI / 2);
    meanderBand(g, 0, 0, h, w, color, { ...opts, vertical: false });
    g.restore();
    return;
  }
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  if (opts.bg) {
    g.fillStyle = opts.bg;
    g.fillRect(x, y, w, h);
  }
  const rules = opts.rules !== false;
  const ruleW = rules ? Math.max(1, h * 0.075) : 0;
  const pad = opts.pad ?? (rules ? h * 0.13 : h * 0.04);
  const inner = h - 2 * (ruleW + pad);
  const cy = inner / 5;
  const n = Math.max(1, Math.round(w / (cy * 6)));
  const u = w / n;
  const cx = u / 6;
  const top = y + (h - inner) / 2;
  g.beginPath();
  g.moveTo(x - u, top + 4.5 * cy);
  for (let k = 0; k <= n; k++) {
    const ox = x + k * u;
    g.lineTo(ox + 0.5 * cx, top + 4.5 * cy);
    g.lineTo(ox + 0.5 * cx, top + 0.5 * cy);
    g.lineTo(ox + 4.5 * cx, top + 0.5 * cy);
    g.lineTo(ox + 4.5 * cx, top + 2.5 * cy);
    g.lineTo(ox + 2.5 * cx, top + 2.5 * cy);
    g.lineTo(ox + 2.5 * cx, top + 4.5 * cy);
  }
  g.lineTo(x + w + u, top + 4.5 * cy);
  g.lineWidth = Math.min(cx, cy) * (opts.weight ?? 0.92);
  g.lineJoin = 'miter';
  g.lineCap = 'butt';
  g.strokeStyle = color;
  g.stroke();
  if (rules) {
    g.fillStyle = color;
    g.fillRect(x, y, w, ruleW);
    g.fillRect(x, y + h - ruleW, w, ruleW);
  }
  g.restore();
}

/** Greek key running around a ring (kylix tondo border) between radii r0 < r1 */
export function meanderRing(g: Ctx, cx: number, cy: number, r0: number, r1: number, color: string | CanvasGradient, rules = true): void {
  const band = r1 - r0;
  const ruleW = rules ? Math.max(1, band * 0.075) : 0;
  const pad = rules ? band * 0.13 : band * 0.04;
  const ri = r0 + ruleW + pad, ro = r1 - ruleW - pad;
  const cell = (ro - ri) / 5;
  const rm = (ri + ro) / 2;
  const n = Math.max(6, Math.round((TAU * rm) / (cell * 6)));
  const map = (u: number, v: number): [number, number] => {
    const a = (u / (6 * n)) * TAU - Math.PI / 2;
    const r = ri + (v / 5) * (ro - ri);
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  const pts: [number, number][] = [];
  const unit: [number, number][] = [[0.5, 0.5], [0.5, 4.5], [4.5, 4.5], [4.5, 2.5], [2.5, 2.5], [2.5, 0.5], [6.5, 0.5]];
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < unit.length - 1; i++) {
      const [u0, v0] = unit[i], [u1, v1] = unit[i + 1];
      const steps = Math.max(1, Math.round(Math.abs(u1 - u0) * 3));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        pts.push(map(k * 6 + u0 + (u1 - u0) * t, v0 + (v1 - v0) * t));
      }
    }
  }
  g.save();
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.lineWidth = cell * 0.92;
  g.lineJoin = 'miter';
  g.strokeStyle = color;
  g.stroke();
  if (rules) {
    g.lineWidth = ruleW;
    g.beginPath();
    g.arc(cx, cy, r0 + ruleW / 2, 0, TAU);
    g.stroke();
    g.beginPath();
    g.arc(cx, cy, r1 - ruleW / 2, 0, TAU);
    g.stroke();
  }
  g.restore();
}

// ───────────────────────────── laurel ─────────────────────────────

const laurelCache = new Map<string, Path2D>();
/** laurel wreath (two mirrored branches) as Path2D in canvas coordinates */
export function laurelPath(cx: number, cy: number, r: number, opts: { a0?: number; a1?: number; n?: number; len?: number; w?: number; stemFrom?: number; one?: boolean } = {}): Path2D {
  const key = JSON.stringify([cx, cy, r, opts]);
  let p = laurelCache.get(key);
  if (!p) {
    const br = laurelBranch(cx, cy, r, opts.a0 ?? 100, opts.a1 ?? 238, opts.n ?? 6, opts.len ?? r * 0.42, opts.w ?? r * 0.2, opts.stemFrom ?? opts.a0 ?? 100);
    const b = new IconB().add(br);
    if (!opts.one) b.add(mirrorX(br, cx));
    p = new Path2D(b.d());
    laurelCache.set(key, p);
  }
  return p;
}

/** straight laurel sprig from (x,y) pointing at angle (deg), length L */
export function sprigPath(x: number, y: number, angleDeg: number, L: number, w: number, pairs = 4): Path2D {
  const parts: Shape[] = [strokeD(`M0 0 L${L} 0`, Math.max(1.2, w * 0.28), 'round')];
  for (let i = 0; i < pairs; i++) {
    const t = (i + 0.4) / (pairs + 0.3);
    const px = L * t;
    const ll = w * 2.1 * (1 - t * 0.35);
    parts.push(leaf(px, 0, px + ll * 0.8, -ll * 0.62, w * (1 - t * 0.25)));
    parts.push(leaf(px, 0, px + ll * 0.8, ll * 0.62, w * (1 - t * 0.25)));
  }
  parts.push(leaf(L, 0, L + w * 2, 0, w * 0.9));
  let s = join(...parts);
  s = rotShape(s, angleDeg, 0, 0);
  const b = new IconB().add(s.map((p) => ({ sub: p.sub.map(([px, py]): Pt => [px + x, py + y]), solid: p.solid })));
  return new Path2D(b.d());
}

// ───────────────────────────── rays / sunburst ─────────────────────────────

export function sunburst(g: Ctx, cx: number, cy: number, r0: number, r1: number, n: number, fill: string | CanvasGradient, widthFrac = 0.35, alt = 0.72): void {
  g.save();
  g.fillStyle = fill;
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU - Math.PI / 2;
    const hw = (Math.PI / n) * widthFrac;
    const R = i % 2 ? r0 + (r1 - r0) * alt : r1;
    g.moveTo(cx + Math.cos(a - hw) * r0, cy + Math.sin(a - hw) * r0);
    g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    g.lineTo(cx + Math.cos(a + hw) * r0, cy + Math.sin(a + hw) * r0);
    g.closePath();
  }
  g.fill();
  g.restore();
}

// ───────────────────────────── palmette ─────────────────────────────

const anthCache = new Map<number, Path2D>();
/** anthemion / palmette in a 100x100 box, base at (50, 92), fanning upward */
export function anthemionPath(petals = 7): Path2D {
  let p = anthCache.get(petals);
  if (!p) {
    const b = new IconB();
    for (let i = 0; i < petals; i++) {
      const t = petals === 1 ? 0.5 : i / (petals - 1);
      const a = -90 + (t - 0.5) * 150;
      const L = 58 + 26 * Math.cos((t - 0.5) * Math.PI);
      const ar = (a * Math.PI) / 180;
      const bx = 50 + Math.cos(ar) * 8, by = 70 + Math.sin(ar) * 8;
      b.add(leaf(bx, by, 50 + Math.cos(ar) * L, 74 + Math.sin(ar) * L, 13 - Math.abs(t - 0.5) * 6, 0.62));
    }
    b.add(circle(50, 72, 7));
    b.add(strokeD('M50 78 C40 80 30 84 26 92 C24 97 30 99 33 95', 5, 'round'));
    b.add(strokeD('M50 78 C60 80 70 84 74 92 C76 97 70 99 67 95', 5, 'round'));
    p = new Path2D(b.d());
    anthCache.set(petals, p);
  }
  return p;
}

export function drawAnthemion(g: Ctx, cx: number, cy: number, size: number, fill: string | CanvasGradient, angleDeg = 0): void {
  g.save();
  g.translate(cx, cy);
  g.rotate((angleDeg * Math.PI) / 180);
  g.scale(size / 100, size / 100);
  g.translate(-50, -50);
  g.fillStyle = fill;
  g.fill(anthemionPath());
  g.restore();
}

// ───────────────────────────── ribbon banner ─────────────────────────────

/** ribbon with folded, notched tails. Returns the face rect for text. */
export function ribbon(
  g: Ctx, cx: number, cy: number, w: number, h: number,
  face: string | CanvasGradient, back: string, edge: string | CanvasGradient,
): { x: number; y: number; w: number; h: number } {
  const x = cx - w / 2, y = cy - h / 2;
  const tail = Math.min(h * 0.9, 44), drop = Math.min(h * 0.32, 15), notch = Math.min(h * 0.38, 18);
  g.save();
  // tails
  g.fillStyle = back;
  for (const s of [-1, 1]) {
    const ex = s < 0 ? x : x + w;
    g.beginPath();
    g.moveTo(ex - s * h * 0.3, y + drop);
    g.lineTo(ex + s * tail, y + drop);
    g.lineTo(ex + s * (tail - notch), y + drop + h / 2);
    g.lineTo(ex + s * tail, y + drop + h);
    g.lineTo(ex - s * h * 0.3, y + drop + h);
    g.closePath();
    g.fill();
    g.strokeStyle = edge;
    g.lineWidth = 1.6;
    g.stroke();
    // fold shadow
    g.beginPath();
    g.moveTo(ex, y + h);
    g.lineTo(ex + s * h * 0.42, y + drop + h);
    g.lineTo(ex, y + drop + h);
    g.closePath();
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fill();
    g.fillStyle = back;
  }
  // face with slight arch
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(cx, y - h * 0.12, x + w, y);
  g.lineTo(x + w, y + h);
  g.quadraticCurveTo(cx, y + h - h * 0.12, x, y + h);
  g.closePath();
  g.fillStyle = face;
  g.shadowColor = 'rgba(0,0,0,0.35)';
  g.shadowBlur = 6;
  g.shadowOffsetY = 2;
  g.fill();
  g.shadowColor = 'transparent';
  g.lineWidth = 2;
  g.strokeStyle = edge;
  g.stroke();
  g.restore();
  return { x, y, w, h };
}

// ───────────────────────────── medallion ─────────────────────────────

export function medallion(g: Ctx, cx: number, cy: number, r: number, metal: Metal, inner: string | CanvasGradient, ringFrac = 0.16): void {
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.35)';
  g.shadowBlur = r * 0.18;
  g.shadowOffsetY = r * 0.06;
  g.beginPath();
  g.arc(cx, cy, r, 0, TAU);
  g.fillStyle = metalGrad(g, cx - r, cy - r, cx + r, cy + r, metal);
  g.fill();
  g.shadowColor = 'transparent';
  const ri = r * (1 - ringFrac);
  g.beginPath();
  g.arc(cx, cy, ri, 0, TAU);
  g.fillStyle = inner;
  g.fill();
  // inner bevel: dark top-left, light bottom-right
  g.lineWidth = Math.max(1, r * 0.05);
  g.strokeStyle = metalGrad(g, cx + ri, cy + ri, cx - ri, cy - ri, metal);
  g.stroke();
  g.beginPath();
  g.arc(cx, cy, r - 0.5, 0, TAU);
  g.lineWidth = 1;
  g.strokeStyle = rgba('#000000', 0.35);
  g.stroke();
  g.restore();
}

/** small round stud / rivet */
export function rivet(g: Ctx, x: number, y: number, r: number, metal: Metal): void {
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
  const st = STOPS[metal];
  gr.addColorStop(0, '#ffffff');
  gr.addColorStop(0.35, st[2][1]);
  gr.addColorStop(1, st[0][1]);
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fillStyle = gr;
  g.fill();
}

/** 4-point twinkle */
export function twinkle(g: Ctx, x: number, y: number, r: number, color: string, k = 0.18): void {
  const q = r * k;
  g.beginPath();
  g.moveTo(x, y - r);
  g.quadraticCurveTo(x + q, y - q, x + r, y);
  g.quadraticCurveTo(x + q, y + q, x, y + r);
  g.quadraticCurveTo(x - q, y + q, x - r, y);
  g.quadraticCurveTo(x - q, y - q, x, y - r);
  g.fillStyle = color;
  g.fill();
}
