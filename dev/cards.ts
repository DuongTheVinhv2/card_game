// Dev contact sheet for the procedural card art.
//   ?sheet=cards    52 base cards + enhancement row + back
//   ?sheet=special  back, boons, constellations, scrolls, patrons
//   ?sheet=icons    every icon at 24 / 64 px (canvas + inline svg)
//   ?sheet=hand     cards at in-game size, overlapped like a fanned hand
//   ?zoom=1         single card at 2x  (&kind=face|back|boon|const|scroll|patron &rank=13 &el=fire &enh=none &i=0)
import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/cinzel/900.css';
import '@fontsource/cinzel-decorative/700.css';
import '@fontsource/marcellus/400.css';

import { ELEMENTS, RANKS, HAND_ORDER, type Element, type Enhancement, type Rank, type HandType } from '../src/logic/types';
import { ICON_NAMES, iconSVG, drawIcon, type IconName } from '../src/gfx/art/icons';
import {
  CARD_TEX_W, CARD_TEX_H, paintCardFace, paintCardBack, paintBoonCard, paintConstellationCard,
  paintScrollCard, paintPatronCard, loadCardFonts, paintCardFoilMask,
} from '../src/gfx/art/cardPainter';
import { CONSTELLATION_NAME } from '../src/gfx/art/constellations';
import * as TX from '../src/gfx/art/paint/textures';
import { paintCourtPanel } from '../src/gfx/art/paint/figures';
import { iconPathAt } from '../src/gfx/art/icons';

const q = new URLSearchParams(location.search);
const app = document.getElementById('app')!;
const stats = document.getElementById('stats')!;
const timings: number[] = [];
const painters: ((ctx: CanvasRenderingContext2D) => void)[] = [];

const ENHS: Enhancement[] = ['none', 'bronze', 'divine', 'olympian', 'gilded', 'marble', 'crystal'];
const HAND_NAME: Record<HandType, string> = {
  high: 'High Card', pair: 'Pair', twopair: 'Two Pair', three: 'Three of a Kind', straight: 'Straight', flush: 'Flush',
  fullhouse: 'Full House', four: 'Four of a Kind', straightflush: 'Straight Flush', royal: 'Royal Flush',
};
const BOONS: { id: string; name: string; rarity: 'common' | 'rare' | 'legendary'; icon: IconName }[] = [
  { id: 'b1', name: 'Bolt of Zeus', rarity: 'legendary', icon: 'thunderbolt' },
  { id: 'b2', name: 'Promethean Ember', rarity: 'rare', icon: 'ember' },
  { id: 'b3', name: 'Trident of the Deep', rarity: 'rare', icon: 'trident' },
  { id: 'b4', name: 'Bag of Aeolus', rarity: 'common', icon: 'aeolus' },
  { id: 'b5', name: "Athena's Owl", rarity: 'common', icon: 'owl' },
  { id: 'b6', name: 'Talaria', rarity: 'common', icon: 'sandals' },
  { id: 'b7', name: 'Aegis', rarity: 'legendary', icon: 'aegis' },
  { id: 'b8', name: 'Golden Fleece', rarity: 'legendary', icon: 'fleece' },
  { id: 'b9', name: 'Wheel of Tyche', rarity: 'rare', icon: 'tyche' },
  { id: 'b10', name: "Pandora's Pithos", rarity: 'rare', icon: 'pandora' },
  { id: 'b11', name: 'Apple of Discord', rarity: 'common', icon: 'eris' },
  { id: 'b12', name: 'Helm of Darkness', rarity: 'legendary', icon: 'hades' },
];
const SCROLLS: { id: string; name: string; icon: IconName; tint?: string }[] = [
  { id: 's1', name: 'Forge of Hephaestus', icon: 'hammer', tint: '#a8471c' },
  { id: 's2', name: "Sculptor's Chisel", icon: 'chisel', tint: '#4d5560' },
  { id: 's3', name: 'Shears of Atropos', icon: 'shears', tint: '#5a2448' },
  { id: 's4', name: 'Touch of Midas', icon: 'coin', tint: '#a07514' },
  { id: 's5', name: 'Philter', icon: 'chalice', tint: '#2a5f8a' },
];
const PATRONS: { id: string; name: string; epithet: string; icon: IconName; color: string }[] = [
  { id: 'zeus', name: 'Zeus', epithet: 'King of the Gods', icon: 'thunderbolt', color: '#2f5fbf' },
  { id: 'hera', name: 'Hera', epithet: 'Queen of Olympus', icon: 'peacock', color: '#2a8a86' },
  { id: 'demeter', name: 'Demeter', epithet: 'Giver of Grain', icon: 'wheat', color: '#b98a22' },
  { id: 'hades', name: 'Hades', epithet: 'Lord of the Dead', icon: 'bident', color: '#4b2a6b' },
  { id: 'aphrodite', name: 'Aphrodite', epithet: 'Born of the Foam', icon: 'dove', color: '#c2577a' },
  { id: 'apollo', name: 'Apollo', epithet: 'Lord of Light', icon: 'sun', color: '#d0861e' },
];

