import type { HandType } from './types';
import { HAND_ORDER } from './types';
import type { RunState } from './run';
import { addBoon, canAddBoon, canAddConsumable, effectiveStats, hasBoon, healRun, runRng, saveRng } from './run';
import type { BoonDef } from './boons';
import { BOONS, BOON_BY_ID, RARITY_WEIGHT } from './boons';
import type { ScrollId } from './scrolls';
import { SCROLLS, SCROLL_BY_ID } from './scrolls';
import type { RNG } from './rng';
import { HAND_INFO } from './hands';

export type ElixirId = 'ambrosia' | 'hebe' | 'rage' | 'bronze' | 'feather';

export interface ElixirDef {
  id: ElixirId;
  name: string;
  icon: string;
  price: number;
  desc: string;
  apply: (run: RunState) => void;
}

export const ELIXIRS: ElixirDef[] = [
  {
    id: 'ambrosia', name: 'Ambrosia', icon: 'hp', price: 5, desc: '+15 max HP and heal 15.',
    apply: (run) => {
      run.base.maxHp += 15;
      healRun(run, 15);
    },
  },
  {
    id: 'hebe', name: 'Cup of Hebe', icon: 'chalice', price: 4, desc: 'Heal 40% of your max HP.',
    apply: (run) => void healRun(run, effectiveStats(run).maxHp * 0.4),
  },
  {
    id: 'rage', name: 'Rage of Ares', icon: 'atk', price: 5, desc: '+5 ATK (adds Power to every hand).',
    apply: (run) => {
      run.base.atk += 5;
    },
  },
  {
    id: 'bronze', name: 'Hoplite Bronze', icon: 'def', price: 5, desc: '+3 DEF (reduces every hit you take).',
    apply: (run) => {
      run.base.def += 3;
    },
  },
  {
    id: 'feather', name: 'Feather of Hermes', icon: 'discard', price: 6, desc: '+1 Discard at the start of every battle.',
    apply: (run) => {
      run.base.discards += 1;
      run.base.maxDiscards += 1;
    },
  },
];
export const ELIXIR_BY_ID: Record<ElixirId, ElixirDef> = Object.fromEntries(ELIXIRS.map((e) => [e.id, e])) as Record<ElixirId, ElixirDef>;

export const CONSTELLATION_PRICE = 3;

export type ShopItem =
  | { kind: 'boon'; id: string; price: number; sold: boolean }
  | { kind: 'constellation'; hand: HandType; price: number; sold: boolean }
  | { kind: 'scroll'; id: ScrollId; price: number; sold: boolean }
  | { kind: 'elixir'; id: ElixirId; price: number; sold: boolean };

export interface ShopState {
  items: ShopItem[];
  elixirs: ShopItem[];
  rerollCost: number;
  rerolls: number;
}

function priceOf(run: RunState, base: number): number {
  return Math.max(1, base - run.mods.discount);
}

export function rollBoon(run: RunState, rng: RNG, exclude: Set<string> = new Set()): BoonDef | null {
  const pool = BOONS.filter((b) => !hasBoon(run, b.id) && !exclude.has(b.id));
  if (!pool.length) return null;
  return rng.weighted(pool, (b) => RARITY_WEIGHT[b.rarity]);
}

function rollConstellation(run: RunState, rng: RNG): HandType {
  // favour hands the player actually uses
  return rng.weighted(HAND_ORDER, (h) => 1 + run.handPlays[h] * 0.6 + (h === 'royal' ? -0.5 : 0));
}

function rollMainItem(run: RunState, rng: RNG, taken: Set<string>): ShopItem {
  const r = rng.next();
  if (r < 0.55) {
    const b = rollBoon(run, rng, taken);
    if (b) {
      taken.add(b.id);
      return { kind: 'boon', id: b.id, price: priceOf(run, b.price), sold: false };
    }
  }
  if (r < 0.8) {
    const h = rollConstellation(run, rng);
    return { kind: 'constellation', hand: h, price: priceOf(run, CONSTELLATION_PRICE), sold: false };
  }
  const s = rng.pick(SCROLLS);
  return { kind: 'scroll', id: s.id, price: priceOf(run, s.price), sold: false };
}

function rollMainRow(run: RunState, rng: RNG): ShopItem[] {
  const taken = new Set<string>();
  const items: ShopItem[] = [];
  for (let i = 0; i < 3; i++) items.push(rollMainItem(run, rng, taken));
  // guarantee at least one boon when possible — boons are the heart of a build
  if (!items.some((x) => x.kind === 'boon')) {
    const b = rollBoon(run, rng, taken);
    if (b) items[0] = { kind: 'boon', id: b.id, price: priceOf(run, b.price), sold: false };
  }
  return items;
}

