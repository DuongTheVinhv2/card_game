import type { Card, Element, HandType } from './types';
import { cardPower, bumpRank } from './cards';
import { evaluateHand, handBase, handRankIndex } from './hands';
import type { LaborDef, LaborInstance, Intent } from './labors';
import { LABOR_BY_ID, makeIntent } from './labors';
import type { BoonFx, BoonScoreCtx, CardContrib, BoonInst, BoonDef, BoonEnv } from './boons';
import { BOON_BY_ID } from './boons';
import type { EffectiveStats, RunState } from './run';
import { effectiveStats, hasFourCardRule, healRun } from './run';
import { RNG } from './rng';
import { SCROLL_BY_ID } from './scrolls';
import type { ScrollDef } from './scrolls';
import { weaponDef } from './weapons';

/** Player hits always deal at least this fraction of their total (glancing blow). */
export const MIN_PLAYER_HIT = 0.1;
/** Boss hits always deal at least this fraction of raw damage before Shield. */
export const MIN_BOSS_HIT = 0.2;
export const MAX_PLAY = 5;

export interface BossState {
  inst: LaborInstance;
  def: LaborDef;
  maxHp: number;
  hp: number;
  baseAtk: number;
  atk: number;
  baseDef: number;
  defense: number;
  /** DEF doubled until after the player's next hand */
  guard: boolean;
  intentIdx: number;
  intent: Intent;
  revived: boolean;
  petrified: boolean;
}

export interface BattleState {
  run: RunState;
  laborIndex: number;
  rng: RNG;
  boss: BossState;
  stats: EffectiveStats;
  draw: Card[];
  hand: Card[];
  pile: Card[];
  hexed: Set<number>;
  turn: number;
  discards: number;
  shield: number;
  lastHandType: HandType | null;
  typesPlayed: Set<HandType>;
  handsPlayed: number;
  fireScoredThisTurn: boolean;
  over: null | 'won' | 'lost';
  goldEarned: number;
  damageDealt: number;
  damageTaken: number;
}

export type StepKind = 'base' | 'atk' | 'card' | 'enh' | 'boon' | 'held';

export interface ScoreStep {
  kind: StepKind;
  power: number;
  mult: number;
  cardId?: number;
  boonUid?: number;
  element?: Element;
  dPower?: number;
  dMult?: number;
  xMult?: number;
  factor?: number;
  heal?: number;
  shield?: number;
  pierce?: number;
  gold?: number;
  hexed?: boolean;
  retrigger?: boolean;
  text?: string;
}

export interface PlayResult {
  handType: HandType;
  level: number;
  played: Card[];
  scoring: Card[];
  steps: ScoreStep[];
  power: number;
  mult: number;
  total: number;
  defBase: number;
  guard: boolean;
  pierce: number;
  effDef: number;
  damage: number;
  notes: string[];
  heal: number;
  healed: number;
  shield: number;
  gold: number;
  selfDamage: number;
  bossHpBefore: number;
  bossHpAfter: number;
  bossDied: boolean;
  revived: boolean;
  shattered: Card[];
  petrify: boolean;
  overkill: boolean;
}

export interface BossHit {
  raw: number;
  afterDef: number;
  absorbed: number;
  damage: number;
  reflected: number;
}

export interface BossTurnResult {
  intent: Intent;
  skipped: boolean;
  hits: BossHit[];
  bossHeal: number;
  guardOn: boolean;
  atkUp: number;
  playerHpBefore: number;
  playerHpAfter: number;
  playerDied: boolean;
  bossDied: boolean;
  revived: boolean;
  regrow: number;
  rampage: number;
  nextIntent: Intent;
}

export interface TurnStartResult {
  turn: number;
  drawn: Card[];
  reshuffled: boolean;
  discardsGained: number;
  shieldGained: number;
  healed: number;
  hexed: Card[];
}

export interface DiscardResult {
  discarded: Card[];
  drawn: Card[];
  reshuffled: boolean;
}

