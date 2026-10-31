import * as THREE from 'three';
import { paintCardFace, paintCardBack, paintCardFoilMask, CARD_TEX_W, CARD_TEX_H } from '../art/cardPainter';
import type { Card } from '../../logic/types';
import { cardPower } from '../../logic/cards';

let maxAniso = 8;
export function setMaxAnisotropy(n: number): void {
  maxAniso = n;
}

interface Entry {
  tex: THREE.CanvasTexture;
  refs: number;
  lastUsed: number;
}

const cache = new Map<string, Entry>();
const MAX_IDLE = 64;

export function faceKey(card: Card): string {
  return `${card.rank}|${card.element}|${card.enh}|${cardPower(card)}`;
}

function makeTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

export function acquireFaceTexture(card: Card): { key: string; tex: THREE.Texture } {
  const key = faceKey(card);
  let e = cache.get(key);
  if (!e) {
    const c = document.createElement('canvas');
    c.width = CARD_TEX_W;
    c.height = CARD_TEX_H;
    paintCardFace(c.getContext('2d')!, { rank: card.rank, element: card.element, enh: card.enh, power: cardPower(card) });
    e = { tex: makeTexture(c), refs: 0, lastUsed: 0 };
    cache.set(key, e);
  }
  e.refs++;
  e.lastUsed = performance.now();
  evict();
  return { key, tex: e.tex };
}

export function releaseFaceTexture(key: string): void {
  const e = cache.get(key);
  if (!e) return;
  e.refs = Math.max(0, e.refs - 1);
  e.lastUsed = performance.now();
}

function evict(): void {
  const idle = [...cache.entries()].filter(([, e]) => e.refs === 0);
  if (idle.length <= MAX_IDLE) return;
  idle.sort((a, b) => a[1].lastUsed - b[1].lastUsed);
  for (let i = 0; i < idle.length - MAX_IDLE; i++) {
    idle[i][1].tex.dispose();
    cache.delete(idle[i][0]);
  }
}

let back: THREE.CanvasTexture | null = null;
export function getBackTexture(): THREE.Texture {
  if (back) return back;
  const c = document.createElement('canvas');
  c.width = CARD_TEX_W;
  c.height = CARD_TEX_H;
  paintCardBack(c.getContext('2d')!);
  back = makeTexture(c);
  return back;
}

/** Pre-paint the base deck so the first deal does not hitch. Spreads work over frames. */
export async function warmFaceTextures(cards: Card[], perFrame = 6): Promise<void> {
  for (let i = 0; i < cards.length; i++) {
    const { key } = acquireFaceTexture(cards[i]);
    releaseFaceTexture(key);
    if (i % perFrame === perFrame - 1) await new Promise((r) => requestAnimationFrame(() => r(null)));
  }
}

// ------------------------------------------------------------------ foil masks
const masks = new Map<string, Entry>();

export function maskKey(card: Card): string {
  return [card.rank, card.element, card.enh].join('|');
}

/** White where holographic / polychrome / crystal foil should shimmer, black over ranks, pips and figures. */
export function acquireMaskTexture(card: Card): { key: string; tex: THREE.Texture } {
  const key = maskKey(card);
  let e = masks.get(key);
  if (!e) {
    const full = document.createElement('canvas');
    full.width = CARD_TEX_W;
    full.height = CARD_TEX_H;
    paintCardFoilMask(full.getContext('2d')!, { rank: card.rank, element: card.element, enh: card.enh });
    // masks are soft: store at half resolution
    const c = document.createElement('canvas');
    c.width = CARD_TEX_W / 2;
    c.height = CARD_TEX_H / 2;
    const g = c.getContext('2d')!;
    g.imageSmoothingQuality = 'high';
    g.drawImage(full, 0, 0, c.width, c.height);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.NoColorSpace;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    e = { tex, refs: 0, lastUsed: 0 };
    masks.set(key, e);
  }
  e.refs++;
  e.lastUsed = performance.now();
  return { key, tex: e.tex };
}

export function releaseMaskTexture(key: string): void {
  const e = masks.get(key);
  if (!e) return;
  e.refs = Math.max(0, e.refs - 1);
  if (e.refs === 0 && masks.size > 24) {
    e.tex.dispose();
    masks.delete(key);
  }
}
