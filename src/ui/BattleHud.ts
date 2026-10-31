import { h, retrigger } from './dom';
import { icon, boonArt, scrollArt } from './art';
import { tooltip } from './tooltip';
import type { BattleState } from '../logic/battle';
import { intentPreview } from '../logic/battle';
import { ELEMENT_INFO } from '../logic/elements';
import { LABOR_BY_ID, INTENT_DESC } from '../logic/labors';
import type { Intent } from '../logic/labors';
import { BOON_BY_ID, MAX_BOONS } from '../logic/boons';
import type { RunState } from '../logic/run';
import { boonSellValue } from '../logic/run';
import { SCROLL_BY_ID, MAX_CONSUMABLES } from '../logic/scrolls';
import { HAND_INFO } from '../logic/hands';
import type { HandType, Element } from '../logic/types';
import { formatNum, formatMult } from '../core/anim';

export interface HudCallbacks {
  onPlay(): void;
  onDiscard(): void;
  onSort(mode: 'rank' | 'element'): void;
  onScrollClick(slot: number): void;
  onScrollUse(slot: number): void;
  onOptions(): void;
  onDeck(): void;
  onHands(): void;
}

const INTENT_ICON: Record<string, string> = {
  strike: 'intentStrike', heavy: 'intentHeavy', volley: 'intentVolley', guard: 'intentGuard', roar: 'intentRoar', drain: 'intentDrain', curse: 'intentCurse',
};

function elChip(el: Element, cls = ''): string {
  return `<span class="chip-mini el-${el} ${cls}">${icon(el)}${ELEMENT_INFO[el].name}</span>`;
}

export function boonTooltip(id: string, counter = 0, sell = false): string {
  const d = BOON_BY_ID[id];
  const inst = { id, uid: 0, counter };
  return `<div class="tt-sub rarity-${d.rarity}">${d.rarity} boon</div><div class="tt-title">${d.name}</div><div class="tt-row">${d.desc(inst)}</div>${
    sell ? `<div class="tt-row tt-dim">Sell value: <span class="c-gold">${boonSellValue(inst)}</span> drachmae</div>` : ''
  }`;
}

export class BattleHud {
  readonly root: HTMLElement;
  readonly stageArea: HTMLElement;
  private cb: HudCallbacks;
  private els: Record<string, HTMLElement> = {};
  private shownPower = 0;
  private shownMult = 0;
  private bossHp = { hp: NaN, max: 1 };
  private heroHp = { hp: 0, max: 1, shield: 0 };
  private heroShown: number | null = null;
  selectedScroll = -1;

