// Geometry for every icon (0..100 box). Each entry returns an IconB whose d() is the final path.
import type { IconName } from './icons';
import {
  IconB, type Pt, type Shape,
  path, circle, ring, rrect, rect, poly, star, leaf, ellipse,
  stroke, strokeD, strokeClosed, lines, seg, rot, move, scale, mirrorX, clipConvex, arcPts, polar, join,
} from './pathKit';

const D2R = Math.PI / 180;
const B = () => new IconB();

// ───────────────────────────── helpers ─────────────────────────────

function plus(cx: number, cy: number, s: number, t: number): Shape {
  const a = s / 2, b = t / 2;
  return poly([
    [cx - b, cy - a], [cx + b, cy - a], [cx + b, cy - b], [cx + a, cy - b], [cx + a, cy + b], [cx + b, cy + b],
    [cx + b, cy + a], [cx - b, cy + a], [cx - b, cy + b], [cx - a, cy + b], [cx - a, cy - b], [cx - b, cy - b],
  ]);
}

/** four-point sparkle */
function sparkle(cx: number, cy: number, r: number, k = 0.17): Shape {
  const q = r * k;
  return path(
    `M${cx} ${cy - r} Q${cx + q} ${cy - q} ${cx + r} ${cy} Q${cx + q} ${cy + q} ${cx} ${cy + r} ` +
    `Q${cx - q} ${cy + q} ${cx - r} ${cy} Q${cx - q} ${cy - q} ${cx} ${cy - r} Z`,
  );
}

function gear(cx: number, cy: number, ro: number, ri: number, n: number, top = 0.42, base = 0.62): Shape {
  const pts: Pt[] = [];
  const tw = 360 / n;
  for (let i = 0; i < n; i++) {
    const a = i * tw - 90;
    pts.push(polar(cx, cy, ri, a - (tw * base) / 2), polar(cx, cy, ro, a - (tw * top) / 2), polar(cx, cy, ro, a + (tw * top) / 2), polar(cx, cy, ri, a + (tw * base) / 2));
  }
  return poly(pts);
}

/** triangle arrow head: tip, unit direction, length, half width */
function head(tip: Pt, dir: Pt, len: number, hw: number): Shape {
  const bx = tip[0] - dir[0] * len, by = tip[1] - dir[1] * len;
  const nx = -dir[1], ny = dir[0];
  return poly([tip, [bx + nx * hw, by + ny * hw], [bx - nx * hw, by - ny * hw]]);
}

/** barbed spear tip (chevron) with apex at (x,y) pointing up */
const barb = (x: number, y: number, w = 9, h = 15) => poly([[x, y], [x + w, y + h], [x, y + h * 0.72], [x - w, y + h]]);

function flamePath(): string {
  return 'M50 96 C29 96 15 81 15 62 C15 48 21 39 27 27 C30 36 34 42 40 45 C37 30 42 15 54 3 C57 16 64 25 68 35 C71 31 74 26 76 20 C83 32 86 47 86 61 C86 81 71 96 50 96 Z';
}
const smallFlame = 'M50 41 C39 41 32 35 32 27 C32 20 37 16 40 9 C42 15 45 18 47 21 C47 13 50 8 56 2 C58 10 61 14 64 19 C69 26 69 34 64 38 C60 40 55 41 50 41 Z';

export function laurelBranch(cx: number, cy: number, r: number, a0: number, a1: number, n: number, len: number, w: number, stemFrom = a0): Shape {
  const parts: Shape[] = [stroke(arcPts(cx, cy, r, r, stemFrom, a1, 28), Math.max(2.6, w * 0.38), 'round')];
  for (let i = 0; i < n; i++) {
    const a = a0 + ((a1 - a0) * (i + 0.35)) / n;
    const P = polar(cx, cy, r, a);
    const ar = a * D2R;
    const T: Pt = [-Math.sin(ar), Math.cos(ar)];
    const N: Pt = [Math.cos(ar), Math.sin(ar)];
    const o: Pt = [P[0] + T[0] * len * 0.72 + N[0] * len * 0.62, P[1] + T[1] * len * 0.72 + N[1] * len * 0.62];
    const inn: Pt = [P[0] + T[0] * len * 0.78 - N[0] * len * 0.42, P[1] + T[1] * len * 0.78 - N[1] * len * 0.42];
    parts.push(leaf(P[0], P[1], o[0], o[1], w));
    parts.push(leaf(P[0], P[1], inn[0], inn[1], w * 0.86));
  }
  const ae = a1 * D2R;
  const E = polar(cx, cy, r, a1);
  parts.push(leaf(E[0], E[1], E[0] - Math.sin(ae) * len * 0.95, E[1] + Math.cos(ae) * len * 0.95, w * 0.95));
  return join(...parts);
}

/** gap-cut: removes a halo of `front` (given as an expanded outline) from a convex `back` */
function overlap(b: IconB, back: Shape, frontExpanded: Shape, front: Shape): IconB {
  return b.add(back).cut(clipConvex(frontExpanded, back)).add(front);
}

function sinePts(x0: number, y0: number, y1: number, amp: number, cycles: number, phase: number, n = 60, env?: (t: number) => number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const e = env ? env(t) : 1;
    out.push([x0 + amp * e * Math.sin(phase + t * cycles * Math.PI * 2), y0 + (y1 - y0) * t]);
  }
  return out;
}

const AMPHORA = 'M40 6 L60 6 L60 11 L56.5 14 L56.5 24 C57 30 76 34 78 50 C80 66 66 79 59 84 L62 92 L38 92 L41 84 C34 79 20 66 22 50 C24 34 43 30 43.5 24 L43.5 14 L40 11 Z';
function amphoraShape(): Shape {
  return join(path(AMPHORA), strokeD('M56.5 17 C68 15 76 20 70 34', 5.5), strokeD('M43.5 17 C32 15 24 20 30 34', 5.5));
}

function swordUp(): Shape {
  return join(
    path('M45 66 L45.5 46 C44 38 41.5 30 43 23 C44.5 15 47.5 9 50 3 C52.5 9 55.5 15 57 23 C58.5 30 56 38 54.5 46 L55 66 Z'),
    rrect(31, 65, 38, 7.5, 3.75),
    rrect(45.5, 72, 9, 15, 2),
    circle(50, 91, 5.5),
  );
}

// ───────────────────────────── definitions ─────────────────────────────