function cardCanvas(paint: (ctx: CanvasRenderingContext2D) => void, displayW = 200): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = CARD_TEX_W;
  c.height = CARD_TEX_H;
  const ctx = c.getContext('2d')!;
  const t0 = performance.now();
  paint(ctx);
  timings.push(performance.now() - t0);
  painters.push(paint);
  c.className = 'card';
  c.style.width = `${displayW}px`;
  return c;
}

/** downscale with high quality smoothing (approximates GPU mip filtering in game) */
function scaled(src: HTMLCanvasElement, w: number): HTMLCanvasElement {
  const h = Math.round((w * src.height) / src.width);
  let cur: HTMLCanvasElement = src;
  // successive halving for good minification
  while (cur.width / 2 > w * 1.0) {
    const n = document.createElement('canvas');
    n.width = Math.round(cur.width / 2);
    n.height = Math.round(cur.height / 2);
    const g = n.getContext('2d')!;
    g.imageSmoothingQuality = 'high';
    g.drawImage(cur, 0, 0, n.width, n.height);
    cur = n;
  }
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const g = out.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(cur, 0, 0, w, h);
  out.className = 'card';
  return out;
}

function section(title: string): HTMLElement {
  const h = document.createElement('h2');
  h.textContent = title;
  app.appendChild(h);
  const row = document.createElement('div');
  row.className = 'row';
  app.appendChild(row);
  return row;
}

function cell(row: HTMLElement, el: HTMLElement, label?: string) {
  const d = document.createElement('div');
  d.className = 'cell';
  d.appendChild(el);
  if (label) {
    const l = document.createElement('div');
    l.className = 'lbl';
    l.textContent = label;
    d.appendChild(l);
  }
  row.appendChild(d);
}

const face = (rank: Rank, element: Element, enh: Enhancement = 'none') => (ctx: CanvasRenderingContext2D) =>
  paintCardFace(ctx, { rank, element, enh, power: rank + (enh === 'bronze' ? 15 : 0) });

function sheetCards() {
  const W = Number(q.get('w') || 128);
  for (const el of ELEMENTS) {
    const row = section(`${el}`);
    row.style.gap = '6px';
    for (const r of RANKS) cell(row, scaled(cardCanvas(face(r, el)), W));
  }
  const row = section('enhancements + back');
  row.style.gap = '6px';
  const els: Element[] = ['fire', 'water', 'wind', 'earth', 'fire', 'water', 'wind'];
  const ranks: Rank[] = [14, 13, 7, 12, 11, 9, 5];
  ENHS.forEach((e, i) => cell(row, scaled(cardCanvas(face(ranks[i], els[i], e)), W), e));
  cell(row, scaled(cardCanvas(paintCardBack), W), 'back');
}

function sheetSpecial() {
  const W = Number(q.get('w') || 150);
  let row = section('back · boons');
  cell(row, scaled(cardCanvas(paintCardBack), W), 'back');
  for (const b of BOONS) cell(row, scaled(cardCanvas((c) => paintBoonCard(c, b)), W), `${b.rarity}`);
  row = section('constellations');
  for (const h of HAND_ORDER) cell(row, scaled(cardCanvas((c) => paintConstellationCard(c, { hand: h, constellation: CONSTELLATION_NAME[h], handName: HAND_NAME[h] })), W), h);
  row = section('scrolls · patrons');
  for (const s of SCROLLS) cell(row, scaled(cardCanvas((c) => paintScrollCard(c, s)), W));
  for (const p of PATRONS) cell(row, scaled(cardCanvas((c) => paintPatronCard(c, p)), W));
}

const BOON_ICONS: IconName[] = ['thunderbolt', 'ember', 'trident', 'aeolus', 'gaia', 'owl', 'sandals', 'nike', 'twins', 'hecate', 'amphora2', 'artemis',
  'lyre', 'mirror', 'fleece', 'achilles', 'aegis', 'asclepius', 'pandora', 'icarus', 'hades', 'ares', 'atlas', 'ariadne',
  'chiron', 'eris', 'harmonia', 'tyche', 'kronos', 'nemesis', 'persephone', 'cyclops', 'medusa', 'minotaur', 'hermes', 'olympus'];