  constructor(parent: HTMLElement, cb: HudCallbacks) {
    this.cb = cb;
    const E = this.els;
    const q = (k: string, el: HTMLElement) => ((E[k] = el), el);

    // ---------------- left column
    const foe = h('div', { class: 'panel foe-panel' },
      q('foeNum', h('div', { class: 'numeral' })),
      q('foeName', h('div', { class: 'foe-name title-gold' })),
      q('foeFlavor', h('div', { class: 'flavor' })),
      q('foeEls', h('div', { class: 'el-row' })),
      h('div', { class: 'twist' }, q('twistName', h('div', { class: 't-name' })), q('twistDesc', h('div', { class: 't-desc' }))),
    );

    const score = h('div', { class: 'panel score-panel' },
      q('handName', h('div', { class: 'hand-name' })),
      h('div', { class: 'score-boxes' },
        q('powerBox', h('div', { class: 'sbox power' }, h('span', { class: 'cap', text: 'POWER' }), q('power', h('span', { class: 'val', text: '0' })))),
        h('div', { class: 'times', text: '×' }),
        q('multBox', h('div', { class: 'sbox mult' }, h('span', { class: 'cap', text: 'MULT' }), q('mult', h('span', { class: 'val', text: '0' })))),
      ),
      q('total', h('div', { class: 'total-line' })),
    );

    const hero = h('div', { class: 'panel hero-panel' },
      h('div', { class: 'hero-head' }, h('div', { class: 'hero-name title-gold', text: 'Eirik' }), q('heroLabel', h('div', { class: 'label', text: 'The Northbound' }))),
      q('heroBar', h('div', { class: 'bar' },
        q('heroLag', h('div', { class: 'lag' })),
        q('heroFill', h('div', { class: 'fill' })),
        q('heroShield', h('div', { class: 'shield-fill', style: 'width:0' })),
        h('div', { class: 'shine' }),
        q('heroTxt', h('div', { class: 'txt' })),
      )),
      h('div', { class: 'stat-grid' },
        q('statAtk', h('div', { class: 'stat atk', html: `${icon('atk')}<span class="v">0</span><span class="k">ATK</span>` })),
        q('statDef', h('div', { class: 'stat def', html: `${icon('def')}<span class="v">0</span><span class="k">DEF</span>` })),
        q('statSh', h('div', { class: 'stat sh', html: `${icon('shield')}<span class="v">0</span><span class="k">SHIELD</span>` })),
      ),
      h('div', { class: 'res-row' },
        q('discards', h('div', { class: 'res', html: `${icon('discard', '', '#ff8da0')}<span class="pips"></span>` })),
        q('gold', h('div', { class: 'res c-gold', html: `${icon('gold', '', '#ffd25a')}<span class="v">0</span>` })),
      ),
    );

    const foot = h('div', { class: 'left-foot' },
      h('button', { class: 'btn dark small', html: 'Hands', on: { click: () => cb.onHands() } }),
      h('button', { class: 'btn dark small', html: 'Deck', on: { click: () => cb.onDeck() } }),
      h('button', { class: 'btn dark small', html: `Options`, on: { click: () => cb.onOptions() } }),
    );

    const left = h('div', { class: 'left-col' }, foe, score, hero, foot);

    // ---------------- stage area
    const plate = q('plate', h('div', { class: 'boss-plate' },
      q('bossName', h('div', { class: 'bname title-gold' })),
      h('div', { class: 'bar' },
        q('bossLag', h('div', { class: 'lag' })),
        q('bossFill', h('div', { class: 'fill' })),
        h('div', { class: 'shine' }),
        q('bossTxt', h('div', { class: 'txt' })),
      ),
      q('bossStats', h('div', { class: 'bstats' })),
    ));
    const intent = q('intent', h('div', { class: 'intent' }));
    const topRow = h('div', { class: 'top-row' },
      h('div', { class: 'slot-group' }, h('div', { class: 'label', text: `Boons of Olympus` }), q('boons', h('div', { class: 'slots' }))),
      h('div', { class: 'slot-group' }, h('div', { class: 'label', text: 'Scrolls' }), q('scrolls', h('div', { class: 'slots' }))),
    );
    const controls = h('div', { class: 'controls' },
      q('play', h('button', { class: 'btn play', html: 'Play Hand', on: { click: () => cb.onPlay() } })),
      h('div', { class: 'sort-box' },
        h('div', { class: 'label', text: 'Sort' }),
        h('div', { class: 'row' },
          h('button', { class: 'btn dark small', text: 'Rank', on: { click: () => cb.onSort('rank') } }),
          h('button', { class: 'btn dark small', text: 'Element', on: { click: () => cb.onSort('element') } }),
        ),
      ),
      q('discard', h('button', { class: 'btn red discard', html: 'Discard', on: { click: () => cb.onDiscard() } })),
    );
    const hint = q('hint', h('div', { class: 'hint' }));
    const deck = q('deck', h('div', { class: 'deck-info clickable', on: { click: () => cb.onDeck() } }));
    this.stageArea = h('div', { class: 'stage-area' }, plate, intent, topRow, controls, hint, deck);
    const danger = q('danger', h('div', { class: 'danger-vignette' }));

    this.root = h('div', { class: 'battle-hud screen' }, danger, left, this.stageArea);
    parent.appendChild(this.root);

    tooltip.attach(E.statAtk, () => `<div class="tt-title">ATK</div>Adds <span class="c-power">+Power</span> to every hand you play.`);
    tooltip.attach(E.statDef, () => `<div class="tt-title">DEF</div>Reduces the damage of every hit you take (min 20% gets through).`);
    tooltip.attach(E.statSh, () => `<div class="tt-title">Shield</div>Absorbs damage before HP. Gained from <span class="el-earth">Earth</span> cards and some boons. Fades at the start of your next turn.`);
    tooltip.attach(E.discards, () => `<div class="tt-title">Discards</div>Throw away up to 5 cards and draw new ones. Discarding does not end your turn. +1 Discard regenerates every turn.`);
    tooltip.attach(E.gold, () => `<div class="tt-title">Drachmae</div>Spend them in the Agora. Earn interest: 1 per 5 held (max 5) after each Labor.`);
  }

