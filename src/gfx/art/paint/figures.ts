// Court cards (J / Q / K) painted as Greek black-figure pottery panels.
// Figures are authored in a 216 x 492 local space (the panel), facing right.
// Black-figure conventions: glossy black silhouettes, details incised to the clay,
// added purple-red for crests/bands, added white for female skin.
import type { Element } from '../../../logic/types';
import { ELEM_ART, POTTERY, type ElemArt } from './palette';
import { rgba, shade, type Ctx } from './util';
import { mottleTex } from './textures';
import { meanderBand } from './ornament';

export interface Rect { x: number; y: number; w: number; h: number }
type PipFn = (g: Ctx, cx: number, cy: number, size: number) => void;

const PW = 216, PH = 492;

interface Painter {
  g: Ctx;
  a: ElemArt;
  black: (d: string | Path2D) => void;
  red: (d: string | Path2D) => void;
  white: (d: string | Path2D) => void;
  clay: (d: string | Path2D) => void;
  incise: (d: string, w?: number) => void;
  inciseOn: (d: string, color: string, w?: number) => void;
}

function painter(g: Ctx, a: ElemArt): Painter {
  const P = (d: string | Path2D) => (typeof d === 'string' ? new Path2D(d) : d);
  const blackFill = (() => {
    const gr = g.createLinearGradient(0, 0, PW, PH);
    gr.addColorStop(0, POTTERY.blackHi);
    gr.addColorStop(0.35, POTTERY.black);
    gr.addColorStop(1, '#0d0907');
    return gr;
  })();
  return {
    g, a,
    black: (d) => { g.fillStyle = blackFill; g.fill(P(d)); },
    red: (d) => { g.fillStyle = POTTERY.red; g.fill(P(d)); },
    white: (d) => { g.fillStyle = POTTERY.white; g.fill(P(d)); },
    clay: (d) => { g.fillStyle = a.clayLight; g.fill(P(d)); },
    incise: (d, w = 1.7) => {
      g.lineWidth = w;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.strokeStyle = shade(a.clayLight, 0.15);
      g.stroke(P(d));
    },
    inciseOn: (d, color, w = 1.6) => {
      g.lineWidth = w;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.strokeStyle = color;
      g.stroke(P(d));
    },
  };
}

/** clay ground with glaze sheen and firing blotches */
function clayGround(g: Ctx, a: ElemArt, seed: number): void {
  const bg = g.createRadialGradient(PW * 0.55, PH * 0.32, 10, PW * 0.5, PH * 0.5, PH * 0.72);
  bg.addColorStop(0, a.clayLight);
  bg.addColorStop(0.55, a.clay);
  bg.addColorStop(1, a.clayDeep);
  g.fillStyle = bg;
  g.fillRect(0, 0, PW, PH);
  g.save();
  g.globalCompositeOperation = 'overlay';
  g.globalAlpha = 0.45;
  g.drawImage(mottleTex(PW, PH, seed % 4 + 301), 0, 0);
  g.restore();
}

// ───────────────────────────── J : hoplite ─────────────────────────────