const SCROLL_ICONS: IconName[] = ['caduceus', 'sun', 'hammer', 'chisel', 'shears', 'chalice', 'gem', 'coin', 'peacock', 'wheat', 'bident', 'dove'];

function sheetBoons() {
  const W = Number(q.get('w') || 112);
  const rar = ['common', 'rare', 'legendary'] as const;
  let row = section('every boon icon on a boon card');
  row.style.gap = '6px';
  BOON_ICONS.forEach((ic, i) => cell(row, scaled(cardCanvas((c) => paintBoonCard(c, { id: ic, name: ic, rarity: rar[i % 3], icon: ic })), W), ic));
  row = section('scroll / patron icons');
  row.style.gap = '6px';
  SCROLL_ICONS.forEach((ic, i) => cell(row, scaled(cardCanvas((c) => (i % 2
    ? paintScrollCard(c, { id: ic, name: ic, icon: ic, tint: ['#7a2a14', '#2a5f8a', '#3d6b2a', '#5a2448'][i % 4] })
    : paintPatronCard(c, { id: ic, name: ic, epithet: 'Patron of the Test', icon: ic, color: ['#2f5fbf', '#2a8a86', '#b98a22', '#4b2a6b', '#c2577a', '#d0861e'][i % 6] }))), W), ic));
}

function sheetIcons() {
  const grid = document.createElement('div');
  grid.className = 'icons';
  const BIG = Number(q.get('big') || 0) > 0 ? 120 : 64;
  if (BIG > 64) grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(170px, 1fr))';
  const only = q.get('only');
  app.appendChild(grid);
  for (const n of ICON_NAMES) {
    if (only && !only.split(',').includes(n)) continue;
    const d = document.createElement('div');
    d.className = 'ic';
    const pair = document.createElement('div');
    pair.className = 'pair';
    const c = document.createElement('canvas');
    c.width = BIG; c.height = BIG;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 0, BIG);
    grad.addColorStop(0, '#fff3c4'); grad.addColorStop(0.5, '#e2b24e'); grad.addColorStop(1, '#9a6a1c');
    drawIcon(g, n, 0, 0, BIG, grad, { shadow: 'rgba(255,190,80,0.35)', shadowBlur: 6 });
    const c2 = document.createElement('canvas');
    c2.width = 24; c2.height = 24;
    drawIcon(c2.getContext('2d')!, n, 0, 0, 24, '#f2ead8');
    pair.appendChild(c);
    pair.appendChild(c2);
    const sv = document.createElement('span');
    sv.innerHTML = iconSVG(n, { size: 16, color: '#f2ead8' });
    pair.appendChild(sv);
    d.appendChild(pair);
    const nm = document.createElement('div');
    nm.className = 'name';
    nm.textContent = n;
    d.appendChild(nm);
    grid.appendChild(d);
  }
  // light row: svg at 24 on parchment, to check holes / winding in the DOM path
  const h = document.createElement('h2');
  h.textContent = 'svg on light (24px)';
  app.appendChild(h);
  const lr = document.createElement('div');
  lr.className = 'ic light';
  lr.style.flexDirection = 'row';
  lr.style.flexWrap = 'wrap';
  lr.style.gap = '6px';
  lr.style.padding = '8px';
  lr.innerHTML = ICON_NAMES.map((n) => iconSVG(n, { size: 24, color: '#3a2a14' })).join('');
  app.appendChild(lr);
}

