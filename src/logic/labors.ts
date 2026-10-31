import type { CreatureId, Element, IntentKind } from './types';
import { ELEMENTS } from './types';
import { BEATS, BEATEN_BY } from './elements';
import type { RNG } from './rng';

export type LaborId = Exclude<CreatureId, 'heracles'>;

export type TwistId =
  | 'hide' | 'regrowth' | 'chase' | 'rampage' | 'filth' | 'feathers'
  | 'unstoppable' | 'maneater' | 'discipline' | 'threebodies' | 'coils' | 'underworld';

export interface LaborDef {
  id: LaborId;
  index: number;
  numeral: string;
  name: string;
  short: string;
  flavor: string;
  lore: string;
  twist: { id: TwistId; name: string; desc: string };
  mods: { hp: number; atk: number; def: number };
  pattern: IntentKind[];
  intentNames: Partial<Record<IntentKind, string>>;
}

export const LABORS: LaborDef[] = [
  {
    id: 'lion', index: 1, numeral: 'I', name: 'The Nemean Lion', short: 'Nemean Lion',
    flavor: 'Its golden hide turns every blade.',
    lore: 'A beast whose golden hide no blade could pierce, terrorizing the hills of Nemea. Heracles cornered it in its cave, strangled it with his bare hands, and wore its skin as armor ever after.',
    twist: { id: 'hide', name: 'Impervious Hide', desc: 'Hands weaker than Three of a Kind deal half damage.' },
    mods: { hp: 0.9, atk: 0.95, def: 1.6 },
    pattern: ['strike', 'strike', 'guard', 'heavy'],
    intentNames: { strike: 'Rending Claws', heavy: 'Pounce', guard: 'Golden Hide' },
  },
  {
    id: 'hydra', index: 2, numeral: 'II', name: 'The Lernaean Hydra', short: 'Hydra',
    flavor: 'Cut one head, and two grow back.',
    lore: 'A many-headed serpent of the Lernaean swamp whose very breath was poison. For every head Heracles struck off, two grew back — until his nephew Iolaus seared each stump with a burning brand.',
    twist: { id: 'regrowth', name: 'Regrowth', desc: 'Regenerates 6% HP each turn unless a Fire card scored that turn — cauterize the wounds!' },
    mods: { hp: 1.15, atk: 0.9, def: 0.8 },
    pattern: ['volley', 'strike', 'roar', 'heavy'],
    intentNames: { volley: 'Sevenfold Bite', strike: 'Venom Lash', roar: 'Hiss of Many', heavy: 'Immortal Fang' },
  },
  {
    id: 'hind', index: 3, numeral: 'III', name: 'The Ceryneian Hind', short: 'Ceryneian Hind',
    flavor: 'Sacred to Artemis, swifter than an arrow.',
    lore: 'A golden-antlered deer sacred to Artemis, so swift it could outrun an arrow in flight. Heracles chased it for a full year before taking it alive, without spilling a single drop of its blood.',
    twist: { id: 'chase', name: 'Endless Chase', desc: 'You must play exactly 5 cards every hand.' },
    mods: { hp: 0.85, atk: 1.0, def: 0.9 },
    pattern: ['strike', 'volley', 'strike', 'heavy'],
    intentNames: { strike: 'Antler Gore', volley: 'Flurry of Hooves', heavy: 'Silver Charge' },
  },
  {
    id: 'boar', index: 4, numeral: 'IV', name: 'The Erymanthian Boar', short: 'Erymanthian Boar',
    flavor: 'A mountain of muscle and tusk.',
    lore: 'A colossal boar that ravaged the slopes of Mount Erymanthos. Heracles drove it roaring into deep snow until it collapsed, then carried it alive to King Eurystheus — who hid in a bronze jar.',
    twist: { id: 'rampage', name: 'Rampage', desc: 'Gains +10% ATK at the end of every turn.' },
    mods: { hp: 1.0, atk: 1.0, def: 1.0 },
    pattern: ['strike', 'heavy', 'strike', 'strike'],
    intentNames: { strike: 'Tusk Rip', heavy: 'Avalanche Charge' },
  },
  {
    id: 'stables', index: 5, numeral: 'V', name: 'The Augean Mire', short: 'Augean Mire',
    flavor: 'Thirty years of filth, given hideous form.',
    lore: 'King Augeas’ stables had not been cleaned in thirty years; the filth of three thousand cattle festered there. Heracles turned the rivers Alpheus and Peneus through them and washed it all away in a day.',
    twist: { id: 'filth', name: 'Filth', desc: 'Each turn, 2 cards in your hand become Hexed and score nothing. Discard them to cleanse.' },
    mods: { hp: 1.2, atk: 0.9, def: 1.0 },
    pattern: ['strike', 'guard', 'strike', 'heavy'],
    intentNames: { strike: 'Muck Slam', guard: 'Crust Over', heavy: 'Deluge of Filth' },
  },
  {
    id: 'birds', index: 6, numeral: 'VI', name: 'The Stymphalian Warden', short: 'Stymphalian Warden',
    flavor: 'Feathers of bronze, beaks that split armor.',
    lore: 'Man-eating birds with beaks of bronze and feathers sharp as arrowheads swarmed the Stymphalian marsh. With a rattle forged by Hephaestus, Heracles scared them into the sky and shot them down.',
    twist: { id: 'feathers', name: 'Bronze Feathers', desc: 'Every attack strikes 3 times. DEF reduces each hit.' },
    mods: { hp: 0.9, atk: 1.1, def: 0.8 },
    pattern: ['volley', 'strike', 'guard', 'heavy'],
    intentNames: { volley: 'Feather Storm', strike: 'Bronze Beaks', guard: 'Wall of Wings', heavy: 'Diving Swarm' },
  },
  {
    id: 'bull', index: 7, numeral: 'VII', name: 'The Cretan Minotaur', short: 'Cretan Minotaur',
    flavor: "Poseidon's gift, Minos' curse.",
    lore: 'A magnificent white bull sent by Poseidon, driven mad when King Minos refused to sacrifice it. It ravaged Crete until Heracles wrestled it into submission and carried it across the sea.',
    twist: { id: 'unstoppable', name: 'Unstoppable', desc: 'Its attacks ignore your DEF (Shield still blocks).' },
    mods: { hp: 1.05, atk: 1.0, def: 1.1 },
    pattern: ['strike', 'heavy', 'guard', 'heavy'],
    intentNames: { strike: 'Gore', heavy: 'Labyrinth Charge', guard: 'Stamp & Snort' },
  },
  {
    id: 'mares', index: 8, numeral: 'VIII', name: 'The Diomedian Nightmare', short: 'Diomedian Nightmare',
    flavor: 'Fed on the flesh of men, they hunger still.',
    lore: 'The mares of the Thracian king Diomedes were fed on human flesh and breathed fire. Heracles fed the cruel king to his own horses, which calmed them long enough to be led away.',
    twist: { id: 'maneater', name: 'Man-Eaters', desc: 'Heals for all damage it deals to you.' },
    mods: { hp: 0.95, atk: 1.05, def: 0.9 },
    pattern: ['strike', 'drain', 'strike', 'heavy'],
    intentNames: { strike: 'Trample', drain: 'Devour', heavy: 'Stampede' },
  },
  {
    id: 'hippolyta', index: 9, numeral: 'IX', name: 'Hippolyta', short: 'Hippolyta',
    flavor: 'Queen of the Amazons, bearer of the Girdle of Ares.',
    lore: 'Queen of the Amazons, who wore the war-girdle given to her by Ares himself. She would have gifted it freely — but Hera, disguised as an Amazon, stirred her warriors to battle.',
    twist: { id: 'discipline', name: 'Amazon Discipline', desc: 'Repeating your previous hand type deals half damage.' },
    mods: { hp: 1.0, atk: 1.05, def: 1.2 },
    pattern: ['strike', 'guard', 'heavy', 'roar'],
    intentNames: { strike: 'Spear Thrust', guard: 'Pelta Wall', heavy: "Ares' Fury", roar: 'War Cry' },
  },
  {
    id: 'geryon', index: 10, numeral: 'X', name: 'Geryon', short: 'Geryon',
    flavor: 'Three bodies, one terrible will.',
    lore: 'A giant of three bodies who herded red cattle on Erytheia, the island at the edge of the world. Heracles crossed the Ocean in the golden cup of the Sun and felled him with Hydra-venomed arrows.',
    twist: { id: 'threebodies', name: 'Three Bodies', desc: 'A single hand can deal at most one third of its max HP.' },
    mods: { hp: 1.2, atk: 1.0, def: 1.1 },
    pattern: ['volley', 'heavy', 'strike', 'guard'],
    intentNames: { volley: 'Six-Armed Barrage', heavy: 'Triple Cleave', strike: 'Spear of Erytheia', guard: 'Shield Wall' },
  },
  {
    id: 'ladon', index: 11, numeral: 'XI', name: 'Ladon', short: 'Ladon',
    flavor: 'The hundred-headed guardian of the golden apples.',
    lore: 'The hundred-headed dragon coiled around the tree of golden apples in the Garden of the Hesperides, never sleeping. Atlas fetched the apples while Heracles held up the sky in his place.',
    twist: { id: 'coils', name: 'Constricting Coils', desc: '−1 hand size while Ladon lives.' },
    mods: { hp: 1.1, atk: 1.0, def: 1.0 },
    pattern: ['strike', 'drain', 'guard', 'heavy'],
    intentNames: { strike: 'Serpent Strike', drain: 'Coil & Crush', guard: 'Scales of Gold', heavy: 'Hundred-Headed Fury' },
  },
  {
    id: 'cerberus', index: 12, numeral: 'XII', name: 'Cerberus', short: 'Cerberus',
    flavor: 'The hound at the gates of Hades.',
    lore: 'The three-headed hound guarding the gates of the Underworld, with a serpent for a tail. Heracles subdued it with his bare hands and dragged it, blinking, into the light of day.',
    twist: { id: 'underworld', name: 'Guardian of the Dead', desc: 'The first time it falls, it rises again with 30% HP and +20% ATK.' },
    mods: { hp: 0.9, atk: 1.05, def: 1.0 },
    pattern: ['volley', 'heavy', 'drain', 'roar'],
    intentNames: { volley: 'Three-Headed Bite', heavy: 'Hellfire Maul', drain: 'Devour Soul', roar: 'Howl of Hades' },
  },
];