function hoplite(p: Painter, pip: PipFn): void {
  const { g } = p;
  // spear (behind)
  p.black('M193 60 L199 60 L183 492 L177 492 Z');
  p.black('M196 6 C203 22 205 40 200 64 L190 64 C186 40 189 22 196 6 Z');
  p.incise('M196 16 L195 58', 1.2);
  // crest (behind helmet)
  const crest = new Path2D('M152 96 C152 60 130 30 96 27 C62 24 37 46 29 78 C23 102 22 130 29 168 L42 162 C37 130 39 104 47 86 C57 64 74 52 96 52 C116 52 132 66 136 94 Z');
  p.black(crest);
  p.red('M146 90 C144 64 126 42 98 40 C70 38 50 56 41 82 C35 100 33 126 36 156 L40 154 C38 128 40 104 47 86 C57 64 74 52 96 52 C116 52 132 66 136 94 Z');
  g.save();
  g.clip(crest);
  for (let i = 0; i < 17; i++) {
    const t = i / 16;
    const ang = Math.PI * (1.02 + t * 0.98);
    const cx = 92, cy = 100;
    const r0 = 40, r1 = 80;
    const x0 = cx + Math.cos(ang) * r0, y0 = cy + Math.sin(ang) * r0 * 1.2;
    const x1 = cx + Math.cos(ang) * r1, y1 = cy + Math.sin(ang) * r1 * 1.05;
    p.incise(`M${x0.toFixed(1)} ${y0.toFixed(1)} L${x1.toFixed(1)} ${y1.toFixed(1)}`, 1.1);
  }
  g.restore();
  p.black('M94 50 L102 50 L106 80 L90 80 Z');
  // neck
  p.black('M94 196 L134 204 L138 246 L90 246 Z');
  // beard below cheek piece
  p.black('M128 204 C140 214 150 226 151 244 C140 236 128 226 120 210 Z');
  p.incise('M132 214 C138 222 142 230 145 238', 1.1);
  // helmet
  const helm = 'M58 202 C42 172 42 124 60 98 C74 78 100 70 124 76 C146 82 160 100 163 118 L165 150 L172 167 L160 170 L158 178 C160 192 156 206 146 214 L112 206 C98 212 76 216 58 202 Z';
  p.black(helm);
  // eye opening + eye
  p.clay('M126 126 C134 117 150 116 162 123 C154 132 138 134 126 126 Z');
  p.black('M146 120.5 C150 120.5 153 123 153 126 C149 128.5 145 128 142.5 126 C142.5 123 144 120.5 146 120.5 Z');
  // face opening slit
  p.clay('M159 142 L161 141 L160 176 L157.5 177 Z');
  // incisions: brow, cheek guard spiral, rim
  p.incise('M120 112 C134 104 152 104 164 114');
  p.incise('M62 196 C76 182 96 172 114 168 C126 166 132 174 126 182 C120 188 112 182 116 176');
  p.incise('M60 104 C80 86 104 82 124 86');
  p.incise('M50 150 C52 128 58 112 68 100', 1.2);
  // shield
  const scx = 98, scy = 334, sr = 98;
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.35)';
  g.shadowBlur = 8;
  g.shadowOffsetX = -2;
  g.shadowOffsetY = 3;
  const sh = new Path2D();
  sh.arc(scx, scy, sr, 0, Math.PI * 2);
  p.black(sh);
  g.restore();
  const rim = (r: number, w: number) => p.incise(`M${scx + r} ${scy} A${r} ${r} 0 1 1 ${scx - r} ${scy} A${r} ${r} 0 1 1 ${scx + r} ${scy}`, w);
  rim(91, 1.8);
  rim(84, 1.2);
  // rim dots in added white
  for (let i = 0; i < 28; i++) {
    const t = (i / 28) * Math.PI * 2;
    g.beginPath();
    g.arc(scx + Math.cos(t) * 87.5, scy + Math.sin(t) * 87.5, 1.7, 0, Math.PI * 2);
    g.fillStyle = POTTERY.white;
    g.fill();
  }
  // blazon: element on a clay roundel
  const bl = g.createRadialGradient(scx - 10, scy - 14, 4, scx, scy, 52);
  bl.addColorStop(0, p.a.clayLight);
  bl.addColorStop(1, p.a.clay);
  g.beginPath();
  g.arc(scx, scy, 50, 0, Math.PI * 2);
  g.fillStyle = bl;
  g.fill();
  g.lineWidth = 2;
  g.strokeStyle = POTTERY.red;
  g.stroke();
  pip(g, scx, scy, 74);
  // spear hand over the shield rim
  p.black('M178 238 C186 232 196 232 200 240 C202 248 196 256 186 256 C178 256 174 246 178 238 Z');
  p.incise('M184 241 L196 243 M183 247 L195 249', 1.1);
  // legs with greaves below the shield
  p.black('M70 420 C66 444 58 466 50 492 L72 492 C78 470 86 448 90 428 Z');
  p.black('M124 424 C134 444 142 466 148 492 L170 492 C164 466 154 440 146 418 Z');
  p.incise('M74 440 C70 456 66 472 60 488', 1.3);
  p.incise('M134 440 C141 456 148 472 156 488', 1.3);
  p.incise('M66 452 C72 450 80 452 84 456 M136 452 C142 450 148 452 152 456', 1.2);
}

// ───────────────────────────── Q : queen ─────────────────────────────