export interface ScrollUseResult {
  def: ScrollDef;
  changed: Card[];
  destroyed: Card[];
  drawn: Card[];
  healed: number;
  discardsGained: number;
}

// ---------------------------------------------------------------------------------------------

export function elementFactor(el: Element, inst: LaborInstance): number {
  if (el === inst.weak) return 2;
  if (inst.resists.includes(el)) return 0.5;
  return 1;
}

function boonList(run: RunState): Array<{ i: BoonInst; d: BoonDef }> {
  return run.boons.map((i) => ({ i, d: BOON_BY_ID[i.id] })).filter((x) => !!x.d);
}

export function handSize(b: BattleState): number {
  return Math.max(5, b.stats.handSize - (b.boss.def.twist.id === 'coils' && b.boss.hp > 0 ? 1 : 0));
}

function env(b: BattleState): BoonEnv {
  return { maxHp: b.stats.maxHp, hp: b.run.hp, turn: b.turn };
}

export function createBattle(run: RunState, laborIndex: number): BattleState {
  const inst = run.labors[laborIndex];
  const def = LABOR_BY_ID[inst.id];
  const rng = new RNG((run.seed ^ Math.imul(laborIndex + 1, 0x9e3779b1) ^ run.rngState) >>> 0);
  const stats = effectiveStats(run);
  const boss: BossState = {
    inst,
    def,
    maxHp: inst.maxHp,
    hp: inst.maxHp,
    baseAtk: inst.atk,
    atk: inst.atk,
    baseDef: inst.def,
    defense: inst.def,
    guard: false,
    intentIdx: 0,
    intent: makeIntent(def, def.pattern[0]),
    revived: false,
    petrified: false,
  };
  return {
    run,
    laborIndex,
    rng,
    boss,
    stats,
    draw: rng.shuffle(run.deck.slice()),
    hand: [],
    pile: [],
    hexed: new Set(),
    turn: 0,
    discards: stats.discards,
    shield: 0,
    lastHandType: null,
    typesPlayed: new Set(),
    handsPlayed: 0,
    fireScoredThisTurn: false,
    over: null,
    goldEarned: 0,
    damageDealt: 0,
    damageTaken: 0,
  };
}

function drawToHandSize(b: BattleState): { drawn: Card[]; reshuffled: boolean } {
  const target = handSize(b);
  const drawn: Card[] = [];
  let reshuffled = false;
  while (b.hand.length < target) {
    if (b.draw.length === 0) {
      if (b.pile.length === 0) break;
      b.draw = b.rng.shuffle(b.pile);
      b.pile = [];
      reshuffled = true;
    }
    const c = b.draw.pop()!;
    b.hand.push(c);
    drawn.push(c);
  }
  return { drawn, reshuffled };
}

export function startTurn(b: BattleState): TurnStartResult {
  b.turn++;
  b.run.stats.turns++;
  const res: TurnStartResult = { turn: b.turn, drawn: [], reshuffled: false, discardsGained: 0, shieldGained: 0, healed: 0, hexed: [] };
  b.shield = 0;
  b.fireScoredThisTurn = false;
  if (b.turn > 1) {
    const before = b.discards;
    b.discards = Math.min(b.stats.maxDiscards, b.discards + 1);
    res.discardsGained = b.discards - before;
  }
  for (const { i, d } of boonList(b.run)) {
    const fx = d.onTurnStart?.(env(b), i);
    if (!fx) continue;
    if (fx.shield) {
      b.shield += fx.shield;
      res.shieldGained += fx.shield;
    }
    if (fx.heal) res.healed += healRun(b.run, fx.heal);
  }
  const d = drawToHandSize(b);
  res.drawn = d.drawn;
  res.reshuffled = d.reshuffled;
  if (b.boss.def.twist.id === 'filth') {
    const clean = b.hand.filter((c) => !b.hexed.has(c.id));
    for (const c of b.rng.sample(clean, Math.min(2, clean.length))) {
      b.hexed.add(c.id);
      res.hexed.push(c);
    }
  }
  return res;
}

