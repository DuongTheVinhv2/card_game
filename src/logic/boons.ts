import type { Card, Element, HandType } from './types';
import { handContains, handRankIndex } from './hands';
import type { RNG } from './rng';

export type Rarity = 'common' | 'rare' | 'legendary';

export interface BoonInst {
  id: string;
  uid: number;
  /** per-boon scaling counter (Helm of Hades, Pomegranate…) */
  counter: number;
}

/** What a single scoring card contributed before boons (element factor already applied). */
export interface CardContrib {
  power: number;
  factor: number;
  mult: number;
  heal: number;
  shield: number;
  pierce: number;
}

export interface BoonScoreCtx {
  handType: HandType;
  played: Card[];
  scoring: Card[];
  held: Card[];
  bossWeak: Element;
  firstHandOfBattle: boolean;
  firstTimeType: boolean;
  rng: RNG;
}

export interface BoonEnv {
  maxHp: number;
  hp: number;
  turn: number;
}

export interface BoonFx {
  power?: number;
  mult?: number;
  xmult?: number;
  heal?: number;
  shield?: number;
  gold?: number;
  pierce?: number;
  selfDamage?: number;
  reflect?: number;
  /** flavour popup text */
  text?: string;
}

export interface StatMods {
  maxHp?: number;
  atk?: number;
  def?: number;
  handSize?: number;
  discards?: number;
  maxDiscards?: number;
  pierce?: number;
}

export interface BoonDef {
  id: string;
  name: string;
  rarity: Rarity;
  price: number;
  icon: string;
  desc: (inst?: BoonInst) => string;
  stats?: StatMods;
  fourCard?: boolean;
  retrigger?: (card: Card) => number;
  onCard?: (card: Card, contrib: CardContrib, ctx: BoonScoreCtx, inst: BoonInst) => BoonFx | null;
  onHand?: (ctx: BoonScoreCtx, inst: BoonInst) => BoonFx | null;
  onTurnStart?: (env: BoonEnv, inst: BoonInst) => BoonFx | null;
  onHandPlayed?: (env: BoonEnv, inst: BoonInst) => BoonFx | null;
  onPlayerDamaged?: (env: BoonEnv, dmg: number, inst: BoonInst) => BoonFx | null;
  onDiscard?: (cards: Card[], inst: BoonInst) => void;
  onBattleEnd?: (env: BoonEnv, inst: BoonInst) => BoonFx | null;
  petrify?: (type: HandType) => boolean;
}

const allFourElements = (cards: Card[]) => new Set(cards.map((c) => c.element)).size === 4;
const isFace = (c: Card) => c.rank >= 11 && c.rank <= 13;