function queen(p: Painter, pip: PipFn): void {
  const { g } = p;
  // body: peplos with himation (black), long, to the panel bottom
  p.black('M70 238 C88 228 120 224 152 232 C166 240 170 262 168 300 C166 360 170 420 180 492 L40 492 C46 430 50 360 52 300 C54 268 58 248 70 238 Z');
  // red band down the front + hem
  p.red('M128 262 L140 262 L150 492 L136 492 Z');
  p.red('M44 470 L178 470 L180 492 L40 492 Z');
  // dotted crosses (added white) on the dress
  for (const [x, y] of [[80, 300], [96, 340], [78, 382], [100, 420], [74, 446], [112, 372], [114, 304]] as [number, number][]) {
    g.fillStyle = POTTERY.white;
    for (const [dx, dy] of [[0, -4], [4, 0], [0, 4], [-4, 0], [0, 0]] as [number, number][]) {
      g.beginPath();
      g.arc(x + dx, y + dy, 1.4, 0, Math.PI * 2);
      g.fill();
    }
  }
  // folds
  p.incise('M66 300 C64 360 62 420 58 468');
  p.incise('M84 260 C82 330 84 400 86 468');
  p.incise('M156 300 C158 360 162 420 168 468');
  p.incise('M110 248 C108 300 112 360 116 430', 1.2);
  // himation over the shoulder with zig-zag edge
  p.black('M58 246 C76 232 104 228 128 236 L120 262 C104 270 92 290 80 320 L60 318 C56 290 54 262 58 246 Z');
  p.incise('M126 238 L118 264 C104 272 92 292 80 320');
  p.incise('M64 260 C70 280 72 300 72 316', 1.2);
  // forearm (white) + hand holding the phiale
  p.white('M118 306 C136 300 158 294 176 290 L180 298 C162 306 142 314 122 318 Z');
  p.white('M174 286 C182 282 190 284 192 290 C192 296 186 300 178 300 Z');
  // sleeve over upper arm
  p.black('M96 296 C106 288 122 290 128 300 L126 322 C114 326 102 322 96 314 Z');
  p.incise('M100 300 L104 318 M110 296 L114 320 M120 296 L122 320', 1.1);
  // phiale
  p.black('M158 282 C166 288 196 288 206 282 C204 292 194 298 182 298 C170 298 160 292 158 282 Z');
  p.incise('M162 285 C172 289 192 289 202 285', 1.1);
  // floating element above the phiale, with a soft halo
  const hx = 182, hy = 236;
  const halo = g.createRadialGradient(hx, hy, 4, hx, hy, 44);
  halo.addColorStop(0, rgba(p.a.glow, 0.85));
  halo.addColorStop(1, rgba(p.a.glow, 0));
  g.fillStyle = halo;
  g.fillRect(hx - 46, hy - 46, 92, 92);
  pip(g, hx, hy, 50);
  // skin: face + neck in one shape (added white)
  p.white('M132 96 C140 102 145 110 147 118 L161 146 C159 149 156 150 153 150 C155 152 156 154 155 156 C153 157 152 158 151 158 C153 159 154 161 154 163 C154 168 153 173 150 177 C147 181 142 183 138 183 L136 236 C124 241 110 241 99 237 L103 198 C106 188 108 176 110 160 C112 140 118 112 132 96 Z');
  // hair: crown, krobylos bun, tresses down the back
  p.black('M136 100 C134 84 120 72 100 72 C80 72 64 82 58 98 C50 98 38 104 36 118 C34 134 44 146 58 146 C60 160 62 176 66 192 C70 214 68 236 62 258 C74 254 84 244 92 230 C98 216 100 206 103 196 C106 186 108 174 110 160 C112 140 116 116 128 104 Z');
  // forehead curls + tress incisions + bun ribbon
  for (let i = 0; i < 4; i++) p.incise(`M${128 - i * 5} ${103 - i * 2.2} c-2 3 -5 3 -6 0`, 1.1);
  p.incise('M72 160 C74 186 76 210 72 238 M82 150 C84 178 86 204 84 228 M92 152 C94 176 94 196 92 214', 1.1);
  p.inciseOn('M44 112 C50 104 58 102 64 106 M42 126 C50 118 60 118 66 124', p.a.clayLight, 1.3);
  // stephane (diadem) — reserved clay crescent with red rosettes
  const steph = 'M141 98 C136 78 116 62 92 63 C80 64 70 70 64 78 L75 86 C90 76 112 76 126 87 C131 91 135 95 137 101 Z';
  p.clay(steph);
  p.inciseOn(steph, POTTERY.black, 1.5);
  for (const [x, y] of [[80, 74], [94, 69], [108, 70], [121, 76], [131, 85]] as [number, number][]) {
    g.beginPath();
    g.arc(x, y, 2.3, 0, Math.PI * 2);
    g.fillStyle = POTTERY.red;
    g.fill();
  }
  // eye (archaic almond), brow, lips, chin line, ear-ring
  p.inciseOn('M128 124 C133 119 141 118 147 122 C141 127 133 128 128 124 Z', POTTERY.black, 1.5);
  g.beginPath();
  g.arc(139.5, 122.8, 2.3, 0, Math.PI * 2);
  g.fillStyle = POTTERY.black;
  g.fill();
  p.inciseOn('M126 115 C133 110 143 110 149 114', POTTERY.black, 1.4);
  p.inciseOn('M149 156 L154 156', POTTERY.black, 1.3);
  g.beginPath();
  g.arc(108, 172, 3.6, 0, Math.PI * 2);
  g.fillStyle = POTTERY.red;
  g.fill();
  g.beginPath();
  g.arc(108, 180, 2.4, 0, Math.PI * 2);
  g.fill();
  // necklace
  p.inciseOn('M101 224 C112 232 126 232 137 224', POTTERY.red, 2.2);
}