export function canDiscard(b: BattleState, ids: number[]): { ok: boolean; reason?: string } {
  if (b.over) return { ok: false };
  if (b.discards <= 0) return { ok: false, reason: 'No discards left' };
  if (ids.length === 0) return { ok: false, reason: 'Select cards to discard' };
  if (ids.length > MAX_PLAY) return { ok: false, reason: 'Up to 5 cards' };
  return { ok: true };
}

export function discardCards(b: BattleState, ids: number[]): DiscardResult {
  const cards = b.hand.filter((c) => ids.includes(c.id));
  b.hand = b.hand.filter((c) => !ids.includes(c.id));
  for (const c of cards) b.hexed.delete(c.id);
  b.pile.push(...cards);
  b.discards--;
  b.run.stats.cardsDiscarded += cards.length;
  for (const { i, d } of boonList(b.run)) d.onDiscard?.(cards, i);
  const dr = drawToHandSize(b);
  return { discarded: cards, drawn: dr.drawn, reshuffled: dr.reshuffled };
}

export function canPlay(b: BattleState, ids: number[]): { ok: boolean; reason?: string } {
  if (b.over) return { ok: false };
  if (ids.length === 0) return { ok: false, reason: 'Select up to 5 cards' };
  if (ids.length > MAX_PLAY) return { ok: false, reason: 'Up to 5 cards' };
  if (b.boss.def.twist.id === 'chase') {
    const need = Math.min(5, b.hand.length);
    if (ids.length !== need) return { ok: false, reason: `Endless Chase: play exactly ${need} cards` };
  }
  return { ok: true };
}

export function previewHand(b: BattleState, ids: number[]): { type: HandType; level: number; power: number; mult: number; scoringIds: number[] } | null {
  const played = b.hand.filter((c) => ids.includes(c.id));
  const ev = evaluateHand(played, { fourCard: hasFourCardRule(b.run) });
  if (!ev) return null;
  const level = b.run.handLevels[ev.type];
  const base = handBase(ev.type, level);
  return { type: ev.type, level, power: base.power, mult: base.mult, scoringIds: ev.scoring.map((c) => c.id) };
}

const round1 = (x: number) => Math.round(x * 100) / 100;

/**
 * Score a hand. With dryRun the battle is not mutated (random effects use a cloned RNG) —
 * used for previews and by the simulation bot.
 */
