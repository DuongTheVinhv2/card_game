import { CARD_TEX_W, CARD_TEX_H, paintBoonCard, paintScrollCard, paintConstellationCard, paintPatronCard, paintCardFace } from '../gfx/art/cardPainter';
import { iconSVG, type IconName } from '../gfx/art/icons';
import { BOON_BY_ID } from '../logic/boons';
import { SCROLL_BY_ID, type ScrollId } from '../logic/scrolls';
import { HAND_INFO } from '../logic/hands';
import type { Card, HandType } from '../logic/types';
import { PATRON_BY_ID } from '../logic/patrons';
import { cardPower } from '../logic/cards';

const cache = new Map<string, string>();

function render(key: string, paint: (ctx: CanvasRenderingContext2D) => void, scale = 0.5): string {
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = CARD_TEX_W;
  c.height = CARD_TEX_H;
  paint(c.getContext('2d')!);
  let url: string;
  if (scale !== 1) {
    const s = document.createElement('canvas');
    s.width = Math.round(CARD_TEX_W * scale);
    s.height = Math.round(CARD_TEX_H * scale);
    const g = s.getContext('2d')!;
    g.imageSmoothingQuality = 'high';
    g.drawImage(c, 0, 0, s.width, s.height);
    url = s.toDataURL('image/png');
  } else url = c.toDataURL('image/png');
  cache.set(key, url);
  return url;
}

export function boonArt(id: string): string {
  const d = BOON_BY_ID[id];
  return render(`boon:${id}`, (ctx) => paintBoonCard(ctx, { id, name: d.name, rarity: d.rarity, icon: d.icon as IconName }), 0.6);
}

export function scrollArt(id: ScrollId): string {
  const d = SCROLL_BY_ID[id];
  return render(`scroll:${id}`, (ctx) => paintScrollCard(ctx, { id, name: d.name, icon: d.icon as IconName, tint: d.tint }), 0.6);
}

export function constellationArt(hand: HandType): string {
  const i = HAND_INFO[hand];
  return render(`const:${hand}`, (ctx) => paintConstellationCard(ctx, { hand, constellation: i.constellation, handName: i.name }), 0.6);
}

export function patronArt(id: string): string {
  const p = PATRON_BY_ID[id];
  return render(`patron:${id}`, (ctx) => paintPatronCard(ctx, { id, name: p.name, epithet: p.epithet, icon: p.icon as IconName, color: p.color }), 0.75);
}

export function cardArt(card: Card): string {
  return render(`card:${card.rank}|${card.element}|${card.enh}`, (ctx) =>
    paintCardFace(ctx, { rank: card.rank, element: card.element, enh: card.enh, power: cardPower(card) }), 0.45);
}

export function icon(name: string, cls = '', color?: string): string {
  return `<span class="ico ${cls}">${iconSVG(name as IconName, { color })}</span>`;
}