// ───────────────────────────── K : king ─────────────────────────────

function king(p: Painter, pip: PipFn): void {
  const { g } = p;
  // scepter (behind the hand)
  p.black('M181 92 L187 92 L189 492 L183 492 Z');
  p.black('M176 92 L192 92 L190 100 L178 100 Z');
  // emblem atop the scepter with halo
  const hx = 184, hy = 58;
  const halo = g.createRadialGradient(hx, hy, 4, hx, hy, 44);
  halo.addColorStop(0, rgba(p.a.glow, 0.85));
  halo.addColorStop(1, rgba(p.a.glow, 0));
  g.fillStyle = halo;
  g.fillRect(hx - 46, hy - 46, 92, 92);
  pip(g, hx, hy, 54);
  // body: himation wrapped, to the bottom
  p.black('M58 250 C76 236 110 230 140 236 C160 244 168 266 166 304 C164 370 168 430 176 492 L36 492 C40 430 44 360 46 304 C46 280 48 262 58 250 Z');
  // himation border (red with white dots) diagonally across the chest
  p.red('M56 262 C86 284 118 316 150 362 L142 372 C110 328 80 298 50 276 Z');
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const x = 54 + t * 92, y = 270 + t * 96 + Math.sin(t * 3.1) * -6;
    g.beginPath();
    g.arc(x, y, 1.6, 0, Math.PI * 2);
    g.fillStyle = POTTERY.white;
    g.fill();
  }
  p.red('M40 462 L172 462 L176 492 L36 492 Z');
  meanderStripe(g, 40, 468, 136, 18);
  // folds
  p.incise('M64 300 C62 360 60 410 56 456');
  p.incise('M96 330 C96 380 98 420 100 456');
  p.incise('M128 360 C130 400 134 430 138 456');
  p.incise('M156 318 C158 370 162 420 166 456');
  // arm & fist on the scepter
  p.black('M130 262 C146 258 164 262 176 270 L176 288 C160 288 144 290 128 294 Z');
  p.black('M172 262 C180 256 192 258 194 266 C196 276 192 286 182 288 C174 290 168 280 172 262 Z');
  p.incise('M178 266 L190 268 M177 273 L190 275 M178 280 L189 281', 1.1);
  p.incise('M132 278 C144 276 156 276 168 278', 1.2);
  // hair: long archaic tresses down the back
  p.black('M134 96 C130 82 116 74 98 74 C78 74 62 86 58 106 C54 128 56 160 58 190 C60 214 58 236 54 256 L66 252 L74 258 L82 248 L92 252 C96 236 98 214 104 196 C108 182 110 166 112 152 Z');
  for (let i = 0; i < 5; i++) {
    const x = 64 + i * 8;
    p.incise(`M${x} ${120 + i * 4} C${x - 3} ${150 + i * 4} ${x + 3} ${180 + i * 2} ${x - 1} ${214 + (i % 2) * 8}`, 1.1);
  }
  // face (black): forehead, nose, cheek
  p.black('M128 92 C138 98 144 106 146 114 L161 142 C159 145 156 146 152 146 C153 150 152 152 150 154 L112 166 C108 150 108 126 112 110 C116 100 120 94 128 92 Z');
  // archaic pointed beard
  p.black('M153 148 C157 162 157 180 153 198 C149 216 143 232 138 250 C128 234 116 216 106 198 C100 186 102 170 110 158 C124 160 140 158 153 148 Z');
  for (let i = 0; i < 5; i++) {
    const x0 = 116 + i * 8;
    p.incise(`M${x0} ${166 + i} C${x0 + 2} ${186 + i * 2} ${x0 + 4} ${206 + i * 3} ${x0 + 6 - i} ${226 + i * 4}`, 1.1);
  }
  // hairline + beard edge separate the face from the hair mass
  p.incise('M132 94 C122 100 115 112 113 128 C111 144 110 154 106 166', 1.8);
  p.incise('M110 160 C122 166 138 164 151 152', 1.3);
  // moustache, eye, brow, ear
  p.incise('M156 150 C150 154 142 155 134 152', 1.4);
  p.incise('M129 119 C134 114 142 113 148 117 C142 121 134 122 129 119 Z', 1.4);
  g.beginPath();
  g.arc(140.5, 117.6, 2.1, 0, Math.PI * 2);
  g.fillStyle = shade(p.a.clayLight, 0.15);
  g.fill();
  p.incise('M126 109 C134 104 144 104 150 108', 1.4);
  p.incise('M114 132 C110 124 114 118 120 120 C124 124 122 132 116 136', 1.3);
  // laurel crown (added red leaves)
  for (let i = 0; i < 10; i++) {
    const t = i / 9;
    const ang = Math.PI * (1.02 + t * 0.66);
    const cx = 104, cy = 134, r = 56;
    const x = cx + Math.cos(ang) * r * 1.02, y = cy + Math.sin(ang) * r * 0.92;
    const tang = ang + Math.PI / 2;
    leafAt(g, x, y, tang + 0.55, 15, 6.2, POTTERY.red);
    leafAt(g, x, y, tang - 0.4, 13, 5.6, POTTERY.red);
  }
}