export function playHand(b: BattleState, ids: number[], dryRun = false): PlayResult {
  const run = b.run;
  const boss = b.boss;
  const rng = dryRun ? b.rng.clone() : b.rng;
  const played = b.hand.filter((c) => ids.includes(c.id));
  const ev = evaluateHand(played, { fourCard: hasFourCardRule(run) })!;
  const level = run.handLevels[ev.type];
  const base = handBase(ev.type, level);
  let power = base.power;
  let mult = base.mult;
  const steps: ScoreStep[] = [{ kind: 'base', power, mult }];

  const atk = b.stats.atk;
  if (atk !== 0) {
    power += atk;
    steps.push({ kind: 'atk', dPower: atk, power, mult });
  }

  let heal = 0;
  let shield = 0;
  let pierce = 0;
  let gold = 0;
  let fireScored = false;
  const shattered: Card[] = [];
  const boons = boonList(run);
  const held = b.hand.filter((c) => !ids.includes(c.id));
  const ctx: BoonScoreCtx = {
    handType: ev.type,
    played,
    scoring: ev.scoring,
    held,
    bossWeak: boss.inst.weak,
    firstHandOfBattle: b.handsPlayed === 0,
    firstTimeType: !b.typesPlayed.has(ev.type),
    rng,
  };

  const applyFx = (fx: BoonFx, step: Partial<ScoreStep> & { kind: StepKind }) => {
    if (fx.power) power += fx.power;
    if (fx.mult) mult += fx.mult;
    if (fx.xmult) mult *= fx.xmult;
    if (fx.heal) heal += fx.heal;
    if (fx.shield) shield += fx.shield;
    if (fx.pierce) pierce += fx.pierce;
    if (fx.gold) gold += fx.gold;
    steps.push({
      ...step,
      power,
      mult: round1(mult),
      dPower: fx.power || undefined,
      dMult: fx.mult || undefined,
      xMult: fx.xmult || undefined,
      heal: fx.heal || undefined,
      shield: fx.shield || undefined,
      pierce: fx.pierce || undefined,
      gold: fx.gold || undefined,
      text: fx.text,
    });
  };

  const weapon = weaponDef(run.weapon);
  if (weapon.id === 'greatsword' && played.length === 5) applyFx({ power: 8, text: 'Greatsword · Cleave' }, { kind: 'held' });
  if (weapon.id === 'swordshield') applyFx({ shield: 4, text: 'Shield · Brace' }, { kind: 'held' });
  if (weapon.id === 'staff') applyFx({ heal: 3, text: 'Staff · Renewal' }, { kind: 'held' });
  if (weapon.id === 'daggers' && played.length <= 3) applyFx({ mult: 1, text: 'Daggers · Quick strike' }, { kind: 'held' });
  if (weapon.id === 'axe' && boss.hp <= boss.maxHp / 2) applyFx({ power: 10, text: 'Battleaxe · Execute' }, { kind: 'held' });
  for (const card of ev.scoring) {
    let times = 1;
    for (const { d } of boons) if (d.retrigger) times += d.retrigger(card);
    for (let t = 0; t < times; t++) {
      if (b.hexed.has(card.id)) {
        steps.push({ kind: 'card', cardId: card.id, element: card.element, power, mult: round1(mult), hexed: true, retrigger: t > 0, text: 'Hexed' });
        continue;
      }
      const f = elementFactor(card.element, boss.inst);
      const cp = cardPower(card);
      const k: CardContrib = { power: Math.round(cp * f), factor: f, mult: 0, heal: 0, shield: 0, pierce: 0 };
      switch (card.element) {
        case 'fire':
          k.mult = 1 * f;
          fireScored = true;
          break;
        case 'water':
          k.heal = Math.max(1, Math.round(cp * 0.5 * f));
          break;
        case 'earth':
          k.shield = Math.max(1, Math.round(cp * f));
          break;
        case 'wind':
          k.pierce = 0.25 * f;
          break;
      }
      power += k.power;
      mult += k.mult;
      heal += k.heal;
      shield += k.shield;
      pierce += k.pierce;
      steps.push({
        kind: 'card',
        cardId: card.id,
        element: card.element,
        power,
        mult: round1(mult),
        dPower: k.power,
        dMult: k.mult || undefined,
        factor: f,
        heal: k.heal || undefined,
        shield: k.shield || undefined,
        pierce: k.pierce || undefined,
        retrigger: t > 0,
      });
      switch (card.enh) {
        case 'divine':
          applyFx({ mult: 4 }, { kind: 'enh', cardId: card.id });
          break;
        case 'olympian':
          applyFx({ xmult: 1.5 }, { kind: 'enh', cardId: card.id });
          break;
        case 'gilded':
          applyFx({ gold: 3 }, { kind: 'enh', cardId: card.id });
          break;
        case 'crystal':
          applyFx({ xmult: 2 }, { kind: 'enh', cardId: card.id });
          if (t === 0 && rng.chance(0.25)) shattered.push(card);
          break;
        default:
          break;
      }
      for (const { i, d } of boons) {
        const fx = d.onCard?.(card, k, ctx, i);
        if (fx) applyFx(fx, { kind: 'boon', boonUid: i.uid, cardId: card.id });
      }
    }
  }

  for (const card of held) {
    if (card.enh === 'marble' && !b.hexed.has(card.id)) applyFx({ xmult: 1.5 }, { kind: 'held', cardId: card.id });
  }

  for (const { i, d } of boons) {
    const fx = d.onHand?.(ctx, i);
    if (fx) applyFx(fx, { kind: 'boon', boonUid: i.uid });
  }

  mult = round1(mult);
  const total = Math.max(0, Math.round(power * mult));
  const guard = boss.guard;
  const defBase = boss.defense * (guard ? 2 : 1);
  const pierceTotal = Math.min(1, pierce + b.stats.pierce);
  const effDef = Math.round(defBase * (1 - pierceTotal));
  let damage = Math.max(Math.ceil(total * MIN_PLAYER_HIT), total - effDef);
  const notes: string[] = [];
  const twist = boss.def.twist.id;
  if (twist === 'hide' && handRankIndex(ev.type) < handRankIndex('three')) {
    damage = Math.round(damage * 0.5);
    notes.push('Impervious Hide · ½ damage');
  }
  if (twist === 'discipline' && b.lastHandType === ev.type) {
    damage = Math.round(damage * 0.5);
    notes.push('Amazon Discipline · ½ damage');
  }
  if (twist === 'threebodies') {
    const cap = Math.ceil(boss.maxHp / 3);
    if (damage > cap) {
      damage = cap;
      notes.push('Three Bodies · damage capped');
    }
  }
  const petrify = boons.some(({ d }) => d.petrify?.(ev.type));

  const result: PlayResult = {
    handType: ev.type,
    level,
    played,
    scoring: ev.scoring,
    steps,
    power,
    mult,
    total,
    defBase,
    guard,
    pierce: pierceTotal,
    effDef,
    damage,
    notes,
    heal,
    healed: 0,
    shield,
    gold,
    selfDamage: 0,
    bossHpBefore: boss.hp,
    bossHpAfter: Math.max(0, boss.hp - damage),
    bossDied: false,
    revived: false,
    shattered,
    petrify,
    overkill: damage >= boss.hp,
  };
  if (dryRun) return result;

  // ---- apply -------------------------------------------------------------------------------
  boss.hp = Math.max(0, boss.hp - damage);
  boss.guard = false;
  b.damageDealt += damage;
  run.stats.damageDealt += damage;
  if (damage > run.stats.bestHit) {
    run.stats.bestHit = damage;
    run.stats.bestHitHand = ev.type;
  }
  run.stats.handsPlayed++;
  run.handPlays[ev.type]++;

  result.healed = healRun(run, heal);
  b.shield += shield;
  run.gold += gold;
  b.goldEarned += gold;
  run.stats.goldEarned += gold;

  const playedIds = new Set(ids);
  b.hand = b.hand.filter((c) => !playedIds.has(c.id));
  for (const c of played) b.hexed.delete(c.id);
  const shatteredIds = new Set(shattered.map((c) => c.id));
  b.pile.push(...played.filter((c) => !shatteredIds.has(c.id)));
  if (shattered.length) run.deck = run.deck.filter((c) => !shatteredIds.has(c.id));

  b.lastHandType = ev.type;
  b.typesPlayed.add(ev.type);
  b.handsPlayed++;
  b.fireScoredThisTurn = b.fireScoredThisTurn || fireScored;

  for (const { i, d } of boons) {
    const fx = d.onHandPlayed?.(env(b), i);
    if (!fx) continue;
    if (fx.gold) {
      run.gold += fx.gold;
      b.goldEarned += fx.gold;
      run.stats.goldEarned += fx.gold;
      result.gold += fx.gold;
    }
    if (fx.selfDamage) {
      const dmg = Math.min(fx.selfDamage, Math.max(0, run.hp - 1));
      run.hp -= dmg;
      result.selfDamage += dmg;
    }
  }
  if (petrify) boss.petrified = true;

  if (boss.hp <= 0) {
    if (twist === 'underworld' && !boss.revived) {
      boss.revived = true;
      boss.hp = Math.round(boss.maxHp * 0.3);
      boss.atk = Math.round(boss.atk * 1.2);
      result.revived = true;
      result.bossHpAfter = boss.hp;
    } else {
      result.bossDied = true;
      b.over = 'won';
    }
  }
  return result;
}