  // ------------------------------------------------------------------ foe
  setFoe(b: BattleState): void {
    const E = this.els;
    const inst = b.boss.inst;
    const def = LABOR_BY_ID[inst.id];
    E.foeNum.textContent = `Labor ${def.numeral} · Stage ${inst.stage + 1}`;
    E.foeName.textContent = def.name;
    E.foeFlavor.textContent = def.flavor;
    E.foeEls.innerHTML =
      `<span class="tag">ELEMENT</span>${elChip(inst.element)}` +
      `<span style="flex-basis:100%;height:0"></span>` +
      `<span class="tag">WEAK</span>${elChip(inst.weak, 'weak')}` +
      `<span class="tag" style="margin-left:.3rem">RESISTS</span>${inst.resists.map((r) => elChip(r, 'res')).join('')}`;
    E.twistName.innerHTML = `${icon('skull', '', '#ff9d7a')} ${def.twist.name}`;
    E.twistDesc.textContent = def.twist.desc;
    E.bossName.textContent = def.name;
    E.plate.className = `boss-plate el-${inst.element}`;
    tooltip.attach(E.foeEls, () =>
      `<div class="tt-title">Elements</div>` +
      `<div class="tt-row">${ELEMENT_INFO[inst.weak].name} cards deal <b class="c-good">×2</b> (and double their signature effect).</div>` +
      `<div class="tt-row">${inst.resists.map((r) => ELEMENT_INFO[r].name).join(' and ')} cards are <b class="c-bad">halved</b>.</div>` +
      `<div class="tt-row tt-dim">Water ▶ Fire ▶ Wind ▶ Earth ▶ Water</div>`,
    );
  }

  // ------------------------------------------------------------------ score
  setHand(type: HandType | null, level = 1, opts: { preview?: boolean } = {}): void {
    const E = this.els;
    if (!type) {
      E.handName.innerHTML = '&nbsp;';
      return;
    }
    E.handName.innerHTML = `${HAND_INFO[type].name}<span class="lvl">LV.${level}</span>`;
    if (!opts.preview) retrigger(E.handName, 'bump');
  }

  setScore(power: number, mult: number, bump: 'power' | 'mult' | 'both' | null = null): void {
    const E = this.els;
    this.shownPower = power;
    this.shownMult = mult;
    E.power.textContent = formatNum(Math.round(power));
    E.mult.textContent = formatMult(mult);
    if (bump === 'power' || bump === 'both') retrigger(E.power, 'bump');
    if (bump === 'mult' || bump === 'both') retrigger(E.mult, 'bump');
  }

  setHot(on: boolean): void {
    this.els.powerBox.classList.toggle('hot', on);
    this.els.multBox.classList.toggle('hot', on);
  }

  setTotal(html: string | null, flame = false): void {
    const t = this.els.total;
    t.innerHTML = html ?? '';
    t.classList.toggle('flame', flame);
    if (html) retrigger(t, 'bump');
  }

  // ------------------------------------------------------------------ hero
  setHero(hp: number, max: number, shield: number): void {
    const E = this.els;
    this.heroHp = { hp, max, shield };
    const pct = Math.max(0, Math.min(100, (hp / max) * 100));
    E.heroFill.style.width = `${pct}%`;
    E.heroLag.style.width = `${pct}%`;
    const spct = Math.max(0, Math.min(100, (shield / max) * 100));
    E.heroShield.style.width = `${spct}%`;
    const from = this.heroShown ?? hp;
    this.heroShown = hp;
    this.countTo(E.heroTxt, from, hp, (n) => `${Math.max(0, Math.round(n))} / ${max}${shield > 0 ? `  ·  +${shield}` : ''}`, 350);
    (E.statSh.querySelector('.v') as HTMLElement).textContent = String(shield);
    E.danger.classList.toggle('on', hp / max < 0.3 && hp > 0);
  }

  setStats(atk: number, def: number): void {
    (this.els.statAtk.querySelector('.v') as HTMLElement).textContent = String(atk);
    (this.els.statDef.querySelector('.v') as HTMLElement).textContent = String(def);
  }