export const BOONS: BoonDef[] = [
  {
    id: 'thunderbolt', name: 'Thunderbolt of Zeus', rarity: 'common', price: 5, icon: 'thunderbolt',
    desc: () => '+4 Mult',
    onHand: () => ({ mult: 4 }),
  },
  {
    id: 'ember', name: 'Ember of Prometheus', rarity: 'common', price: 5, icon: 'ember',
    desc: () => 'Scoring Fire cards give +2 Mult',
    onCard: (c) => (c.element === 'fire' ? { mult: 2 } : null),
  },
  {
    id: 'trident', name: 'Trident of Poseidon', rarity: 'common', price: 5, icon: 'trident',
    desc: () => 'Scoring Water cards give +25 Power and heal twice as much',
    onCard: (c, k) => (c.element === 'water' ? { power: 25, heal: k.heal } : null),
  },
  {
    id: 'aeolus', name: 'Bag of Aeolus', rarity: 'common', price: 5, icon: 'aeolus',
    desc: () => 'Scoring Wind cards give +25 Power and pierce twice as much',
    onCard: (c, k) => (c.element === 'wind' ? { power: 25, pierce: k.pierce } : null),
  },
  {
    id: 'gaia', name: 'Heart of Gaia', rarity: 'common', price: 5, icon: 'gaia',
    desc: () => 'Scoring Earth cards give +25 Power and twice the Shield',
    onCard: (c, k) => (c.element === 'earth' ? { power: 25, shield: k.shield } : null),
  },
  {
    id: 'owl', name: 'Owl of Athena', rarity: 'rare', price: 8, icon: 'owl',
    desc: () => '+1 hand size',
    stats: { handSize: 1 },
  },
  {
    id: 'sandals', name: 'Winged Sandals', rarity: 'common', price: 5, icon: 'sandals',
    desc: () => '+2 Discards at the start of each battle and +1 max Discards',
    stats: { discards: 2, maxDiscards: 1 },
  },
  {
    id: 'nike', name: 'Wreath of Nike', rarity: 'rare', price: 7, icon: 'nike',
    desc: () => '×2 Mult if the hand contains a Straight',
    onHand: (ctx) => (handContains(ctx.handType, 'straight') ? { xmult: 2 } : null),
  },
  {
    id: 'twins', name: 'Castor & Pollux', rarity: 'common', price: 4, icon: 'twins',
    desc: () => '+8 Mult if the hand contains a Pair',
    onHand: (ctx) => (handContains(ctx.handType, 'pair') ? { mult: 8 } : null),
  },
  {
    id: 'amphora', name: 'Amphora of Dionysus', rarity: 'common', price: 5, icon: 'amphora2',
    desc: () => '+10 Mult if the hand contains Two Pair',
    onHand: (ctx) => (handContains(ctx.handType, 'twopair') ? { mult: 10 } : null),
  },
  {
    id: 'hecate', name: 'Torches of Hecate', rarity: 'common', price: 5, icon: 'hecate',
    desc: () => '+12 Mult if the hand contains Three of a Kind',
    onHand: (ctx) => (handContains(ctx.handType, 'three') ? { mult: 12 } : null),
  },
  {
    id: 'artemis', name: 'Bow of Artemis', rarity: 'rare', price: 7, icon: 'artemis',
    desc: () => '×3 Mult on your first hand of each battle',
    onHand: (ctx) => (ctx.firstHandOfBattle ? { xmult: 3 } : null),
  },
  {
    id: 'lyre', name: 'Lyre of Apollo', rarity: 'rare', price: 7, icon: 'lyre',
    desc: () => 'Retrigger every scoring 2, 3, 4, 5 and 6',
    retrigger: (c) => (c.rank <= 6 ? 1 : 0),
  },
  {
    id: 'mirror', name: 'Mirror of Narcissus', rarity: 'rare', price: 7, icon: 'mirror',
    desc: () => 'Retrigger every scoring J, Q and K',
    retrigger: (c) => (isFace(c) ? 1 : 0),
  },
  {
    id: 'fleece', name: 'Golden Fleece', rarity: 'common', price: 5, icon: 'fleece',
    desc: () => 'Earn 1 Drachma per hand played and 3 after each battle',
    onHandPlayed: () => ({ gold: 1 }),
    onBattleEnd: () => ({ gold: 3 }),
  },
  {
    id: 'achilles', name: 'Spear of Achilles', rarity: 'common', price: 5, icon: 'achilles',
    desc: () => 'Scoring Aces give +20 Power and +4 Mult',
    onCard: (c) => (c.rank === 14 ? { power: 20, mult: 4 } : null),
  },
  {
    id: 'aegis', name: 'The Aegis', rarity: 'common', price: 5, icon: 'aegis',
    desc: () => 'Gain Shield equal to 12% of max HP at the start of each turn',
    onTurnStart: (env) => ({ shield: Math.round(env.maxHp * 0.12) }),
  },
  {
    id: 'asclepius', name: 'Rod of Asclepius', rarity: 'common', price: 5, icon: 'asclepius',
    desc: () => 'Heal 5% of max HP at the start of each turn',
    onTurnStart: (env) => ({ heal: Math.max(1, Math.round(env.maxHp * 0.05)) }),
  },
  {
    id: 'pandora', name: "Pandora's Pithos", rarity: 'rare', price: 7, icon: 'pandora',
    desc: () => '×2.5 Mult, but lose 5% of max HP every hand you play',
    onHand: () => ({ xmult: 2.5 }),
    onHandPlayed: (env) => ({ selfDamage: Math.max(1, Math.round(env.maxHp * 0.05)) }),
  },
  {
    id: 'icarus', name: 'Wings of Icarus', rarity: 'rare', price: 7, icon: 'icarus',
    desc: () => '×2 Mult, but −1 hand size',
    stats: { handSize: -1 },
    onHand: () => ({ xmult: 2 }),
  },
  {
    id: 'hades', name: 'Helm of Hades', rarity: 'rare', price: 7, icon: 'hades',
    desc: (i) => `Gains +1 Mult every time you take damage (currently +${i?.counter ?? 0} Mult)`,
    onHand: (_ctx, i) => (i.counter > 0 ? { mult: i.counter } : null),
    onPlayerDamaged: (_env, dmg, i) => {
      if (dmg > 0) i.counter++;
      return null;
    },
  },
  {
    id: 'ares', name: 'Spear of Ares', rarity: 'common', price: 6, icon: 'ares',
    desc: () => '+12 ATK',
    stats: { atk: 12 },
  },
  {
    id: 'atlas', name: 'Burden of Atlas', rarity: 'common', price: 6, icon: 'atlas',
    desc: () => '+40 max HP and +6 DEF',
    stats: { maxHp: 40, def: 6 },
  },
  {
    id: 'ariadne', name: 'Thread of Ariadne', rarity: 'rare', price: 7, icon: 'ariadne',
    desc: () => 'Straights and Flushes can be made with 4 cards',
    fourCard: true,
  },
  {
    id: 'chiron', name: 'Wisdom of Chiron', rarity: 'rare', price: 7, icon: 'chiron',
    desc: () => '×2 Mult the first time you play each hand type in a battle',
    onHand: (ctx) => (ctx.firstTimeType ? { xmult: 2 } : null),
  },
  {
    id: 'eris', name: 'Apple of Eris', rarity: 'rare', price: 7, icon: 'eris',
    desc: () => '×3 Mult if the played hand contains all four elements',
    onHand: (ctx) => (allFourElements(ctx.played) ? { xmult: 3 } : null),
  },
  {
    id: 'harmonia', name: 'Necklace of Harmonia', rarity: 'rare', price: 8, icon: 'harmonia',
    desc: () => "Scoring cards of the foe's weakness give ×1.3 Mult",
    onCard: (c, _k, ctx) => (c.element === ctx.bossWeak ? { xmult: 1.3 } : null),
  },
  {
    id: 'tyche', name: 'Wheel of Tyche', rarity: 'common', price: 5, icon: 'tyche',
    desc: () => '1 in 3 chance for ×3 Mult',
    onHand: (ctx) => (ctx.rng.chance(1 / 3) ? { xmult: 3, text: 'Fortune!' } : { text: 'Fate frowns' }),
  },
  {
    id: 'kronos', name: 'Sickle of Kronos', rarity: 'rare', price: 8, icon: 'kronos',
    desc: () => 'Ignore 40% of enemy DEF',
    stats: { pierce: 0.4 },
  },
  {
    id: 'nemesis', name: 'Scales of Nemesis', rarity: 'rare', price: 7, icon: 'nemesis',
    desc: () => 'Whenever you take damage, deal 300% of it back (ignores DEF)',
    onPlayerDamaged: (_env, dmg) => (dmg > 0 ? { reflect: dmg * 3 } : null),
  },
  {
    id: 'persephone', name: 'Pomegranate of Persephone', rarity: 'common', price: 5, icon: 'persephone',
    desc: (i) => `+3 Power for every card you discard this run (currently +${(i?.counter ?? 0) * 3})`,
    onHand: (_ctx, i) => (i.counter > 0 ? { power: i.counter * 3 } : null),
    onDiscard: (cards, i) => {
      i.counter += cards.length;
    },
  },
  {
    id: 'cyclops', name: 'Eye of the Cyclops', rarity: 'common', price: 5, icon: 'cyclops',
    desc: () => '+20 Mult if you play 3 or fewer cards',
    onHand: (ctx) => (ctx.played.length <= 3 ? { mult: 20 } : null),
  },
  {
    id: 'minotaur', name: 'Horn of the Minotaur', rarity: 'common', price: 5, icon: 'minotaur',
    desc: () => 'Scoring J, Q and K give +30 Power',
    onCard: (c) => (isFace(c) ? { power: 30 } : null),
  },
  {
    id: 'hermes', name: 'Purse of Hermes', rarity: 'common', price: 4, icon: 'hermes',
    desc: () => '+5 Drachmae after each battle; rerolls cost 1 less',
    onBattleEnd: () => ({ gold: 5 }),
  },
  {
    id: 'medusa', name: 'Head of Medusa', rarity: 'legendary', price: 10, icon: 'medusa',
    desc: () => 'Playing a Full House or better petrifies the foe: it skips its next action',
    petrify: (t) => handRankIndex(t) >= handRankIndex('fullhouse'),
  },
  {
    id: 'olympus', name: 'Crown of Olympus', rarity: 'legendary', price: 12, icon: 'olympus',
    desc: () => 'Retrigger every scoring card',
    retrigger: () => 1,
  },
];

export const BOON_BY_ID: Record<string, BoonDef> = Object.fromEntries(BOONS.map((b) => [b.id, b]));

export const MAX_BOONS = 5;

export const RARITY_WEIGHT: Record<Rarity, number> = { common: 70, rare: 26, legendary: 4 };