export function bossTurn(b: BattleState): BossTurnResult {
  const run = b.run;
  const boss = b.boss;
  const intent = boss.intent;
  const res: BossTurnResult = {
    intent,
    skipped: false,
    hits: [],
    bossHeal: 0,
    guardOn: false,
    atkUp: 0,
    playerHpBefore: run.hp,
    playerHpAfter: run.hp,
    playerDied: false,
    bossDied: false,
    revived: false,
    regrow: 0,
    rampage: 0,
    nextIntent: intent,
  };
  const twist = boss.def.twist.id;

  if (boss.petrified) {
    boss.petrified = false;
    res.skipped = true;
  } else if (intent.hits > 0) {
    let dealt = 0;
    for (let h = 0; h < intent.hits; h++) {
      const raw = Math.max(1, Math.round(boss.atk * intent.atkMult));
      const afterDef = twist === 'unstoppable' ? raw : Math.max(Math.ceil(raw * MIN_BOSS_HIT), raw - b.stats.def);
      const absorbed = Math.min(b.shield, afterDef);
      b.shield -= absorbed;
      const damage = Math.min(run.hp, afterDef - absorbed);
      run.hp -= damage;
      dealt += damage;
      b.damageTaken += damage;
      run.stats.damageTaken += damage;
      let reflected = 0;
      for (const { i, d } of boonList(run)) {
        const fx = d.onPlayerDamaged?.(env(b), damage, i);
        if (fx?.reflect) reflected += fx.reflect;
      }
      if (reflected > 0 && boss.hp > 0) {
        boss.hp = Math.max(0, boss.hp - reflected);
        b.damageDealt += reflected;
        run.stats.damageDealt += reflected;
      }
      res.hits.push({ raw, afterDef, absorbed, damage, reflected });
      if (run.hp <= 0 || boss.hp <= 0) break;
    }
    if (intent.kind === 'drain' || twist === 'maneater') {
      const before = boss.hp;
      if (boss.hp > 0) boss.hp = Math.min(boss.maxHp, boss.hp + dealt);
      res.bossHeal = boss.hp - before;
    }
  } else if (intent.kind === 'guard') {
    boss.guard = true;
    res.guardOn = true;
  } else if (intent.kind === 'roar') {
    const up = Math.max(1, Math.round(boss.baseAtk * 0.2));
    boss.atk += up;
    res.atkUp = up;
  }

  res.playerHpAfter = run.hp;
  if (boss.hp <= 0) {
    if (twist === 'underworld' && !boss.revived) {
      boss.revived = true;
      boss.hp = Math.round(boss.maxHp * 0.3);
      boss.atk = Math.round(boss.atk * 1.2);
      res.revived = true;
    } else {
      res.bossDied = true;
      b.over = 'won';
    }
  }
  if (run.hp <= 0 && !res.bossDied) {
    res.playerDied = true;
    b.over = 'lost';
  }

  if (!b.over) {
    if (twist === 'regrowth' && !b.fireScoredThisTurn && boss.hp < boss.maxHp) {
      const before = boss.hp;
      boss.hp = Math.min(boss.maxHp, boss.hp + Math.round(boss.maxHp * 0.06));
      res.regrow = boss.hp - before;
    }
    if (twist === 'rampage') {
      const up = Math.max(1, Math.round(boss.baseAtk * 0.1));
      boss.atk += up;
      res.rampage = up;
    }
  }

  boss.intentIdx++;
  boss.intent = makeIntent(boss.def, boss.def.pattern[boss.intentIdx % boss.def.pattern.length]);
  res.nextIntent = boss.intent;
  return res;
}