  setDiscards(n: number, max: number): void {
    const pips = this.els.discards.querySelector('.pips') as HTMLElement;
    const total = Math.max(n, max);
    let html = '';
    for (let i = 0; i < total; i++) html += `<span class="pip ${i < n ? 'on' : ''}"></span>`;
    pips.innerHTML = html + `<span style="margin-left:.35rem;font-size:.85rem">${n}</span>`;
  }

  setGold(n: number): void {
    const v = this.els.gold.querySelector('.v') as HTMLElement;
    if (v.textContent !== String(n)) {
      v.textContent = String(n);
      retrigger(this.els.gold, 'bump');
    }
  }

  setDeck(draw: number, total: number): void {
    this.els.deck.innerHTML = `<div class="label">Deck</div>${draw} / ${total}`;
  }

  // ------------------------------------------------------------------ boss
  setBossHp(hp: number, max: number): void {
    const E = this.els;
    const from = this.bossHp.hp;
    this.bossHp = { hp, max };
    const pct = Math.max(0, Math.min(100, (hp / max) * 100));
    E.bossFill.style.width = `${pct}%`;
    E.bossLag.style.width = `${pct}%`;
    this.countTo(E.bossTxt, from, hp, (n) => `${formatNum(Math.max(0, Math.round(n)))} / ${formatNum(max)}`);
  }