export const LABOR_BY_ID: Record<LaborId, LaborDef> = Object.fromEntries(LABORS.map((l) => [l.id, l])) as Record<LaborId, LaborDef>;

export interface Intent {
  kind: IntentKind;
  name: string;
  hits: number;
  /** ATK multiplier per hit */
  atkMult: number;
}

const INTENT_BASE: Record<IntentKind, { name: string; hits: number; atkMult: number }> = {
  strike: { name: 'Strike', hits: 1, atkMult: 1.0 },
  heavy: { name: 'Crushing Blow', hits: 1, atkMult: 1.8 },
  volley: { name: 'Volley', hits: 3, atkMult: 0.42 },
  guard: { name: 'Guard', hits: 0, atkMult: 0 },
  roar: { name: 'Roar', hits: 0, atkMult: 0 },
  drain: { name: 'Drain', hits: 1, atkMult: 0.9 },
  curse: { name: 'Hex', hits: 0, atkMult: 0 },
};

export const INTENT_DESC: Record<IntentKind, string> = {
  strike: 'Attacks once.',
  heavy: 'A charged attack dealing 180% ATK.',
  volley: 'Attacks 3 times for 42% ATK each. DEF reduces every hit.',
  guard: 'Doubles its DEF until after your next hand.',
  roar: 'Permanently raises its ATK by 20%.',
  drain: 'Attacks for 90% ATK and heals for the damage dealt.',
  curse: 'Hexes cards in your hand.',
};