/** Expected damage of the shown intent after the player's DEF and current Shield (for UI). */
export function intentPreview(b: BattleState): { perHit: number; hits: number; total: number } {
  const i = b.boss.intent;
  if (i.hits <= 0) return { perHit: 0, hits: 0, total: 0 };
  const raw = Math.max(1, Math.round(b.boss.atk * i.atkMult));
  const after = b.boss.def.twist.id === 'unstoppable' ? raw : Math.max(Math.ceil(raw * MIN_BOSS_HIT), raw - b.stats.def);
  return { perHit: after, hits: i.hits, total: after * i.hits };
}

export function rawIntentDamage(b: BattleState): number {
  const i = b.boss.intent;
  return i.hits > 0 ? Math.max(1, Math.round(b.boss.atk * i.atkMult)) : 0;
}

export function canUseScroll(b: BattleState | null, slot: number, ids: number[]): { ok: boolean; reason?: string } {
  const run = b?.run;
  if (!run) return { ok: false };
  const id = run.consumables[slot];
  if (!id) return { ok: false };
  const def = SCROLL_BY_ID[id];
  if (def.battleOnly && (!b || b.over)) return { ok: false, reason: 'Only during a Labor' };
  if (def.target) {
    const [mn, mx] = def.target;
    if (ids.length < mn || ids.length > mx) {
      return { ok: false, reason: mn === mx ? `Select exactly ${mn} card${mn > 1 ? 's' : ''}` : `Select ${mn}–${mx} cards` };
    }
  }
  return { ok: true };
}