  private counters = new WeakMap<HTMLElement, number>();
  /** roll a number display from -> to over a short time */
  private countTo(el: HTMLElement, from: number, to: number, fmt: (n: number) => string, dur = 450): void {
    const prev = this.counters.get(el);
    if (prev) cancelAnimationFrame(prev);
    if (!isFinite(from) || from === to || Math.abs(from - to) < 1) {
      el.textContent = fmt(to);
      return;
    }
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1) this.counters.set(el, requestAnimationFrame(step));
      else this.counters.delete(el);
    };
    step();
  }

  setBossStats(b: BattleState): void {
    const boss = b.boss;
    const chips: string[] = [];
    const defShown = boss.defense * (boss.guard ? 2 : 1);
    chips.push(`<span class="bchip def">${icon('def')}<span class="k">DEF</span>${defShown}</span>`);
    chips.push(`<span class="bchip atk">${icon('atk')}<span class="k">ATK</span>${boss.atk}</span>`);
    if (boss.guard) chips.push(`<span class="bchip status">${icon('intentGuard')}Guarded ×2 DEF</span>`);
    if (boss.petrified) chips.push(`<span class="bchip status">${icon('medusa')}Petrified</span>`);
    if (boss.atk > boss.baseAtk) chips.push(`<span class="bchip status bad">${icon('intentRoar')}+${boss.atk - boss.baseAtk} ATK</span>`);
    if (boss.def.twist.id === 'underworld') chips.push(`<span class="bchip status ${boss.revived ? 'bad' : ''}">${icon('skull')}${boss.revived ? 'Risen' : 'Will rise'}</span>`);
    this.els.bossStats.innerHTML = chips.join('');
  }

  setIntent(b: BattleState): void {
    const E = this.els;
    const i: Intent = b.boss.intent;
    const p = intentPreview(b);
    const calm = i.hits === 0;
    E.intent.className = `intent ${calm ? 'calm' : ''} ${i.kind === 'heavy' ? 'pulse' : ''}`;
    let val = '';
    if (b.boss.petrified) val = `<span style="font-size:1.1rem">Petrified</span>`;
    else if (i.hits > 1) val = `${p.perHit}<small>×${p.hits}</small>`;
    else if (i.hits === 1) val = `${p.perHit}`;
    else if (i.kind === 'guard') val = `<span style="font-size:1.1rem">DEF ×2</span>`;
    else if (i.kind === 'roar') val = `<span style="font-size:1.1rem">ATK ↑</span>`;
    E.intent.innerHTML = `<div class="i-ico">${icon(INTENT_ICON[i.kind] ?? 'intentStrike')}</div><div><div class="i-lbl">Next</div><div class="i-val">${val}</div><div class="i-name">${i.name}</div></div>`;
    retrigger(E.intent, 'bump');
    tooltip.attach(E.intent, () => {
      const pv = intentPreview(b);
      return `<div class="tt-sub">Foe intent</div><div class="tt-title">${b.boss.intent.name}</div><div class="tt-row">${INTENT_DESC[b.boss.intent.kind]}</div>${
        pv.hits ? `<div class="tt-row">After your DEF: <b class="c-bad">${pv.perHit}${pv.hits > 1 ? ` × ${pv.hits}` : ''}</b> damage${b.shield ? ` (Shield ${b.shield} absorbs first)` : ''}.</div>` : ''
      }`;
    });
  }

  // ------------------------------------------------------------------ boons / scrolls
  renderBoons(run: RunState): void {
    const row = this.els.boons;
    row.innerHTML = '';
    run.boons.forEach((inst, i) => {
      const d = BOON_BY_ID[inst.id];
      if (!d) return;
      const el = h('div', { class: 'mini-card', attrs: { 'data-uid': String(inst.uid) }, style: `--i:${i}` }, h('img', { attrs: { src: boonArt(inst.id), alt: d.name } }));
      tooltip.attach(el, () => boonTooltip(inst.id, inst.counter));
      row.appendChild(el);
    });
    for (let i = run.boons.length; i < MAX_BOONS; i++) row.appendChild(h('div', { class: 'empty-slot' }));
  }

  triggerBoon(uid: number): DOMRect | null {
    const el = this.els.boons.querySelector(`[data-uid="${uid}"]`) as HTMLElement | null;
    if (!el) return null;
    retrigger(el, 'trigger');
    return el.getBoundingClientRect();
  }

  renderScrolls(run: RunState, canUse: (slot: number) => { ok: boolean; reason?: string }): void {
    const row = this.els.scrolls;
    row.innerHTML = '';
    run.consumables.forEach((id, slot) => {
      const d = SCROLL_BY_ID[id];
      const sel = slot === this.selectedScroll;
      const el = h('div', { class: `mini-card ${sel ? 'sel' : ''}`, style: `--i:${slot + 3}` }, h('img', { attrs: { src: scrollArt(id), alt: d.name } }));
      el.addEventListener('click', () => this.cb.onScrollClick(slot));
      tooltip.attach(el, () => `<div class="tt-sub">Scroll</div><div class="tt-title">${d.name}</div><div class="tt-row">${d.desc}</div>${sel ? '' : '<div class="tt-row tt-dim">Click to select, then Use.</div>'}`);
      if (sel) {
        const v = canUse(slot);
        const btn = h('button', {
          class: `btn green small use-btn ${v.ok ? '' : 'disabled'}`,
          text: v.ok ? 'Use' : v.reason ?? 'Use',
          on: {
            click: (e: Event) => {
              e.stopPropagation();
              if (v.ok) this.cb.onScrollUse(slot);
            },
          },
        });
        el.appendChild(btn);
      }
      row.appendChild(el);
    });
    for (let i = run.consumables.length; i < MAX_CONSUMABLES; i++) row.appendChild(h('div', { class: 'empty-slot' }));
  }

  // ------------------------------------------------------------------ controls
  setControls(o: { canPlay: boolean; canDiscard: boolean; busy: boolean; hint?: string }): void {
    const E = this.els;
    E.play.classList.toggle('disabled', !o.canPlay || o.busy);
    E.discard.classList.toggle('disabled', !o.canDiscard || o.busy);
    E.hint.textContent = o.hint ?? '';
    E.hint.classList.toggle('show', !!o.hint && !o.busy);
  }

  setHint(text: string): void {
    this.els.hint.textContent = text;
    this.els.hint.classList.toggle('show', !!text);
  }

  // ------------------------------------------------------------------ geometry helpers
  rect(name: 'power' | 'mult' | 'total' | 'heroBar' | 'bossBar' | 'intent' | 'gold' | 'discards' | 'deck' | 'statSh' | 'handName'): DOMRect {
    const map: Record<string, string> = { bossBar: 'bossFill', heroBar: 'heroBar' };
    const el = this.els[map[name] ?? name];
    return (name === 'bossBar' ? (el.parentElement as HTMLElement) : el).getBoundingClientRect();
  }

  center(name: Parameters<BattleHud['rect']>[0]): { x: number; y: number } {
    const r = this.rect(name);
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  shakeEl(name: string): void {
    retrigger(this.els[name], 'shake-x');
  }

  get plateEl(): HTMLElement {
    return this.els.plate;
  }

  dispose(): void {
    tooltip.hide();
    this.root.remove();
  }
}