export const ICON_DEFS: Record<IconName, () => IconB> = {
  // ── elements ──
  fire: () =>
    B()
      .add(path(flamePath()))
      .cut(path('M50 89 C40 89 33 82 33 73 C33 64 40 58 46.5 51 C48.5 57 52 60 57 63 C62 67 66 72 66 78 C66 85 59 89 50 89 Z')),

  water: () =>
    B()
      .add(path('M50 4 C58 19 82 39 82 62 C82 80 68 95 50 95 C32 95 18 80 18 62 C18 39 42 19 50 4 Z'))
      .cut(strokeD('M27.5 64 C33 57 39 56.5 44.5 62 C50 67.5 56 67.5 61.5 62 C66 57.5 70 57 73.5 59.5', 8))
      .cut(strokeD('M35 79 C39 75.5 43 75.5 47 78.5 C51 81.5 55 81.5 59 78.5 C62 76.2 64.5 76 66 77', 6)),

  wind: () => {
    const w1 = (t: number) => 4 + 7 * Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 0.7;
    return B()
      .add(strokeD('M6 40 L54 40 C70 40 80 32 78 20 C76 10 64 7 58 13 C53 18 56 26 63 25', w1, 'round', 'round'))
      .add(strokeD('M14 60 L66 60 C82 60 92 68 90 79 C88 89 76 92 70 86 C65 81 68 73 75 74', w1, 'round', 'round'))
      .add(strokeD('M22 50 L46 50', 7, 'round'));
  },

  earth: () => {
    const sil = poly([[4, 90], [37, 13], [55, 46], [68, 30], [96, 90]]);
    const bigTri = poly([[4, 90], [37, 13], [70, 90]]);
    const hull = poly([[4, 90], [37, 13], [68, 30], [96, 90]]);
    return B()
      .add(sil)
      .cut(clipConvex(stroke([[14, 46], [23, 50], [30, 42], [37, 51], [44, 41], [53, 48], [60, 44]], 5, 'butt'), bigTri))
      .cut(clipConvex(strokeD('M8 72 C24 66 36 76 52 70 C66 65 80 72 94 68', 5, 'butt'), hull));
  },

  // ── stats & UI ──
  hp: () => B().add(path('M50 91 C46 87 6 63 6 33 C6 19 16 9 29 9 C38 9 45 14 50 22 C55 14 62 9 71 9 C84 9 94 19 94 33 C94 63 54 87 50 91 Z')),

  def: () =>
    B()
      .add(circle(50, 50, 45))
      .cut(ring(50, 50, 38, 33))
      .cut(poly([[31, 67], [45, 31], [55, 31], [69, 67], [59.5, 67], [50, 42.5], [40.5, 67]])),

  atk: () => B().add(rot(swordUp(), 45)).cut(rot(seg(50, 58, 50, 20, 2.6), 45)),

  shield: () => {
    const sh = 'M50 5 C62 12 74 14 87 14 C87 51 75 77 50 95 C25 77 13 51 13 14 C26 14 38 12 50 5 Z';
    return B()
      .add(path(sh))
      .cut(scale(path(sh), 0.83, 0.83, 50, 50))
      .add(scale(path(sh), 0.72, 0.72, 50, 50))
      .cut(sparkle(50, 45, 19));
  },

  gold: () => {
    const face = ellipse(50, 43, 44, 33);
    const rim = path('M6 43 L6 57 C6 75 26 90 50 90 C74 90 94 75 94 57 L94 43 C94 61 74 76 50 76 C26 76 6 61 6 43 Z');
    return B()
      .add(face)
      .add(rim)
      .cut(join(ellipse(50, 43, 35.5, 25.5), [{ ...ellipse(50, 43, 31.5, 22)[0], solid: false }]))
      .cut(strokeClosed([[50, 27.5], [64, 55], [36, 55]], 6.5))
      .cut(path('M14 64 C24 74 36 79.5 50 80.5 C64 79.5 76 74 86 64 L86 67.5 C76 77.5 64 83 50 84 C36 83 24 77.5 14 67.5 Z'));
  },

  discard: () => {
    const back = rot(rrect(16, 20, 40, 58, 6), -16, 36, 49);
    const front = rot(rrect(42, 24, 40, 58, 6), 14, 62, 53);
    const frontX = rot(rrect(37, 19, 50, 68, 11), 14, 62, 53);
    return overlap(B(), back, frontX, front).cut(rot(star(62, 53, 13, 5, 4, -90), 14, 62, 53));
  },

  deck: () => {
    const edge = (o: number) => strokeD(`M${22 + o} ${24 - o} L${57 + o} ${24 - o} Q${70 + o} ${24 - o} ${70 + o} ${37 - o} L${70 + o} ${86 - o}`, 5, 'round');
    return B()
      .add(rrect(14, 30, 50, 64, 7), edge(0), edge(8))
      .cut(rrect(20, 36, 38, 52, 4))
      .add(rrect(23.5, 39.5, 31, 45, 2))
      .cut(star(39, 62, 10, 4.2, 4, -90));
  },

  power: () => {
    const pts: Pt[] = [];
    for (let i = 0; i < 32; i++) pts.push(polar(50, 50, i % 2 ? 23 : i % 4 === 0 ? 48 : 37, -90 + (i * 360) / 32));
    return B().add(poly(pts)).cut(circle(50, 50, 19)).add(circle(50, 50, 14));
  },

  mult: () => B().add(rot(rrect(40, 6, 20, 88, 7), 45), rot(rrect(40, 6, 20, 88, 7), -45)),

  pierce: () => {
    const sh = circle(48, 54, 28);
    const dir: Pt = [Math.SQRT1_2, -Math.SQRT1_2];
    return B()
      .add(sh)
      .cut(clipConvex(seg(6, 94, 84, 16, 16, 'butt'), sh))
      .add(seg(8, 92, 80, 20, 6.5, 'butt'))
      .add(head([93, 7], dir, 20, 10.5))
      .add(leaf(21, 79, 6, 78, 8), leaf(21, 79, 22, 94, 8), leaf(27, 73, 13, 71, 7), leaf(27, 73, 29, 87, 7));
  },

  heal: () =>
    B()
      .add(path('M50 4 C58 19 84 40 84 63 C84 81 69 95 50 95 C31 95 16 81 16 63 C16 40 42 19 50 4 Z'))
      .cut(plus(50, 64, 34, 11)),

  settings: () => B().add(gear(50, 50, 47, 35, 8)).cut(circle(50, 50, 14)),

  info: () =>
    B()
      .add(circle(50, 50, 46))
      .cut(circle(50, 27, 7.5))
      .cut(path('M39 41 L56 41 L56 70 L61 70 L61 78 L39 78 L39 70 L44 70 L44 49 L39 49 Z')),

  speed: () =>
    B().add(
      poly([[10, 14], [30, 14], [58, 50], [30, 86], [10, 86], [38, 50]]),
      poly([[42, 14], [62, 14], [90, 50], [62, 86], [42, 86], [70, 50]]),
    ),

  sound: () =>
    B()
      .add(path('M6 37 L24 37 L46 17 C49 15 53 16 53 20 L53 80 C53 84 49 85 46 83 L24 63 L6 63 Z'))
      .add(stroke(arcPts(52, 50, 15, 15, -50, 50, 16), 7.5))
      .add(stroke(arcPts(52, 50, 30, 30, -52, 52, 22), 7.5)),

  close: () => B().add(seg(20, 20, 80, 80, 14), seg(80, 20, 20, 80, 14)),

  reroll: () => {
    const arc = (a0: number, a1: number) => stroke(arcPts(50, 50, 33, 33, a0, a1, 22), 10, 'butt');
    const hd = (a: number) => {
      const p = polar(50, 50, 33, a);
      const t: Pt = [-Math.sin(a * D2R), Math.cos(a * D2R)];
      const n: Pt = [Math.cos(a * D2R), Math.sin(a * D2R)];
      return poly([[p[0] + n[0] * 13, p[1] + n[1] * 13], [p[0] + t[0] * 16, p[1] + t[1] * 16], [p[0] - n[0] * 13, p[1] - n[1] * 13]]);
    };
    return B().add(arc(198, 322), hd(322), arc(18, 142), hd(142));
  },

  skull: () =>
    B()
      .add(path('M50 6 C73 6 90 22 90 44 C90 57 84 66 76 71 L76 82 C76 87 72 91 67 91 L33 91 C28 91 24 87 24 82 L24 71 C16 66 10 57 10 44 C10 22 27 6 50 6 Z'))
      .cut(ellipse(33, 46, 10.5, 11.5), ellipse(67, 46, 10.5, 11.5))
      .cut(path('M50 57 L56 70 L44 70 Z'))
      .cut(rect(38, 78, 4, 10), rect(48, 78, 4, 10), rect(58, 78, 4, 10)),

  laurel: () => {
    const br = laurelBranch(50, 50, 37, 100, 236, 5, 19, 9.5, 78);
    return B().add(br, mirrorX(br));
  },

  temple: () =>
    B()
      .add(poly([[5, 31], [50, 7], [95, 31]]))
      .cut(poly([[25, 27], [50, 14.5], [75, 27]]))
      .add(rect(8, 34, 84, 7))
      .add(rect(13, 44, 10, 35), rect(32, 44, 10, 35), rect(58, 44, 10, 35), rect(77, 44, 10, 35))
      .add(rect(8, 81, 84, 6), rect(3, 89, 94, 6)),

  amphora: () => B().add(amphoraShape()).cut(rect(26, 48.5, 48, 4.5)),

  star: () => B().add(star(50, 53, 47, 19, 5)),

  lock: () =>
    B()
      .add(strokeD('M31 50 L31 33 C31 21 39 12 50 12 C61 12 69 21 69 33 L69 50', 9, 'butt'))
      .add(rrect(19, 44, 62, 50, 8))
      .cut(path('M50 55 A8 8 0 0 1 54.6 69.6 L57 82 L43 82 L45.4 69.6 A8 8 0 0 1 50 55 Z')),

  check: () => B().add(lines([[14, 52], [38, 76], [86, 26]], 14)),

  arrowRight: () => B().add(path('M8 42 L54 42 L54 22 C54 19 57 18 59 20 L90 47 C92 49 92 51 90 53 L59 80 C57 82 54 81 54 78 L54 58 L8 58 Z')),

  club: () => {
    const w = (t: number) => 10 + 22 * Math.pow(t, 1.5);
    const yAt = (t: number) => 94 - 72 * t;
    const knob = (t: number, side: number, r: number) => circle(50 + side * (w(t) / 2 + 0.5), yAt(t), r);
    const c = join(
      strokeD('M50 94 L50 22', w, 'round'),
      knob(0.93, -1, 6), knob(0.74, -1, 5.5), knob(0.56, -1, 4.6),
      knob(0.85, 1, 6), knob(0.65, 1, 5.2), knob(0.47, 1, 4.2),
      circle(43, 9.5, 5.5), circle(57.5, 10.5, 5),
    );
    return B()
      .add(rot(c, 38))
      .cut(rot(rect(44.6, 81, 10.8, 2.8), 38), rot(rect(44.9, 87, 10.2, 2.8), 38))
      .cut(rot(ellipse(50, 38, 2.6, 5), 38), rot(ellipse(44, 56, 2, 3.6), 38));
  },

  // ── intents ──
  intentStrike: () => {
    const sw = join(
      path('M44.5 30 L55.5 30 L55.5 78 L50 92 L44.5 78 Z'),
      rrect(33, 23, 34, 7.5, 3.75),
      rrect(45.5, 9, 9, 15, 2),
      circle(50, 7, 5.5),
    );
    return B()
      .add(rot(sw, 40))
      .cut(rot(seg(50, 35, 50, 76, 2.6), 40))
      .add(stroke(arcPts(28, 28, 62, 62, 14, 76, 30), (t) => 1.5 + 9 * Math.sin(Math.PI * t), 'round'));
  },

  intentHeavy: () => {
    const blade = path('M55 20 C66 18 77 12 85 7 C92 21 92 49 85 63 C77 58 66 51 55 49 Z');
    const ax = join(rrect(45.5, 4, 9, 90, 4.5), blade, mirrorX(blade), circle(50, 6, 6));
    return B()
      .add(rot(scale(ax, 0.84, 0.84, 50, 50), 32, 46, 46))
      .add(seg(84, 74, 95, 80, 5), seg(76, 83, 81, 95, 5), seg(68, 86, 66, 97, 4.4));
  },

  intentVolley: () => {
    const arrow = join(
      seg(50, 10, 50, 74, 5.5, 'butt'),
      poly([[50, 96], [39.5, 71], [60.5, 71]]),
      leaf(50, 24, 41, 6, 7), leaf(50, 24, 59, 6, 7),
    );
    const a = rot(scale(arrow, 0.72, 0.72, 50, 50), 28, 50, 50);
    return B().add(move(a, -27, 2), a, move(a, 27, -2));
  },

  intentGuard: () =>
    B()
      .add(circle(44, 56, 38))
      .cut(ring(44, 56, 30.5, 25.5))
      .cut(sparkle(44, 56, 15))
      .add(sparkle(82, 16, 15)),

  intentRoar: () => {
    const b = B().add(star(50, 50, 48, 37, 16, -90)).cut(circle(50, 50, 33)).add(circle(50, 50, 29));
    b.cut(ellipse(39, 35, 5, 3, 25), ellipse(61, 35, 5, 3, -25));
    b.cut(poly([[45, 40], [55, 40], [50, 45]]));
    b.cut(path('M33 56 C33 49 40 47 50 47 C60 47 67 49 67 56 C67 67 60 75 50 75 C40 75 33 67 33 56 Z'));
    b.add(poly([[36.5, 48], [44, 48], [40, 62]]), poly([[56, 48], [63.5, 48], [60, 62]]));
    b.add(poly([[41, 74], [47.5, 74], [44, 64]]), poly([[52.5, 74], [59, 74], [56, 64]]));
    return b;
  },

  intentDrain: () => {
    const fang = (x: number, dir: number) => strokeD(`M${x} 22 C${x + dir} 36 ${x - dir} 48 ${x - 4 * dir} 58`, (t) => 14 - 11 * t, 'butt', 'point');
    return B()
      .add(path('M8 10 C28 22 72 22 92 10 L92 20 C72 32 28 32 8 20 Z'))
      .add(fang(30, 1), fang(70, -1))
      .add(path('M50 46 C55 57 66 66 66 78 C66 88 59 95 50 95 C41 95 34 88 34 78 C34 66 45 57 50 46 Z'))
      .cut(path('M41 79 C41 72 44 67 47 63 C46 69 45.5 74 46 79 C46 83 41 83 41 79 Z'));
  },

  intentCurse: () => {
    const b = B()
      .add(path('M5 56 C20 34 36 26 50 26 C64 26 80 34 95 56 C80 78 64 86 50 86 C36 86 20 78 5 56 Z'))
      .cut(circle(50, 56, 22))
      .add(circle(50, 56, 16))
      .cut(circle(50, 56, 7));
    const lash = (bx: number, by: number) => {
      const dx = bx - 50, dy = by - 64, l = Math.hypot(dx, dy);
      return stroke([[bx, by], [bx + (dx / l) * 14, by + (dy / l) * 14]], (t) => 6 - 4 * t, 'round', 'round');
    };
    return b.add(lash(22, 36), lash(35, 28.5), lash(50, 26), lash(65, 28.5), lash(78, 36));
  },

  // ── boons ──
  thunderbolt: () => B().add(poly([[60, 3], [21, 55], [45, 55], [33, 97], [80, 40], [56, 40], [72, 3]])),

  ember: () =>
    B()
      .add(poly([[44, 95], [56, 95], [60, 57], [40, 57]]))
      .cut(rect(42.5, 67, 15, 3), rect(43.5, 79, 13, 3))
      .add(poly([[30, 44], [70, 44], [64, 54], [36, 54]]))
      .add(path(smallFlame)),

  trident: () =>
    B()
      .add(rrect(46, 40, 8, 56, 3.5))
      .add(strokeD('M24 17 L24 30 C24 40 30 45 40 45 L60 45 C70 45 76 40 76 30 L76 17', 8, 'butt'))
      .add(rect(46, 14, 8, 32))
      .add(barb(24, 3), barb(50, 1), barb(76, 3)),

  aeolus: () =>
    B()
      .add(path('M40 46 C22 50 12 66 16 80 C19 90 30 95 44 95 C60 95 72 90 74 78 C77 62 66 50 52 46 Z'))
      .add(rrect(35, 39, 22, 7, 3.5))
      .add(leaf(41, 41, 28, 28, 12), leaf(51, 41, 58, 26, 12))
      .add(strokeD('M58 34 C66 24 82 22 88 32 C93 41 84 49 76 44 C71 41 73 34 79 35', (t) => 7 - 4.5 * t, 'round'))
      .add(strokeD('M46 28 C44 18 52 8 62 10 C69 11 70 19 64 21', (t) => 5.5 - 3.5 * t, 'round')),

  gaia: () =>
    B()
      .add(path('M3 95 C12 74 30 62 50 62 C70 62 88 74 97 95 Z'))
      .cut(path('M50 70 C56 76 58 82 50 90 C42 82 44 76 50 70 Z'))
      .add(strokeD('M50 64 C50 54 50 46 50 38', 5.5))
      .add(leaf(50, 41, 18, 24, 22, 0.5), leaf(50, 41, 82, 18, 25, 0.5)),

  owl: () => {
    const b = B()
      .add(path('M50 14 C57 14 63 15 69 17 L80 5 L81 30 C87 40 88 55 85 66 C81 81 67 93 50 93 C33 93 19 81 15 66 C12 55 13 40 19 30 L20 5 L31 17 C37 15 43 14 50 14 Z'))
      .cut(circle(35, 40, 12.5), circle(65, 40, 12.5))
      .add(circle(35, 41, 6), circle(65, 41, 6))
      .cut(poly([[50, 49], [55, 56], [50, 64], [45, 56]]));
    for (const [x, y] of [[38, 74], [50, 78], [62, 74], [44, 85], [56, 85]] as Pt[]) b.cut(stroke(arcPts(x, y - 5, 5, 5, 30, 150, 10), 2.8, 'round'));
    return b;
  },

  sandals: () =>
    B()
      .add(path('M16 92 C12 92 10 88 12 84 L16 60 C17 54 20 50 26 50 L30 50 L32 36 C32 33 34 31 37 31 L52 31 C55 31 57 33 57 36 L58 56 C66 60 80 64 88 70 C94 74 95 82 92 87 C90 90 87 92 83 92 Z'))
      .cut(seg(35.5, 44, 53.5, 39, 3.2), seg(31, 53, 55, 47, 3.2), seg(60, 66, 67, 61.5, 3.2), seg(70, 72, 77, 67, 3.2))
      .cut(seg(16, 85.5, 89, 85.5, 2.6, 'butt'))
      .add(leaf(34, 38, 6, 16, 12, 0.55), leaf(33, 42, 3, 31, 11, 0.55), leaf(33, 46, 6, 45, 9.5, 0.55)),

  nike: () => {
    const br = laurelBranch(50, 44, 31, 108, 250, 5, 15, 8, 90);
    return B()
      .add(br, mirrorX(br))
      .add(strokeD('M47 77 C42 84 36 90 28 96', (t) => 6 - 2 * t), strokeD('M53 77 C58 84 64 90 72 96', (t) => 6 - 2 * t))
      .add(circle(50, 76, 5.5))
      .add(star(50, 44, 14, 5.8, 5));
  },

  twins: () => {
    const cap = (cx: number) => join(path(`M${cx - 16} 84 C${cx - 16} 62 ${cx - 9} 44 ${cx} 44 C${cx + 9} 44 ${cx + 16} 62 ${cx + 16} 84 Z`), rrect(cx - 19, 82, 38, 8, 4));
    return B().add(cap(28), cap(72), star(28, 22, 15, 6.3, 5), star(72, 22, 15, 6.3, 5));
  },

  hecate: () => {
    const torch = join(
      poly([[47, 94], [53, 94], [55.5, 52], [44.5, 52]]),
      poly([[39, 43], [61, 43], [57, 50], [43, 50]]),
      scale(path(smallFlame), 0.95, 0.95, 50, 41),
    );
    return B().add(rot(torch, -36, 50, 98), torch, rot(torch, 36, 50, 98));
  },

  amphora2: () => {
    const a = scale(amphoraShape(), 0.74, 0.74, 4, 96);
    const b = B().add(a);
    const g: Pt[] = [[64, 34], [77, 34], [90, 34], [70, 46], [83, 46], [64, 58], [77, 58], [71, 70], [77, 82]];
    for (const [x, y] of g.slice(0, 8)) b.add(circle(x + 1, y + 10, 6.2));
    b.add(strokeD('M77 40 C77 30 80 22 86 16', 3.5));
    b.add(leaf(80, 22, 96, 10, 12, 0.5), leaf(78, 24, 62, 12, 12, 0.5));
    return b;
  },

  artemis: () => {
    const moon = path('M62 9 A42 42 0 1 0 62 91 A42 42 0 0 1 62 9 Z');
    const dir: Pt = [Math.SQRT1_2, -Math.SQRT1_2];
    return B()
      .add(moon)
      .cut(clipConvex(moon, seg(8, 92, 84, 16, 15, 'butt')))
      .add(seg(10, 90, 80, 20, 5.5, 'butt'))
      .add(head([94, 6], dir, 20, 10))
      .add(leaf(20, 80, 6, 80, 8), leaf(20, 80, 20, 94, 8), leaf(26, 74, 12, 74, 7), leaf(26, 74, 26, 88, 7));
  },

  lyre: () => {
    const arm = strokeD('M34 80 C20 72 13 54 19 38 C23 27 22 17 13 10', (t) => 10 - 4 * t, 'round');
    return B()
      .add(arm, mirrorX(arm))
      .add(rrect(12, 21, 76, 7, 3.5))
      .add(path('M23 74 L77 74 C77 88 65 95 50 95 C35 95 23 88 23 74 Z'))
      .add(seg(38, 28, 38, 75, 3, 'butt'), seg(50, 28, 50, 75, 3, 'butt'), seg(62, 28, 62, 75, 3, 'butt'));
  },

  mirror: () => {
    const b = B().add(circle(50, 36, 27)).cut(sparkle(40, 27, 10)).cut(leaf(38, 50, 60, 22, 5.5));
    for (let i = 0; i < 16; i++) {
      const p = polar(50, 36, 31.5, i * 22.5);
      b.add(circle(p[0], p[1], 3.3));
    }
    return b
      .add(path('M44 67 L56 67 L54 74 L46 74 Z'))
      .add(rrect(37, 72, 26, 5.5, 2.75))
      .add(rrect(46, 76, 8, 13, 2))
      .add(ellipse(50, 82, 6, 3))
      .add(path('M40 96 C41 90 45 87 50 87 C55 87 59 90 60 96 Z'));
  },

  fleece: () => {
    const spiral = (cx: number, cy: number) => {
      const pts: Pt[] = [];
      for (let i = 0; i <= 44; i++) {
        const t = i / 44;
        pts.push(polar(cx, cy, 20 - 12 * t, -40 - 400 * t));
      }
      return stroke(pts, (t) => 11 - 6 * t, 'round');
    };
    const hornL = spiral(25, 46);
    const b = B()
      .add(path('M50 93 C42 93 37 87 36 79 L33 53 C32 42 40 34 50 34 C60 34 68 42 67 53 L64 79 C63 87 58 93 50 93 Z'))
      .add(hornL, mirrorX(hornL));
    b.cut(ellipse(40.5, 58, 3.6, 2.6, 25), ellipse(59.5, 58, 3.6, 2.6, -25));
    b.cut(ellipse(45, 85, 2.4, 3.2, 15), ellipse(55, 85, 2.4, 3.2, -15));
    for (const [x, y] of [[43, 43], [57, 43], [50, 49]] as Pt[]) b.cut(stroke(arcPts(x, y, 4, 4, 160, 400, 14), 2.6, 'round'));
    return b;
  },

  achilles: () =>
    B()
      .add(path('M50 3 L63 38 C64 44 60 50 55 56 L45 56 C40 50 36 44 37 38 Z'))
      .cut(seg(50, 15, 50, 49, 3))
      .add(path('M45 55 L55 55 L54 72 L46 72 Z'))
      .add(rrect(42.5, 60, 15, 4.5, 2.25), rrect(43, 67, 14, 4.5, 2.25))
      .add(rrect(46.5, 72, 7, 25, 2)),

  aegis: () => {
    const b = B().add(circle(50, 50, 46)).cut(ring(50, 50, 40.5, 36.5)).cut(circle(50, 50, 17));
    b.add(ellipse(43.5, 47, 3.6, 3), ellipse(56.5, 47, 3.6, 3));
    b.add(path('M41 55 Q50 66 59 55 Q50 60 41 55 Z'));
    for (let i = 0; i < 8; i++) {
      const a0 = i * 45 + 22.5;
      const pts: Pt[] = [];
      for (let k = 0; k <= 16; k++) {
        const t = k / 16;
        pts.push(polar(50, 50, 21 + 12 * t, a0 + 10 * Math.sin(t * Math.PI * 2)));
      }
      b.cut(stroke(pts, 3.6, 'round'));
    }
    return b;
  },

  asclepius: () => {
    const rod = rrect(46, 5, 8, 91, 4);
    const pts = sinePts(50, 86, 26, 16, 1.25, 0.2, 60, (t) => 0.75 + 0.25 * t);
    const snake = stroke(pts, (t) => 7.5 - 2 * t, 'round');
    const snakeWide = stroke(pts, (t) => 14.5 - 2 * t, 'round');
    const end = pts[pts.length - 1];
    return B()
      .add(rod)
      .cut(clipConvex(snakeWide, rod))
      .add(snake)
      .add(ellipse(end[0] - 3, end[1] - 4, 7.5, 5.5, -30));
  },

  pandora: () =>
    B()
      .add(path('M30 50 L70 50 C82 56 86 69 80 82 C76 90 64 95 50 95 C36 95 24 90 20 82 C14 69 18 56 30 50 Z'))
      .add(rrect(34, 43, 32, 7, 2.5))
      .cut(rect(24, 66, 52, 4))
      .add(rot(join(rrect(50, 27, 34, 6, 3), ellipse(67, 26, 5, 3.5)), 24, 58, 38))
      .add(strokeD('M40 40 C30 32 40 22 30 12 C27 9 28 5 31 3', (t) => 6.5 - 4 * t, 'round'))
      .add(strokeD('M50 38 C46 30 56 24 49 14', (t) => 5.5 - 3.5 * t, 'round'))
      .add(strokeD('M33 41 C22 40 16 32 20 24', (t) => 5 - 3 * t, 'round')),

  icarus: () => {
    const b = B().add(circle(50, 21, 9.5));
    for (let i = 0; i < 8; i++) {
      const a = i * 45;
      const p0 = polar(50, 21, 13.5, a), p1 = polar(50, 21, 19, a);
      b.add(seg(p0[0], p0[1], p1[0], p1[1], 3.6));
    }
    const wing = path('M53 66 C61 52 75 42 96 34 C95 42 92 47 87 51 C91 53 90 58 85 60 C88 63 86 67 81 68 C83 72 80 75 75 75 C76 79 72 82 67 80 C64 83 58 82 53 77 Z');
    const cuts = join(strokeD('M58 68 C66 61 74 57 84 55', 2.4, 'round'), strokeD('M58 73 C64 69 70 67 77 66', 2.4, 'round'));
    return b.add(wing, mirrorX(wing)).cut(cuts, mirrorX(cuts));
  },

  hades: () => {
    const eye = path('M18 50 C26 45 36 44 45 46 L46.5 54 L43 63 C35 62 25 59 18 56 Z');
    return B()
      .add(path('M50 11 C73 11 87 27 87 49 L87 79 C87 87 81 93 73 93 L59 93 L59 71 L50 78 L41 71 L41 93 L27 93 C19 93 13 87 13 79 L13 49 C13 27 27 11 50 11 Z'))
      .cut(eye, mirrorX(eye))
      .add(path('M34 15 C36 3 64 3 66 15 C60 12 40 12 34 15 Z'));
  },

  ares: () => {
    const sword = rot(join(
      path('M45 66 L45 16 L50 5 L55 16 L55 66 Z'),
      rrect(33, 65, 34, 7, 3.5), rrect(46, 72, 8, 14, 2), circle(50, 90, 5),
    ), -45);
    const swordX = rot(rect(40, 4, 20, 64), -45);
    const shaft = rot(rrect(47, 30, 6, 66, 3), 45);
    return B()
      .add(shaft)
      .cut(clipConvex(swordX, shaft))
      .add(rot(join(leaf(50, 32, 50, 3, 17, 0.35), rrect(46, 30, 8, 6, 2)), 45))
      .add(sword);
  },

  atlas: () => {
    const globe = circle(50, 31, 28);
    const band = (cy: number, rx: number, ry: number) => clipConvex(join(ellipse(50, cy, rx, ry), [{ ...ellipse(50, cy, rx - 4.5, ry - 4)[0], solid: false }]), globe);
    return B()
      .add(globe)
      .cut(rot(band(33, 32, 10), -16, 50, 31))
      .cut(rot(band(13, 24, 6.5), -16, 50, 31))
      .add(circle(50, 70, 7))
      .add(path('M27 97 C27 86 37 80 50 80 C63 80 73 86 73 97 Z'))
      .add(lines([[34, 84], [18, 70], [28, 52]], 7), lines([[66, 84], [82, 70], [72, 52]], 7));
  },

  ariadne: () =>
    B()
      .add(lines([[42, 90], [10, 90], [10, 10], [90, 10], [90, 90], [58, 90]], 8, 'square'))
      .add(lines([[42, 26], [26, 26], [26, 74], [74, 74], [74, 26], [58, 26]], 8, 'square'))
      .add(rect(42, 42, 16, 16))
      .add(seg(74, 50, 90, 50, 8, 'butt')),

  chiron: () =>
    B()
      .add(seg(12, 88, 74, 26, 8, 'round', 'butt'))
      .add(poly([[92, 8], [62, 12], [88, 38]]))
      .add(seg(30, 44, 56, 70, 8))
      .add(star(25, 23, 16, 6.8, 5)),

  eris: () =>
    B()
      .add(path('M50 28 C42 21 22 19 15 37 C8 55 22 89 38 91 C43 92 46 89 50 89 C54 89 57 92 62 91 C78 89 92 55 85 37 C78 19 58 21 50 28 Z'))
      .add(strokeD('M50 30 C49 22 51 14 56 8', 5))
      .add(leaf(55, 15, 84, 9, 15, 0.45))
      .cut(path('M24 46 C25 38 31 33 38 32 C33 37 30 43 30 49 C30 53 24 52 24 46 Z')),

  harmonia: () => {
    const b = B();
    const pts: Pt[] = [];
    for (let i = 0; i <= 40; i++) {
      const a = (Math.PI * i) / 40;
      pts.push([50 - 39 * Math.cos(a), 9 + 44 * Math.sin(a)]);
    }
    b.add(stroke(pts, 2.6, 'round'));
    for (let i = 0; i <= 8; i++) {
      if (i === 4) continue;
      const a = (Math.PI * i) / 8;
      b.add(circle(50 - 39 * Math.cos(a), 9 + 44 * Math.sin(a), 5.8));
    }
    b.add(path('M50 50 C57 60 64 68 64 78 C64 87 58 94 50 94 C42 94 36 87 36 78 C36 68 43 60 50 50 Z'));
    b.cut(path('M42 78 C42 72 45 67 48 63 C47 69 46.5 74 47 78 C47 82 42 82 42 78 Z'));
    return b;
  },

  tyche: () => {
    const b = B().add(ring(50, 50, 44, 35)).add(circle(50, 50, 11));
    for (let i = 0; i < 8; i++) {
      const p0 = polar(50, 50, 9, i * 45), p1 = polar(50, 50, 37, i * 45);
      b.add(seg(p0[0], p0[1], p1[0], p1[1], 6, 'butt'));
    }
    for (let i = 0; i < 8; i++) {
      const p = polar(50, 50, 44, i * 45 + 22.5);
      b.add(circle(p[0], p[1], 4.5));
    }
    return b.cut(circle(50, 50, 4.5));
  },

  kronos: () =>
    B()
      .add(path('M28 70 C20 44 36 13 67 9 C82 7 94 15 96 26 C86 20 72 20 62 26 C48 34 40 52 40 68 Z'))
      .add(seg(35, 72, 17, 96, 10))
      .add(rot(rrect(25, 66, 20, 7, 3), -53, 35, 69.5)),

  nemesis: () => {
    const pan = (cx: number) => join(
      seg(cx, 22, cx - 13, 58, 2.8), seg(cx, 22, cx + 13, 58, 2.8),
      path(`M${cx - 17} 57 L${cx + 17} 57 C${cx + 17} 66 ${cx + 9} 72 ${cx} 72 C${cx - 9} 72 ${cx - 17} 66 ${cx - 17} 57 Z`),
    );
    return B()
      .add(rrect(46.5, 14, 7, 72, 3.5))
      .add(rrect(10, 17, 80, 6.5, 3.25))
      .add(circle(50, 10, 6))
      .add(pan(20), pan(80))
      .add(path('M28 95 L72 95 C72 89 64 84 56 84 L44 84 C36 84 28 89 28 95 Z'));
  },

  persephone: () => {
    const b = B()
      .add(circle(50, 59, 36))
      .add(poly([[38, 31], [36, 11], [44, 21], [50, 6], [56, 21], [64, 11], [62, 31]]))
      .cut(circle(50, 61, 25));
    for (const [x, y] of [[50, 61], [41, 61], [59, 61], [45.5, 53], [54.5, 53], [45.5, 69], [54.5, 69], [36.5, 53], [63.5, 53], [36.5, 69], [63.5, 69], [50, 45], [50, 77], [41, 77], [59, 77], [41, 45], [59, 45]] as Pt[]) {
      if (Math.hypot(x - 50, y - 61) < 19.5) b.add(circle(x, y, 3.9));
    }
    return b;
  },

  cyclops: () =>
    B()
      .add(path('M6 60 C20 40 35 33 50 33 C65 33 80 40 94 60 C80 79 65 86 50 86 C35 86 20 79 6 60 Z'))
      .cut(circle(50, 60, 21))
      .add(circle(50, 60, 15.5))
      .cut(ellipse(50, 60, 4.2, 11))
      .add(strokeD('M8 30 C26 13 74 13 92 30', (t) => 4 + 8 * Math.sin(Math.PI * t), 'round')),

  medusa: () => {
    const b = B().add(ellipse(50, 60, 18, 22));
    b.cut(ellipse(43.5, 56, 3.8, 2.8), ellipse(56.5, 56, 3.8, 2.8));
    b.cut(path('M43 69 Q50 75 57 69 Q50 72 43 69 Z'));
    const angs = [-168, -135, -108, -72, -45, -12, 170 - 360 + 360];
    for (const a of angs) {
      const ar = a * D2R;
      const bx = 50 + 15 * Math.cos(ar), by = 60 + 19 * Math.sin(ar);
      const dx = Math.cos(ar), dy = Math.sin(ar);
      const pts: Pt[] = [];
      for (let k = 0; k <= 16; k++) {
        const t = k / 16, s = 4.5 * Math.sin(t * Math.PI * 2);
        pts.push([bx + dx * 26 * t - dy * s, by + dy * 24 * t + dx * s]);
      }
      b.add(stroke(pts, (t) => 6.5 - 2 * t, 'round'));
      const e = pts[pts.length - 1];
      b.add(ellipse(e[0], e[1], 5, 3.6, a));
    }
    return b;
  },

  minotaur: () =>
    B()
      .add(path('M50 93 C41 93 35 87 34 79 L28 50 C26 40 33 32 42 31 L58 31 C67 32 74 40 72 50 L66 79 C65 87 59 93 50 93 Z'))
      .add(strokeD('M34 37 C18 37 6 27 9 7', (t) => 12 - 8 * t, 'round', 'point'))
      .add(strokeD('M66 37 C82 37 94 27 91 7', (t) => 12 - 8 * t, 'round', 'point'))
      .add(leaf(31, 47, 11, 53, 10), leaf(69, 47, 89, 53, 10))
      .cut(ellipse(40.5, 55, 3.6, 2.6, 20), ellipse(59.5, 55, 3.6, 2.6, -20))
      .cut(ellipse(44, 83, 3, 4), ellipse(56, 83, 3, 4)),

  hermes: () => {
    const wing = join(leaf(62, 40, 93, 17, 12, 0.6), leaf(63, 44, 96, 32, 10.5, 0.6), leaf(63, 48, 93, 46, 9, 0.6));
    return B()
      .add(path('M50 42 C30 44 20 62 24 78 C27 89 38 95 50 95 C62 95 73 89 76 78 C80 62 70 44 50 42 Z'))
      .add(rrect(38, 35, 24, 7, 3.5))
      .add(poly([[40, 36], [31, 19], [44, 26], [50, 16], [56, 26], [69, 19], [60, 36]]))
      .add(wing, mirrorX(wing))
      .cut(strokeD('M34 66 C42 72 58 72 66 66', 3.2, 'round'));
  },

  olympus: () =>
    B()
      .add(poly([[3, 95], [25, 57], [35, 69], [50, 40], [97, 95]]))
      .cut(clipConvex(stroke([[30, 64], [36, 70], [42, 62], [48, 68], [54, 60], [60, 66], [66, 59]], 4.5, 'butt'), poly([[3, 95], [50, 40], [97, 95]])))
      .add(path('M30 32 L27 12 L39 21 L50 5 L61 21 L73 12 L70 32 Z')),

  // ── scrolls & patrons ──
  caduceus: () => {
    const staff = rrect(46.5, 17, 7, 79, 3.5);
    const env = (t: number) => 0.6 + 0.4 * Math.sin(Math.PI * Math.min(1, t * 1.1));
    const s1 = sinePts(50, 86, 32, 15, 1.5, 0, 60, env);
    const s2 = sinePts(50, 86, 32, 15, 1.5, Math.PI, 60, env);
    const wing = join(leaf(46, 24, 12, 12, 11, 0.6), leaf(46, 28, 14, 26, 10, 0.6), leaf(46, 31, 22, 38, 8, 0.6));
    const e1 = s1[s1.length - 1], e2 = s2[s2.length - 1];
    return B()
      .add(staff)
      .cut(clipConvex(stroke(s1, 11), staff))
      .add(stroke(s1, 5.5), stroke(s2, 5.5))
      .add(ellipse(e1[0] - 2, e1[1] - 3, 5.5, 4, -40), ellipse(e2[0] + 2, e2[1] - 3, 5.5, 4, 40))
      .add(wing, mirrorX(wing))
      .add(circle(50, 11, 6.5));
  },

  sun: () => {
    const b = B().add(circle(50, 50, 21));
    for (let i = 0; i < 12; i++) {
      const a = i * 30 - 90;
      const R = i % 2 ? 39 : 47;
      b.add(poly([polar(50, 50, 26.5, a - 11), polar(50, 50, R, a), polar(50, 50, 26.5, a + 11)]));
    }
    return b;
  },

  hammer: () =>
    B()
      .add(path('M90 58 L30 58 C20 58 10 54 5 48 L5 58 C8 66 16 70 26 70 L34 70 L34 76 C34 80 30 84 24 86 L24 93 L76 93 L76 86 C70 84 66 80 66 76 L66 70 L78 70 C86 70 90 65 90 58 Z'))
      .add(rot(join(rrect(30, 8, 40, 17, 3), rrect(47.5, 25, 5, 24, 2.5)), 25, 50, 20)),

  chisel: () => {
    const c = join(
      rrect(41, 4, 18, 34, 8),
      rect(43, 38, 14, 6),
      rect(45.5, 44, 9, 38),
      poly([[45.5, 82], [54.5, 82], [54.5, 86], [45.5, 95]]),
    );
    return B()
      .add(rot(c, 38))
      .cut(rot(rect(43.5, 29, 13, 2.6), 38))
      .add(poly([[8, 74], [15, 70], [13, 78]]), poly([[22, 96], [26, 89], [30, 95]]), poly([[6, 90], [12, 86], [12, 93]]));
  },

  shears: () => {
    const bA = stroke([[40, 66], [72, 7]], (t) => 11 - 7 * t, 'round', 'point');
    const bB = stroke([[60, 66], [28, 7]], (t) => 11 - 7 * t, 'round', 'point');
    const bAW = stroke([[40, 66], [72, 7]], (t) => 19 - 7 * t, 'round', 'round');
    return B()
      .add(ring(30, 79, 14, 8), ring(70, 79, 14, 8))
      .add(bB)
      .cut(clipConvex(bAW, bB))
      .add(bA)
      .cut(circle(50, 47.6, 2.6));
  },

  chalice: () =>
    B()
      .add(path('M12 12 L88 12 C88 36 72 52 50 52 C28 52 12 36 12 12 Z'))
      .cut(rect(17, 18, 66, 4))
      .add(rect(46, 50, 8, 28))
      .add(ellipse(50, 63, 8.5, 4.5))
      .add(path('M26 93 C28 84 38 78 50 78 C62 78 72 84 74 93 Z')),

  gem: () =>
    B()
      .add(poly([[27, 12], [73, 12], [93, 37], [50, 93], [7, 37]]))
      .cut(seg(14, 37, 86, 37, 3.5, 'butt'))
      .cut(seg(36, 16, 29, 33, 3, 'butt'), seg(64, 16, 71, 33, 3, 'butt'), seg(50, 16, 50, 33, 3, 'butt'))
      .cut(seg(31, 42, 47, 80, 3.2, 'butt'), seg(69, 42, 53, 80, 3.2, 'butt')),

  coin: () => {
    const pill = (x: number, y: number) => rrect(x, y, 44, 10, 5);
    return B()
      .add(pill(6, 84), pill(10, 71), pill(5, 58), pill(9, 45))
      .add(ellipse(31, 37, 22, 6.5))
      .add(circle(77, 60, 18))
      .cut(ring(77, 60, 13.5, 10.5));
  },

  peacock: () => {
    const vane = path('M50 86 C41 72 25 56 25 34 C25 17 36 6 50 6 C64 6 75 17 75 34 C75 56 59 72 50 86 Z');
    const strands = join(
      seg(50, 80, 40.5, 64, 2.2), seg(50, 80, 59.5, 64, 2.2),
      seg(50, 72, 35, 58, 2.2), seg(50, 72, 65, 58, 2.2),
    );
    const v = (s: Shape) => rot(s, 24, 50, 46);
    return B()
      .add(strokeD('M37.5 81 C33 88 29 93 24 98', (t) => 4.6 - 1.2 * t, 'butt', 'round'))
      .add(v(vane))
      .cut(v(ellipse(50, 33, 16, 19)))
      .add(v(path('M50 49 C42 44 37 37 37 30 C37 22 43 16 50 16 C57 16 63 22 63 30 C63 37 58 44 50 49 Z')))
      .cut(v(ellipse(50, 30, 5.2, 6.8)))
      .cut(v(strands));
  },

  wheat: () => {
    const b = B().add(strokeD('M47 97 C47 78 49 58 50 34', 4.5));
    for (const y of [36, 48, 60, 72]) b.add(leaf(49.5, y, 35, y - 13, 11, 0.5), leaf(49.5, y, 64, y - 13, 11, 0.5));
    b.add(leaf(50, 36, 50, 5, 12, 0.5));
    b.add(leaf(47, 86, 24, 70, 8, 0.45));
    return b;
  },

  bident: () =>
    B()
      .add(rrect(46, 42, 8, 54, 3.5))
      .add(strokeD('M32 17 L32 32 C32 42 38 46 46 46 L54 46 C62 46 68 42 68 32 L68 17', 8, 'butt'))
      .add(barb(32, 3), barb(68, 3)),

  dove: () =>
    B()
      .add(path('M8 62 C16 57 27 56 37 58 C46 60 55 59 62 54 C67 50 71 44 77 42 C83 40 89 43 92 48 L85 50 C83 59 77 67 67 73 C57 79 45 81 33 79 L19 90 L21 77 C14 74 9 69 8 62 Z'))
      .add(path('M38 59 C33 44 34 24 44 6 C48 24 55 40 63 54 C56 59 46 61 38 59 Z'))
      .add(path('M30 57 C22 46 18 34 20 20 C27 32 34 44 40 56 Z')),
};