export function useScroll(b: BattleState, slot: number, ids: number[]): ScrollUseResult {
  const run = b.run;
  const id = run.consumables[slot];
  const def = SCROLL_BY_ID[id];
  const sel = b.hand.filter((c) => ids.includes(c.id));
  const res: ScrollUseResult = { def, changed: [], destroyed: [], drawn: [], healed: 0, discardsGained: 0 };
  if (def.toElement) {
    for (const c of sel) c.element = def.toElement;
    res.changed = sel;
  } else if (def.toEnh) {
    for (const c of sel) c.enh = def.toEnh;
    res.changed = sel;
  } else if (def.id === 'strength') {
    for (const c of sel) c.rank = bumpRank(c.rank);
    res.changed = sel;
  } else if (def.id === 'fates') {
    const gone = new Set(sel.map((c) => c.id));
    b.hand = b.hand.filter((c) => !gone.has(c.id));
    run.deck = run.deck.filter((c) => !gone.has(c.id));
    for (const c of sel) b.hexed.delete(c.id);
    res.destroyed = sel;
    res.drawn = drawToHandSize(b).drawn;
  } else if (def.id === 'reflection') {
    const [left, right] = sel;
    if (left && right) {
      left.rank = right.rank;
      left.element = right.element;
      left.enh = right.enh;
      res.changed = [left];
    }
  } else if (def.id === 'haste') {
    b.discards += 2;
    res.discardsGained = 2;
  } else if (def.id === 'nectar') {
    res.healed = healRun(run, b.stats.maxHp * 0.3);
  }
  run.consumables.splice(slot, 1);
  return res;
}

export interface BattleRewards {
  lines: Array<{ label: string; amount: number }>;
  total: number;
  heal: number;
}

export function battleRewards(b: BattleState): BattleRewards {
  const run = b.run;
  const lines: Array<{ label: string; amount: number }> = [];
  lines.push({ label: `Labor ${b.boss.def.numeral} completed`, amount: b.boss.inst.gold });
  if (b.discards > 0) lines.push({ label: `Unused discards (${b.discards})`, amount: b.discards });
  const interest = Math.min(5, Math.floor(run.gold / 5));
  if (interest > 0) lines.push({ label: 'Interest (1 per 5 held, max 5)', amount: interest });
  for (const { i, d } of boonList(run)) {
    const fx = d.onBattleEnd?.(env(b), i);
    if (fx?.gold) lines.push({ label: d.name, amount: fx.gold });
  }
  const total = lines.reduce((s, l) => s + l.amount, 0);
  const heal = Math.round(b.stats.maxHp * run.mods.healAfter);
  return { lines, total, heal };
}

/** Commit the end of a won battle to the run. */
export function applyVictory(b: BattleState, rewards: BattleRewards): number {
  const run = b.run;
  run.gold += rewards.total;
  run.stats.goldEarned += rewards.total;
  run.laborsDefeated++;
  return healRun(run, rewards.heal);
}