function leafAt(g: Ctx, x: number, y: number, ang: number, len: number, w: number, color: string): void {
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(len * 0.5, -w, len, 0);
  g.quadraticCurveTo(len * 0.5, w, 0, 0);
  g.fillStyle = color;
  g.fill();
  g.restore();
}

function meanderStripe(g: Ctx, x: number, y: number, w: number, h: number): void {
  meanderBand(g, x, y, w, h, POTTERY.black, { rules: false, pad: 1.5 });
}

// ───────────────────────────── panel ─────────────────────────────

export function paintCourtPanel(g: Ctx, rank: 11 | 12 | 13, el: Element, r: Rect, pip: PipFn): void {
  const a = ELEM_ART[el];
  g.save();
  g.translate(r.x, r.y);
  g.scale(r.w / PW, r.h / PH);
  g.beginPath();
  g.rect(0, 0, PW, PH);
  g.clip();
  clayGround(g, a, 300 + rank * 7 + el.length);
  const p = painter(g, a);
  if (rank === 11) hoplite(p, pip);
  else if (rank === 12) queen(p, pip);
  else king(p, pip);
  // glaze highlight
  const gl = g.createLinearGradient(0, 0, PW, 0);
  gl.addColorStop(0, 'rgba(255,255,255,0)');
  gl.addColorStop(0.18, 'rgba(255,255,255,0.10)');
  gl.addColorStop(0.3, 'rgba(255,255,255,0)');
  g.fillStyle = gl;
  g.fillRect(0, 0, PW, PH);
  g.restore();
  // frame
  g.save();
  g.lineWidth = 2.4;
  g.strokeStyle = POTTERY.black;
  g.strokeRect(r.x + 1.2, r.y + 1.2, r.w - 2.4, r.h - 2.4);
  g.lineWidth = 1;
  g.strokeStyle = rgba(a.clayLight, 0.9);
  g.strokeRect(r.x + 4.5, r.y + 4.5, r.w - 9, r.h - 9);
  g.restore();
}