export function makeIntent(def: LaborDef, kind: IntentKind): Intent {
  const b = INTENT_BASE[kind];
  let hits = b.hits;
  let atkMult = b.atkMult;
  if (def.twist.id === 'feathers' && hits > 0) {
    // every attack becomes a 3-hit volley carrying slightly more total force
    const total = hits * atkMult * 1.12;
    hits = Math.max(3, hits);
    atkMult = total / hits;
  }
  return { kind, name: def.intentNames[kind] ?? b.name, hits, atkMult };
}

/** Base stats by stage (0-based). Later stages hit much harder. */
export const STAGE_BASE = [
  { hp: 2200, atk: 20, def: 25, gold: 8 },
  { hp: 5200, atk: 25, def: 60, gold: 10 },
  { hp: 11000, atk: 34, def: 125, gold: 12 },
];

export function stageBase(stage: number): { hp: number; atk: number; def: number; gold: number } {
  if (stage < STAGE_BASE.length) return STAGE_BASE[stage];
  const last = STAGE_BASE[STAGE_BASE.length - 1];
  const k = stage - (STAGE_BASE.length - 1);
  return {
    hp: Math.round(last.hp * Math.pow(2.5, k)),
    atk: Math.round(last.atk + 12 * k),
    def: Math.round(last.def * Math.pow(1.6, k)),
    gold: last.gold + 2 * k,
  };
}

export interface LaborInstance {
  id: LaborId;
  element: Element;
  resists: Element[];
  weak: Element;
  stage: number;
  maxHp: number;
  atk: number;
  def: number;
  gold: number;
}

const SECOND_RESIST_CHANCE = [0.25, 0.6, 1.0];

export function rollLaborInstance(rng: RNG, id: LaborId, stage: number, element: Element): LaborInstance {
  const def = LABOR_BY_ID[id];
  const base = stageBase(stage);
  const resists: Element[] = [BEATS[element]];
  const p = SECOND_RESIST_CHANCE[Math.min(stage, SECOND_RESIST_CHANCE.length - 1)];
  if (rng.chance(p)) resists.push(element);
  return {
    id,
    element,
    resists,
    weak: BEATEN_BY[element],
    stage,
    maxHp: Math.round((base.hp * def.mods.hp) / 10) * 10,
    atk: Math.round(base.atk * def.mods.atk),
    def: Math.round(base.def * def.mods.def),
    gold: base.gold,
  };
}

/** Pick `count` distinct labors (in canonical labor order) with distinct random elements. */
export function generateLabors(rng: RNG, count = 3): LaborInstance[] {
  const picked = rng.sample(LABORS, count).sort((a, b) => a.index - b.index);
  const els = rng.shuffle(ELEMENTS.slice());
  return picked.map((l, i) => rollLaborInstance(rng, l.id, i, els[i % els.length]));
}

/** For endless mode: next labor not yet faced. */
export function generateEndlessLabor(rng: RNG, faced: LaborId[], stage: number): LaborInstance {
  const pool = LABORS.filter((l) => !faced.includes(l.id));
  const def = pool.length ? rng.pick(pool) : rng.pick(LABORS);
  return rollLaborInstance(rng, def.id, stage, rng.pick(ELEMENTS));
}