export function generateShop(run: RunState): ShopState {
  const rng = runRng(run);
  const items = rollMainRow(run, rng);
  const elixirs = rng.sample(ELIXIRS, 2).map<ShopItem>((e) => ({ kind: 'elixir', id: e.id, price: priceOf(run, e.price), sold: false }));
  saveRng(run, rng);
  return { items, elixirs, rerollCost: hasBoon(run, 'hermes') ? 1 : 2, rerolls: 0 };
}

export function rerollShop(run: RunState, shop: ShopState): boolean {
  if (run.gold < shop.rerollCost) return false;
  run.gold -= shop.rerollCost;
  const rng = runRng(run);
  shop.items = rollMainRow(run, rng);
  saveRng(run, rng);
  shop.rerolls++;
  shop.rerollCost++;
  return true;
}

export function itemName(item: ShopItem): string {
  switch (item.kind) {
    case 'boon':
      return BOON_BY_ID[item.id].name;
    case 'constellation':
      return HAND_INFO[item.hand].constellation;
    case 'scroll':
      return SCROLL_BY_ID[item.id].name;
    case 'elixir':
      return ELIXIR_BY_ID[item.id].name;
  }
}

export function canBuy(run: RunState, item: ShopItem): { ok: boolean; reason?: string } {
  if (item.sold) return { ok: false, reason: 'Sold' };
  if (run.gold < item.price) return { ok: false, reason: 'Not enough Drachmae' };
  if (item.kind === 'boon' && !canAddBoon(run)) return { ok: false, reason: 'Boon slots full — sell one first' };
  if (item.kind === 'scroll' && !canAddConsumable(run)) return { ok: false, reason: 'Scroll slots full' };
  return { ok: true };
}

/** Purchase; returns true on success. Constellations level up immediately. */
export function buyItem(run: RunState, item: ShopItem): boolean {
  if (!canBuy(run, item).ok) return false;
  run.gold -= item.price;
  item.sold = true;
  switch (item.kind) {
    case 'boon':
      addBoon(run, item.id);
      break;
    case 'constellation':
      run.handLevels[item.hand]++;
      break;
    case 'scroll':
      run.consumables.push(item.id);
      break;
    case 'elixir':
      ELIXIR_BY_ID[item.id].apply(run);
      break;
  }
  return true;
}

/** Three free boons offered after a Labor (the Gifts of the Gods). */
export function rollGifts(run: RunState, n = 3): string[] {
  const rng = runRng(run);
  const taken = new Set<string>();
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    // gifts skew slightly rarer than the shop
    const pool = BOONS.filter((b) => !hasBoon(run, b.id) && !taken.has(b.id));
    if (!pool.length) break;
    const b = rng.weighted(pool, (x) => RARITY_WEIGHT[x.rarity] * (x.rarity === 'common' ? 0.8 : 1.3));
    taken.add(b.id);
    out.push(b.id);
  }
  saveRng(run, rng);
  return out;
}

export interface SanctuaryOption {
  id: 'rest' | 'train' | 'fortify' | 'meditate' | 'study';
  name: string;
  icon: string;
  desc: string;
  apply: (run: RunState) => void;
}

export function sanctuaryOptions(run: RunState): SanctuaryOption[] {
  const max = effectiveStats(run).maxHp;
  const hand = HAND_ORDER.slice().sort((a, b) => run.handPlays[b] - run.handPlays[a])[0];
  return [
    {
      id: 'rest', name: 'Rest by the Spring', icon: 'heal',
      desc: `Heal 50% of your max HP (+${Math.round(max * 0.5)}).`,
      apply: (r) => void healRun(r, max * 0.5),
    },
    {
      id: 'train', name: 'Train with Chiron', icon: 'atk', desc: '+6 ATK permanently.',
      apply: (r) => {
        r.base.atk += 6;
      },
    },
    {
      id: 'fortify', name: 'Temper your Bronze', icon: 'def', desc: '+4 DEF permanently.',
      apply: (r) => {
        r.base.def += 4;
      },
    },
    {
      id: 'meditate', name: 'Feast of the Gods', icon: 'hp', desc: '+25 max HP and heal 25.',
      apply: (r) => {
        r.base.maxHp += 25;
        healRun(r, 25);
      },
    },
    {
      id: 'study', name: 'Read the Stars', icon: 'star',
      desc: `Level up ${HAND_INFO[hand].name} twice (your most played hand).`,
      apply: (r) => {
        r.handLevels[hand] += 2;
      },
    },
  ];
}