function sheetHand() {
  const sizes = [130, 150, 190];
  const hands: { r: Rank; e: Element; enh?: Enhancement }[][] = [
    [{ r: 14, e: 'fire' }, { r: 13, e: 'water' }, { r: 12, e: 'wind' }, { r: 11, e: 'earth' }, { r: 10, e: 'fire' }, { r: 9, e: 'water', enh: 'bronze' }, { r: 7, e: 'wind', enh: 'gilded' }, { r: 2, e: 'earth', enh: 'marble' }],
    [{ r: 5, e: 'earth' }, { r: 6, e: 'wind', enh: 'crystal' }, { r: 8, e: 'water', enh: 'divine' }, { r: 3, e: 'fire', enh: 'olympian' }, { r: 4, e: 'earth' }, { r: 10, e: 'wind' }, { r: 12, e: 'fire' }, { r: 14, e: 'water' }],
  ];
  for (const W of sizes) {
    for (const hand of hands) {
      const wrap = document.createElement('div');
      wrap.className = 'table';
      wrap.style.width = `${Math.round(W * (1 + 0.36 * (hand.length - 1)) + 40)}px`;
      const lab = document.createElement('div');
      lab.className = 'lbl';
      lab.textContent = `card width ${W}px, ~36% visible`;
      wrap.appendChild(lab);
      const h = document.createElement('div');
      h.className = 'hand';
      h.style.height = `${Math.round(W * 1.4) + 30}px`;
      hand.forEach((c, i) => {
        const cv = scaled(cardCanvas(face(c.r, c.e, c.enh)), W);
        cv.style.left = `${10 + i * W * 0.36}px`;
        cv.style.top = '12px';
        cv.style.transform = `rotate(${(i - (hand.length - 1) / 2) * 2}deg)`;
        cv.style.zIndex = String(i);
        h.appendChild(cv);
      });
      wrap.appendChild(h);
      app.appendChild(wrap);
    }
  }
}

function sheetZoom() {
  const kind = q.get('kind') || 'face';
  const i = Number(q.get('i') || 0);
  const scale = Number(q.get('s') || 2);
  let paint: (c: CanvasRenderingContext2D) => void;
  switch (kind) {
    case 'back': paint = paintCardBack; break;
    case 'boon': paint = (c) => paintBoonCard(c, BOONS[i % BOONS.length]); break;
    case 'const': { const h = HAND_ORDER[i % HAND_ORDER.length]; paint = (c) => paintConstellationCard(c, { hand: h, constellation: CONSTELLATION_NAME[h], handName: HAND_NAME[h] }); break; }
    case 'scroll': paint = (c) => paintScrollCard(c, SCROLLS[i % SCROLLS.length]); break;
    case 'patron': paint = (c) => paintPatronCard(c, PATRONS[i % PATRONS.length]); break;
    default: {
      const rank = Number(q.get('rank') || 13) as Rank;
      const el = (q.get('el') || 'fire') as Element;
      const enh = (q.get('enh') || 'none') as Enhancement;
      paint = face(rank, el, enh);
    }
  }
  const row = section(`zoom ${kind} x${scale}`);
  const ranks = q.get('ranks');
  if (ranks) {
    const els = (q.get('els') || q.get('el') || 'fire').split(',') as Element[];
    const enhs = (q.get('enhs') || q.get('enh') || 'none').split(',') as Enhancement[];
    ranks.split(',').forEach((rs, k) => {
      const spec = { rank: Number(rs) as Rank, element: els[k % els.length], enh: enhs[k % enhs.length] };
      const c = cardCanvas(face(spec.rank, spec.element, spec.enh), CARD_TEX_W * scale);
      c.style.borderRadius = '0';
      cell(row, c);
      if (q.get('mask')) {
        const m = cardCanvas((g) => paintCardFoilMask(g, spec), CARD_TEX_W * scale);
        m.style.borderRadius = '0';
        cell(row, m, 'foil mask');
      }
    });
    return;
  }
  const c = cardCanvas(paint, CARD_TEX_W * scale);
  c.style.borderRadius = '0';
  cell(row, c);
  if (q.get('pair')) {
    // second card of the same kind for comparison
    const c2 = cardCanvas(paint, CARD_TEX_W * scale);
    cell(row, c2);
  }
}

function sheetPerf() {
  (globalThis as { __ART_PROFILE?: boolean }).__ART_PROFILE = true;
  const out: string[] = [];
  const time = (label: string, f: () => unknown) => {
    const t0 = performance.now();
    f();
    out.push(`${label}: ${(performance.now() - t0).toFixed(1)}ms`);
  };
  time('parchment', () => TX.parchmentTex(CARD_TEX_W, CARD_TEX_H, 11, 'ivory'));
  time('marble white', () => TX.marbleTex(CARD_TEX_W, CARD_TEX_H, 5, 'white'));
  time('marble dark', () => TX.marbleTex(CARD_TEX_W, CARD_TEX_H, 8, 'dark'));
  time('pearl', () => TX.pearlTex(CARD_TEX_W, CARD_TEX_H));
  time('guilloche', () => TX.guillocheTex(CARD_TEX_W, CARD_TEX_H));
  time('crystal', () => TX.crystalTex(CARD_TEX_W, CARD_TEX_H));
  time('starfield', () => TX.starfieldTex(CARD_TEX_W, CARD_TEX_H, 31, 'indigo'));
  time('papyrus', () => TX.papyrusTex(CARD_TEX_W, CARD_TEX_H, 61));
  time('wood', () => TX.woodTex(CARD_TEX_W, CARD_TEX_H));
  time('goldleaf', () => TX.goldLeafTex(CARD_TEX_W, CARD_TEX_H));
  time('bronze', () => TX.bronzeTex(CARD_TEX_W, CARD_TEX_H));
  time('mottle', () => TX.mottleTex(216, 492, 301));
  for (const sd of [302, 303, 304]) time(`mottle ${sd}`, () => TX.mottleTex(216, 492, sd));
  for (const rk of [11, 12, 13] as const) {
    const pc = document.createElement('canvas');
    pc.width = 216; pc.height = 492;
    const pg = pc.getContext('2d')!;
    time(`court panel ${rk} (dummy pip)`, () => paintCourtPanel(pg, rk, 'fire', { x: 0, y: 0, w: 216, h: 492 }, () => {}));
  }
  {
    const sc = document.createElement('canvas');
    sc.width = CARD_TEX_W; sc.height = CARD_TEX_H;
    const sg2 = sc.getContext('2d')!;
    time('shadowBlur 26 icon fill', () => {
      sg2.save(); sg2.shadowColor = 'rgba(255,200,80,0.8)'; sg2.shadowBlur = 26; sg2.fillStyle = '#fc0';
      sg2.fill(iconPathAt('thunderbolt', 115, 160, 210)); sg2.restore();
    });
    time('shadowBlur 8 circle', () => {
      sg2.save(); sg2.shadowColor = 'rgba(0,0,0,0.4)'; sg2.shadowBlur = 8; sg2.beginPath(); sg2.arc(200, 300, 98, 0, 7); sg2.fill(); sg2.restore();
    });
  }
  const scratch = document.createElement('canvas');
  scratch.width = CARD_TEX_W; scratch.height = CARD_TEX_H;
  const g = scratch.getContext('2d')!;
  time('face 2 fire none (after textures)', () => face(2, 'fire')(g));
  time('face 2 water none', () => face(2, 'water')(g));
  time('face K fire', () => face(13, 'fire')(g));
  time('face J water', () => face(11, 'water')(g));
  time('face A wind', () => face(14, 'wind')(g));
  time('face 9 fire bronze', () => face(9, 'fire', 'bronze')(g));
  time('face 9 fire gilded', () => face(9, 'fire', 'gilded')(g));
  time('back', () => paintCardBack(g));
  time('boon legendary', () => paintBoonCard(g, BOONS[0]));
  time('constellation', () => paintConstellationCard(g, { hand: 'pair', constellation: 'Gemini', handName: 'Pair' }));
  time('scroll', () => paintScrollCard(g, SCROLLS[0]));
  time('patron', () => paintPatronCard(g, PATRONS[0]));
  const pre = document.createElement('pre');
  pre.textContent = out.join(String.fromCharCode(10));
  app.appendChild(pre);
  console.log(out.join(' | '));
}

async function main() {
  const t0 = performance.now();
  await loadCardFonts();
  const tFonts = performance.now() - t0;
  const sheet = q.get('zoom') ? 'zoom' : q.get('sheet') || 'cards';
  if (sheet === 'perf') sheetPerf();
  else if (sheet === 'boons') sheetBoons();
  else if (sheet === 'icons') sheetIcons();
  else if (sheet === 'special') sheetSpecial();
  else if (sheet === 'hand') sheetHand();
  else if (sheet === 'zoom') sheetZoom();
  else sheetCards();
  if (timings.length) {
    const stat = (arr: number[]) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
      return `avg ${avg.toFixed(2)} | median ${sorted[sorted.length >> 1].toFixed(2)} | max ${sorted[sorted.length - 1].toFixed(2)} ms`;
    };
    // steady state: repaint every card into a scratch canvas (caches warm)
    const scratch = document.createElement('canvas');
    scratch.width = CARD_TEX_W;
    scratch.height = CARD_TEX_H;
    const sg = scratch.getContext('2d')!;
    const warm: number[] = [];
    for (const p of painters) {
      const t0 = performance.now();
      p(sg);
      warm.push(performance.now() - t0);
    }
    const msg = `fonts ${tFonts.toFixed(0)}ms | ${timings.length} cards | first-paint ${stat(timings)} | warm repaint ${stat(warm)}`;
    stats.textContent = msg;
    console.log(msg);
  }
}
main().catch((e) => console.error(e));
