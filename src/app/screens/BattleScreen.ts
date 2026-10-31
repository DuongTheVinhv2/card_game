import * as THREE from 'three';
import type { App } from '../App';
import type { Screen, PointerInfo } from '../Screen';
import type { BattleState, PlayResult, BossTurnResult } from '../../logic/battle';
import {
  createBattle, startTurn, playHand, bossTurn, canPlay, canDiscard, discardCards, previewHand,
  canUseScroll, useScroll, battleRewards, applyVictory, elementFactor, handSize,
} from '../../logic/battle';
import { LABOR_BY_ID } from '../../logic/labors';
import { ELEMENT_INFO } from '../../logic/elements';
import { cardName, cardPower, sortCards, ENH_INFO } from '../../logic/cards';
import { effectiveStats } from '../../logic/run';
import { HAND_INFO } from '../../logic/hands';
import type { Card } from '../../logic/types';
import { HAND_ORDER } from '../../logic/types';
import { BattleHud } from '../../ui/BattleHud';
import { CardView } from '../../gfx/cards/CardView';
import { CARD_W, CARD_H } from '../../gfx/cards/cardGeometry';
import { ConstellationCreature, type CreatureAttack } from '../../gfx/boss/ConstellationCreature';
import { ELEMENT_PALETTE } from '../../gfx/palette';
import { ELEMENT_FX } from '../../gfx/fx/FX';
import { anim, Ease, formatNum, formatMult } from '../../core/anim';
import { popup, screenFlash, centerFlash } from '../../ui/popups';
import { tooltip } from '../../ui/tooltip';
import { h } from '../../ui/dom';
import { audio } from '../../audio/audio';
import { openOptions, openDeckViewer, openHandsTable } from '../../ui/modals';
import { runCoach } from '../../ui/coach';
import { SpoilsScreen } from './SpoilsScreen';
import { EndScreen } from './EndScreen';
import { WEAPONS, weaponDef, type WeaponId } from '../../logic/weapons';
import { HERO_PALETTE } from '../../gfx/palette';

interface Layout {
  cardScale: number;
  handX: number;
  handY: number;
  handW: number;
  playX: number;
  playY: number;
  deck: THREE.Vector3;
  discard: THREE.Vector3;
  boss: THREE.Vector3;
  bossScale: number;
  heroWorld: THREE.Vector3;
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector2();

export class BattleScreen implements Screen {
  readonly music: string;
  private app: App;
  private laborIndex: number;
  private b!: BattleState;
  private hud!: BattleHud;
  private creature!: ConstellationCreature;
  private hero!: ConstellationCreature;
  private equipment: HTMLElement | null = null;
  private root = new THREE.Group();
  private views = new Map<number, CardView>();
  private order: number[] = [];
  private selected = new Set<number>();
  private busy = true;
  private hoverId: number | null = null;
  private drag: { id: number; x: number; y: number; active: boolean } | null = null;
  private raycaster = new THREE.Raycaster();
  private L!: Layout;
  private deckPile: CardView[] = [];
  private flying: CardView[] = [];
  private shownHeroHp = 0;
  private shownBossHp = 0;
  private dead = false;
  private overlay: HTMLElement | null = null;
  /** camera push-in while a hand is being tallied */
  private tension = 0;
  private scoring = false;
  private introCam = true;

  constructor(app: App, laborIndex: number) {
    this.app = app;
    this.laborIndex = laborIndex;
    const stage = app.run!.labors[laborIndex].stage;
    this.music = stage >= 2 ? 'boss' : 'battle';
  }

  // =============================================================================== lifecycle
  async enter(): Promise<void> {
    const app = this.app;
    const run = app.run!;
    this.b = createBattle(run, this.laborIndex);
    const inst = this.b.boss.inst;
    if (!app.settings.seen.includes(inst.id)) {
      app.settings.seen.push(inst.id);
      app.saveSettings();
    }
    app.stage.scene.add(this.root);

    this.hud = new BattleHud(app.ui, {
      onPlay: () => void this.playSelected(),
      onDiscard: () => void this.discardSelected(),
      onSort: (m) => this.sortHand(m),
      onScrollClick: (slot) => this.clickScroll(slot),
      onScrollUse: (slot) => void this.useScroll(slot),
      onOptions: () => openOptions(app, { inRun: true }),
      onDeck: () => openDeckViewer(app, this.b),
      onHands: () => openHandsTable(app.run!),
    });
    this.hud.setFoe(this.b);
    this.hud.renderBoons(run);
    this.refreshScrolls();
    this.hud.setHand(null);
    this.hud.setScore(0, 0);

    const pal = ELEMENT_PALETTE[inst.element];
    app.bg.setPalette(pal, 2.2);
    app.fx.setMoteColor(ELEMENT_INFO[inst.element].glow);
    this.creature = new ConstellationCreature(inst.id, pal, inst.element, { detail: 'full' });
    this.root.add(this.creature);
    this.hero = new ConstellationCreature('heracles', HERO_PALETTE, null);
    this.hero.setWeapon(weaponDef(run.weapon).id);
    this.root.add(this.hero);
    this.equipment = h('div', { class: 'equipment-picker' });
    const select = document.createElement('select'); select.setAttribute('aria-label', 'Hero weapon');
    for (const w of WEAPONS) { const option = document.createElement('option'); option.value = w.id; option.textContent = w.name; select.appendChild(option); }
    select.value = weaponDef(run.weapon).id;
    const detail = h('span', { text: weaponDef(run.weapon).desc });
    select.addEventListener('change', () => {
      if (this.busy || this.b.handsPlayed > 0 || this.b.over) { select.value = weaponDef(run.weapon).id; return; }
      run.weapon = select.value as WeaponId;
      this.b.stats = effectiveStats(run); this.hero.setWeapon(run.weapon);
      detail.textContent = weaponDef(run.weapon).desc; this.refreshHud(); this.refreshControls(); app.persist();
    });
    select.title = 'Choose before your first attack. Locks for the rest of this battle.';
    this.equipment.append(select, detail); app.ui.appendChild(this.equipment);

    this.computeLayout();
    this.buildDeckPile();
    this.shownHeroHp = run.hp;
    this.shownBossHp = this.b.boss.hp;
    this.refreshHud();
    this.hud.setControls({ canPlay: false, canDiscard: false, busy: true });
    void this.intro();
  }

  exit(): void {
    this.dead = true;
    for (const v of this.views.values()) v.dispose();
    for (const v of this.deckPile) v.dispose();
    for (const v of this.flying) v.dispose();
    this.views.clear();
    this.creature?.removeFromParent();
    this.creature?.dispose();
    this.hero?.dispose();
    this.equipment?.remove();
    this.root.removeFromParent();
    this.hud?.dispose();
    this.overlay?.remove();
    this.app.bg.setAstrolabe(0.5, 0.5, 0.4, 0);
    tooltip.hide();
  }

  onResize(): void {
    this.computeLayout();
  }

  // =============================================================================== layout
  private computeLayout(): void {
    const app = this.app;
    const w = app.w;
    const hgt = app.h;
    const sa = this.hud.stageArea.getBoundingClientRect();
    const rig = app.rig;
    const upp = rig.unitsPerPixel(0, hgt);
    const cx = sa.left + sa.width / 2;
    const cardHpx = Math.min(hgt * 0.17, (sa.width / 8.5) * 1.4);
    const cardScale = (cardHpx * upp) / CARD_H;
    const hand = rig.screenToWorld(cx, hgt * 0.825, w, hgt, 0);
    const play = rig.screenToWorld(cx, hgt * 0.615, w, hgt, 0);
    const deck = rig.screenToWorld(sa.right - cardHpx * 0.55, hgt * 0.83, w, hgt, 0);
    const discard = rig.screenToWorld(w + cardHpx, hgt * 0.75, w, hgt, 0);
    const bossZ = -7;
    const uppB = rig.unitsPerPixel(bossZ, hgt);
    const bossScale = Math.min((hgt * .37 * uppB) / 7.1, (sa.width * .48 * uppB) / 10.8);
    const heroScale = Math.min((hgt * .28 * uppB) / 7.5, (sa.width * .29 * uppB) / 11.5);
    const boss = rig.screenToWorld(sa.left + sa.width * .73, hgt * .625, w, hgt, bossZ);
    boss.y += 3.2 * bossScale;
    const heroWorld = rig.screenToWorld(sa.left + sa.width * .22, hgt * .625, w, hgt, bossZ);
    heroWorld.y += 3.2 * heroScale;
    this.L = {
      cardScale,
      handX: hand.x,
      handY: hand.y,
      handW: Math.min(sa.width * 0.52, cardHpx * 0.714 * 6.6) * upp,
      playX: play.x,
      playY: play.y,
      deck,
      discard,
      boss,
      bossScale,
      heroWorld,
    };
    this.creature.position.copy(boss);
    this.creature.scale.setScalar(bossScale);
    if (this.hero) { this.hero.position.copy(heroWorld); this.hero.scale.setScalar(heroScale); }
    // astrolabe behind the foe
    app.bg.setAstrolabe(cx / w, 1 - 0.265, 0.34, 1);
    for (const [i, v] of this.deckPile.entries()) {
      v.setTarget(deck.x + i * 0.012, deck.y + i * 0.03, -0.2 + i * 0.01, -0.06 + i * 0.03, cardScale * 0.82);
      v.snap();
    }
  }

  private buildDeckPile(): void {
    const dummy: Card = { id: -1, rank: 14, element: 'fire', enh: 'none' };
    for (let i = 0; i < 4; i++) {
      const v = new CardView(dummy);
      v.faceUp = false;
      v.visibleShadow = i === 0;
      this.root.add(v.group);
      this.deckPile.push(v);
    }
    this.computeLayout();
  }

  private handSlot(i: number, n: number): { x: number; y: number; rot: number; z: number } {
    const L = this.L;
    const cw = CARD_W * L.cardScale;
    const spacing = n > 1 ? Math.min(cw * 1.04, L.handW / (n - 1)) : 0;
    const t = n > 1 ? (i - (n - 1) / 2) / ((n - 1) / 2) : 0;
    return {
      x: L.handX + (i - (n - 1) / 2) * spacing,
      y: L.handY - t * t * cw * 0.18,
      rot: -t * 0.075,
      z: i * 0.04,
    };
  }

  // =============================================================================== frame
  update(dt: number, time: number): void {
    if (this.dead) return;
    this.updateHover();
    const L = this.L;
    const n = this.order.length;
    const cardH = CARD_H * L.cardScale;
    // drag reorder
    if (this.drag?.active) {
      const v = this.views.get(this.drag.id);
      if (v) {
        const p = this.app.rig.screenToWorld(this.app.pointer.x, this.app.pointer.y, this.app.w, this.app.h, 1.2, _v);
        v.setTarget(p.x, p.y, 1.2, 0, L.cardScale * 1.05);
        // find insertion index
        let idx = 0;
        for (let i = 0; i < n; i++) if (p.x > this.handSlot(i, n).x) idx = i;
        const cur = this.order.indexOf(this.drag.id);
        if (cur !== idx && cur >= 0) {
          this.order.splice(cur, 1);
          this.order.splice(idx, 0, this.drag.id);
          audio.play('hover', { pitch: 1.3, volume: 0.4 });
        }
      }
    }
    this.order.forEach((id, i) => {
      const v = this.views.get(id);
      if (!v) return;
      if (this.drag?.active && this.drag.id === id) return;
      const s = this.handSlot(i, n);
      let y = s.y;
      let z = s.z;
      let rot = s.rot;
      if (v.selected) y += cardH * 0.2;
      if (v.hovered && !this.busy) {
        y += cardH * 0.06;
        z += 0.6;
        rot *= 0.4;
      }
      v.setTarget(s.x, y, z, rot, L.cardScale);
    });
    // slow push-in while the score builds, released on impact
    const tt = this.scoring ? 1 : 0;
    this.tension += (tt - this.tension) * (1 - Math.exp(-dt * (this.scoring ? 0.9 : 6)));
    if (!this.introCam) {
      this.app.rig.offset.z = -1.4 * this.tension;
      this.app.rig.offset.y = -0.35 * this.tension;
    }
    for (const v of this.views.values()) v.update(dt, time);
    for (const v of this.deckPile) v.update(dt, time);
    for (const v of this.flying) v.update(dt, time);
    this.creature.update(dt, time);
    this.hero.update(dt, time);
    const weaponSelect = this.equipment?.querySelector('select');
    if (weaponSelect) weaponSelect.disabled = this.busy || this.b.handsPlayed > 0 || !!this.b.over;
    if (this.b.boss.hp > 0) this.creature.setLowHp(Math.max(0, 1 - this.b.boss.hp / this.b.boss.maxHp / 0.35));
  }

  private handViews(): CardView[] {
    return this.order.map((id) => this.views.get(id)!).filter(Boolean);
  }

  private updateHover(): void {
    const app = this.app;
    let hit: CardView | null = null;
    const overUi = app.pointer.target !== app.stage.renderer.domElement;
    if (!overUi && !this.drag?.active) {
      this.raycaster.setFromCamera(app.pointer.ndc, app.stage.camera);
      const meshes = this.handViews().map((v) => v.mesh);
      const hits = this.raycaster.intersectObjects(meshes, false);
      if (hits.length) {
        // pick the card that is visually on top (largest z)
        let best = hits[0];
        for (const hh of hits) {
          const vz = (hh.object.userData.view as CardView).pos.z;
          if (vz > (best.object.userData.view as CardView).pos.z + 0.01) best = hh;
        }
        hit = best.object.userData.view as CardView;
        hit.pointer.copy(this.localPointer(hit, best.point));
      }
    }
    const id = hit ? hit.card.id : null;
    if (id !== this.hoverId) {
      if (this.hoverId !== null) {
        const old = this.views.get(this.hoverId);
        if (old) old.hovered = false;
      }
      this.hoverId = id;
      if (hit) {
        hit.hovered = true;
        if (!this.busy) audio.play('hover', { pitch: 0.9 + Math.random() * 0.25, volume: 0.5 });
        tooltip.show(this.cardTooltip(hit.card), app.pointer.x, app.pointer.y, 'card');
      } else tooltip.hide('card');
    } else if (hit) tooltip.move(app.pointer.x, app.pointer.y);
    if (this.drag?.active) tooltip.hide('card');
  }

  private localPointer(v: CardView, world: THREE.Vector3): THREE.Vector2 {
    const local = v.inner.worldToLocal(world.clone());
    return _v2.set(THREE.MathUtils.clamp((local.x / CARD_W) * 2, -1, 1), THREE.MathUtils.clamp((local.y / CARD_H) * 2, -1, 1)).clone();
  }

  private cardTooltip(c: Card): string {
    const info = ELEMENT_INFO[c.element];
    const f = elementFactor(c.element, this.b.boss.inst);
    const vs =
      f > 1
        ? `<span class="c-good">Exploits the foe's weakness — ×2</span>`
        : f < 1
          ? `<span class="c-bad">Resisted by the foe — ×½</span>`
          : `<span class="tt-dim">Neutral against the foe</span>`;
    const enh = c.enh !== 'none' ? `<div class="tt-row"><b>${ENH_INFO[c.enh].name}:</b> ${ENH_INFO[c.enh].desc}</div>` : '';
    const hex = this.b.hexed.has(c.id) ? `<div class="tt-row c-bad">Hexed — scores nothing. Discard to cleanse.</div>` : '';
    return `<div class="tt-sub el-${c.element}">${info.name} · ${info.signature}</div><div class="tt-title">${cardName(c)}</div>` +
      `<div class="tt-row"><span class="c-power">${cardPower(c)} Power</span> · ${info.sigDesc}</div>${enh}${hex}<div class="tt-row">${vs}</div>`;
  }

  // =============================================================================== input
  onPointerDown(p: PointerInfo): void {
    if (this.busy || this.hoverId === null || p.button !== 0) return;
    this.drag = { id: this.hoverId, x: p.x, y: p.y, active: false };
  }

  onPointerMove(p: PointerInfo): void {
    if (this.drag && !this.drag.active && Math.hypot(p.x - this.drag.x, p.y - this.drag.y) > 9) {
      this.drag.active = true;
      const v = this.views.get(this.drag.id);
      if (v) v.stiff = true;
      audio.play('select', { pitch: 1.2, volume: 0.6 });
    }
  }

  onPointerUp(p: PointerInfo): void {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    const v = this.views.get(d.id);
    if (v) v.stiff = false;
    if (!d.active && p.button === 0) this.toggleSelect(d.id);
  }

  onKey(e: KeyboardEvent): void {
    if (document.querySelector('.modal-back')) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      void this.playSelected();
    } else if (e.key === 'x' || e.key === 'X' || e.key === 'Delete') void this.discardSelected();
    else if (e.key === 'r' || e.key === 'R') this.sortHand('rank');
    else if (e.key === 'e' || e.key === 'E') this.sortHand('element');
    else if (e.key === 'Escape') openOptions(this.app, { inRun: true });
    else if (/^[1-9]$/.test(e.key)) {
      const id = this.order[Number(e.key) - 1];
      if (id !== undefined) this.toggleSelect(id);
    }
  }

  private toggleSelect(id: number): void {
    if (this.busy) return;
    const v = this.views.get(id);
    if (!v) return;
    if (this.selected.has(id)) {
      this.selected.delete(id);
      v.selected = false;
      audio.play('deselect');
    } else {
      if (this.selected.size >= 5) {
        v.jiggle(1);
        audio.play('error', { volume: 0.5 });
        this.hud.setHint('You can select up to 5 cards');
        return;
      }
      this.selected.add(id);
      v.selected = true;
      v.jiggle(0.4);
      audio.play('select', { pitch: 0.95 + this.selected.size * 0.05 });
    }
    this.refreshPreview();
    if (this.hud.selectedScroll >= 0) this.refreshScrolls();
  }

  private selectedIds(): number[] {
    return this.order.filter((id) => this.selected.has(id));
  }

  private refreshPreview(): void {
    const ids = this.selectedIds();
    const pv = ids.length ? previewHand(this.b, ids) : null;
    if (pv) {
      this.hud.setHand(pv.type, pv.level, { preview: true });
      this.hud.setScore(pv.power, pv.mult);
    } else {
      this.hud.setHand(null);
      this.hud.setScore(0, 0);
    }
    this.refreshControls();
  }

  private refreshControls(): void {
    const ids = this.selectedIds();
    const cp = canPlay(this.b, ids);
    const cd = canDiscard(this.b, ids);
    let hint = '';
    if (!this.busy) {
      if (ids.length && !cp.ok && cp.reason) hint = cp.reason;
      else if (!ids.length) hint = this.b.boss.def.twist.id === 'chase' ? 'Endless Chase · select exactly 5 cards' : 'Select up to 5 cards — click, or drag to reorder';
    }
    this.hud.setControls({ canPlay: cp.ok, canDiscard: cd.ok, busy: this.busy, hint });
  }

  private sortHand(mode: 'rank' | 'element'): void {
    const cards = this.order.map((id) => this.views.get(id)!.card);
    this.order = sortCards(cards, mode).map((c) => c.id);
    audio.play('shuffle', { volume: 0.35, pitch: 1.4 });
    for (const v of this.handViews()) v.jiggle(0.3);
  }

  // =============================================================================== hud sync
  private refreshHud(): void {
    const b = this.b;
    const st = b.stats;
    this.hud.setHero(this.shownHeroHp, st.maxHp, b.shield);
    this.hud.setStats(st.atk, st.def);
    this.hud.setDiscards(b.discards, st.maxDiscards);
    this.hud.setGold(b.run.gold);
    this.hud.setDeck(b.draw.length, b.run.deck.length);
    this.hud.setBossHp(this.shownBossHp, b.boss.maxHp);
    this.hud.setBossStats(b);
    this.hud.setIntent(b);
    this.refreshControls();
  }

  private refreshScrolls(): void {
    this.hud.renderScrolls(this.app.run!, (slot) => canUseScroll(this.b, slot, this.selectedIds()));
  }

  // =============================================================================== helpers
  private screenOf(world: THREE.Vector3): { x: number; y: number } {
    const p = this.app.rig.worldToScreen(world, this.app.w, this.app.h, _v2);
    return { x: p.x, y: p.y };
  }

  private cardTopScreen(v: CardView): { x: number; y: number } {
    const top = v.group.position.clone();
    top.y += v.height * 0.62;
    return this.screenOf(top);
  }

  private bossScreen(): { x: number; y: number } {
    return this.screenOf(this.creature.getAnchorWorld('core', _v));
  }

  /** anchor for popups about Heracles: just right of his HP bar, over the open stage */
  private heroScreen(): { x: number; y: number } {
    return this.screenOf(this.hero.getAnchorWorld('core', new THREE.Vector3()));
  }

  private wait(s: number): Promise<void> {
    return anim.wait(s);
  }

  // =============================================================================== intro
  private async intro(): Promise<void> {
    const app = this.app;
    const def = this.b.boss.def;
    const inst = this.b.boss.inst;
    this.hud.root.style.opacity = '0';
    const title = h('div', { class: 'labor-title' },
      h('div', { class: 'lt-num', text: `LABOR ${def.numeral}` }),
      h('div', { class: 'lt-name title-gold', text: def.name }),
      h('div', { class: 'lt-flavor', text: def.flavor }),
      h('div', { class: 'lt-num', style: 'margin-top:1rem;font-size:.8rem;letter-spacing:.35em', html: `<span class="el-${inst.element}">${ELEMENT_INFO[inst.element].name.toUpperCase()}</span> · STAGE ${inst.stage + 1}` }),
    );
    this.overlay = title;
    app.ui.appendChild(title);
    title.animate([{ opacity: 0, transform: 'translate(-50%,-40%) scale(1.08)' }, { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }], { duration: 900, easing: 'cubic-bezier(.2,.9,.25,1)', fill: 'both' });
    audio.play('bossIntro');
    app.rig.offset.set(0, -1.5, 4);
    void anim.tween(3.2, (k) => app.rig.offset.set(0, -1.5 * (1 - k), 4 * (1 - k)), Ease.inOutSine);
    await this.creature.playIntro(2.2);
    audio.play('bossRoar', { volume: 0.8 });
    this.creature.playAttack('roar').catch(() => undefined);
    app.shake(0.35);
    await this.wait(0.6);
    title.animate([{ opacity: 1 }, { opacity: 0, transform: 'translate(-50%,-60%) scale(.96)' }], { duration: 600, easing: 'ease-in', fill: 'both' });
    this.hud.root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, fill: 'both' });
    this.hud.root.style.opacity = '';
    await this.wait(0.4);
    title.remove();
    this.overlay = null;
    this.introCam = false;
    if (this.dead) return;
    await this.beginTurn();
  }

  // =============================================================================== turn flow
  private async beginTurn(): Promise<void> {
    if (this.dead) return;
    const b = this.b;
    const ts = startTurn(b);
    const hero = this.heroScreen();
    if (ts.turn > 1) this.banner(`Turn ${ts.turn}`, 'rgba(232,194,122,.9)', true);
    if (ts.reshuffled) {
      popup(this.screenOf(this.L.deck).x, this.screenOf(this.L.deck).y - 60, 'Reshuffled', 'note');
      audio.play('shuffle');
    }
    if (ts.shieldGained) {
      popup(hero.x, hero.y - 30, `+${ts.shieldGained} Shield`, 'shield');
      audio.play('shieldGain');
    }
    if (ts.healed) {
      this.shownHeroHp = b.run.hp;
      popup(hero.x, hero.y - 50, `+${ts.healed}`, 'heal');
      audio.play('heal');
    }
    this.refreshHud();
    await this.dealCards(ts.drawn);
    for (const c of ts.hexed) {
      const v = this.views.get(c.id);
      if (v) {
        v.hexed = true;
        v.jiggle(1);
        const s = this.cardTopScreen(v);
        popup(s.x, s.y, 'Hexed', 'bad');
      }
    }
    if (ts.hexed.length) audio.play('resist');
    this.busy = false;
    this.refreshHud();
    this.refreshPreview();
    // telegraph a coming crushing blow with a smouldering charge
    this.creature.setCharge(b.boss.intent.kind === 'heavy' && !b.boss.petrified ? 0.3 : 0);
    if (ts.turn === 1 && !this.app.settings.coachSeen) void this.coach();
    audio.setIntensity(Math.min(1, 0.3 + (1 - b.boss.hp / b.boss.maxHp) * 0.7));
  }

  private async coach(): Promise<void> {
    const app = this.app;
    app.settings.coachSeen = true;
    app.saveSettings();
    const handRect = () => {
      const vs = this.handViews();
      if (!vs.length) return new DOMRect(app.w / 2 - 200, app.h * 0.72, 400, 160);
      const a = this.screenOf(vs[0].group.position);
      const z = this.screenOf(vs[vs.length - 1].group.position);
      const hh = (vs[0].height / (app.rig.unitsPerPixel(0, app.h) || 1)) * 0.55;
      return new DOMRect(a.x - hh * 0.6, a.y - hh, z.x - a.x + hh * 1.2, hh * 2);
    };
    const q = (sel: string) => () => (this.hud.root.querySelector(sel) as HTMLElement).getBoundingClientRect();
    await runCoach([
      { title: 'Your hand', side: 'top', target: handRect, text: 'Each suit is an <b>element</b>. Select up to <b>5 cards</b> to form a poker hand — the panel on the left previews its <span class="c-power">Power</span> × <span class="c-mult">Mult</span>. Higher cards carry more Power (2 → A = 2 → 14).' },
      { title: 'Know your foe', side: 'right', target: q('.foe-panel'), text: 'Cards of the foe’s <b class="c-good">weakness</b> hit twice as hard and double their element effect. <b class="c-bad">Resisted</b> elements are halved. Mind its unique <b>twist</b>.' },
      { title: 'Its next move', side: 'left', target: q('.intent'), text: 'After every hand you play, the foe acts. Its intent is shown here. <span class="el-earth">Earth</span> cards grant Shield, <span class="el-water">Water</span> heals, <span class="el-wind">Wind</span> pierces DEF, <span class="el-fire">Fire</span> adds Mult.' },
      { title: 'Play or discard', side: 'top', target: q('.controls'), text: '<b>Play Hand</b> to strike. <b>Discard</b> swaps up to 5 cards without ending your turn — you regain one discard every turn.' },
    ]);
  }

  private banner(text: string, color: string, small = false): void {
    const el = h('div', { class: `turn-banner title-gold ${small ? 'small' : ''}`, text });
    el.style.filter = `drop-shadow(0 0 1rem ${color})`;
    this.hud.stageArea.appendChild(el);
    el.animate(
      [
        { opacity: 0, transform: 'translate(-50%,-50%) scale(1.4)', letterSpacing: '0.6em' },
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', letterSpacing: '0.25em', offset: 0.25 },
        { opacity: 1, offset: 0.7 },
        { opacity: 0, transform: 'translate(-50%,-50%) scale(.95)' },
      ],
      { duration: 1100 / anim.speed, easing: 'ease-out', fill: 'both' },
    ).onfinish = () => el.remove();
  }

  private async dealCards(cards: Card[]): Promise<void> {
    const L = this.L;
    for (const c of cards) {
      if (this.dead) return;
      const v = new CardView(c);
      v.faceUp = false;
      v.setTarget(L.deck.x, L.deck.y, 0.3, -0.06, L.cardScale * 0.82);
      v.snap();
      v.hexed = this.b.hexed.has(c.id);
      this.root.add(v.group);
      this.views.set(c.id, v);
      this.order.push(c.id);
      v.faceUp = true;
      audio.play('deal', { pitch: 0.9 + Math.random() * 0.2 });
      await this.wait(0.075);
    }
    this.hud.setDeck(this.b.draw.length, this.b.run.deck.length);
    await this.wait(0.2);
  }

  private flyAway(views: CardView[], shattered: Set<number> = new Set()): void {
    const L = this.L;
    views.forEach((v, i) => {
      this.views.delete(v.card.id);
      if (!this.flying.includes(v)) this.flying.push(v);
      v.selected = false;
      v.hovered = false;
      if (shattered.has(v.card.id)) {
        audio.play('shatter');
        this.app.fx.sparkle(v.group.position, '#bfefff', 40, 2);
        void anim.tween(0.6, (k) => (v.dissolve = k), Ease.inQuad).then(() => this.dropFlying(v));
        return;
      }
      void anim.wait(i * 0.05).then(() => {
        v.omega = 9;
        v.setTarget(L.discard.x, L.discard.y + i * 0.2, 0.5, -0.8 - Math.random() * 0.5, L.cardScale * 0.9);
        void anim.wait(0.7).then(() => this.dropFlying(v));
      });
    });
  }

  private dropFlying(v: CardView): void {
    const i = this.flying.indexOf(v);
    if (i >= 0) this.flying.splice(i, 1);
    v.dispose();
  }

  // =============================================================================== discard
  private async discardSelected(): Promise<void> {
    if (this.busy) return;
    const ids = this.selectedIds();
    const ok = canDiscard(this.b, ids);
    if (!ok.ok) {
      if (ok.reason) this.hud.setHint(ok.reason);
      audio.play('error', { volume: 0.5 });
      return;
    }
    this.busy = true;
    this.refreshControls();
    tooltip.hide();
    const views = ids.map((id) => this.views.get(id)!);
    this.selected.clear();
    this.order = this.order.filter((id) => !ids.includes(id));
    const r = discardCards(this.b, ids);
    audio.play('discard');
    this.flyAway(views);
    this.hud.setDiscards(this.b.discards, this.b.stats.maxDiscards);
    this.hud.setHand(null);
    this.hud.setScore(0, 0);
    if (r.reshuffled) audio.play('shuffle');
    await this.wait(0.25);
    await this.dealCards(r.drawn);
    this.busy = false;
    this.refreshHud();
    this.refreshPreview();
    if (this.app.run!.boons.some((x) => x.id === 'persephone')) this.hud.renderBoons(this.app.run!);
  }

  // =============================================================================== scrolls
  private clickScroll(slot: number): void {
    this.hud.selectedScroll = this.hud.selectedScroll === slot ? -1 : slot;
    audio.play('buttonSoft');
    this.refreshScrolls();
  }

  private async useScroll(slot: number): Promise<void> {
    if (this.busy) return;
    const ids = this.selectedIds();
    if (!canUseScroll(this.b, slot, ids).ok) return;
    this.busy = true;
    const r = useScroll(this.b, slot, ids);
    this.hud.selectedScroll = -1;
    audio.play('scrollUse');
    for (const c of r.changed) {
      const v = this.views.get(c.id);
      if (!v) continue;
      v.faceUp = false;
      await this.wait(0.16);
      v.refresh();
      v.faceUp = true;
      v.pulse(1);
      this.app.fx.sparkle(v.group.position, ELEMENT_INFO[c.element].glow, 24, 1.6);
      audio.play('enhance', { pitch: 0.9 + Math.random() * 0.2 });
      await this.wait(0.12);
    }
    if (r.destroyed.length) {
      this.order = this.order.filter((id) => !r.destroyed.some((c) => c.id === id));
      this.flyAway(r.destroyed.map((c) => this.views.get(c.id)!).filter(Boolean), new Set(r.destroyed.map((c) => c.id)));
      await this.wait(0.5);
      await this.dealCards(r.drawn);
    }
    if (r.healed) {
      this.shownHeroHp = this.b.run.hp;
      const hs = this.heroScreen();
      popup(hs.x, hs.y - 30, `+${r.healed}`, 'heal');
      audio.play('heal');
    }
    if (r.discardsGained) {
      const ds = this.hud.center('discards');
      popup(ds.x, ds.y - 20, `+${r.discardsGained} Discards`, 'note');
    }
    for (const v of this.handViews()) v.selected = false;
    this.selected.clear();
    this.busy = false;
    this.refreshScrolls();
    this.refreshHud();
    this.refreshPreview();
  }

  // =============================================================================== PLAY
  private async playSelected(): Promise<void> {
    if (this.busy) return;
    const ids = this.selectedIds();
    const ok = canPlay(this.b, ids);
    if (!ok.ok) {
      if (ok.reason) this.hud.setHint(ok.reason);
      audio.play('error', { volume: 0.5 });
      for (const id of ids) this.views.get(id)?.jiggle(0.6);
      return;
    }
    this.busy = true;
    this.hud.selectedScroll = -1;
    this.refreshScrolls();
    this.refreshControls();
    tooltip.hide();
    const res = playHand(this.b, ids);
    void this.hero.playAttack(weaponDef(this.b.run.weapon).id === 'bow' ? 'volley' : 'strike');
    this.selected.clear();
    const views = ids.map((id) => this.views.get(id)!);
    this.order = this.order.filter((id) => !ids.includes(id));
    for (const v of views) {
      this.views.delete(v.card.id);
      this.flying.push(v);
      v.selected = false;
      v.hovered = false;
    }
    audio.play('playHand');
    await this.resolvePlay(res, views);
  }

  private async resolvePlay(res: PlayResult, views: CardView[]): Promise<void> {
    const app = this.app;
    const L = this.L;
    this.scoring = true;
    const scoringIds = new Set(res.scoring.map((c) => c.id));
    const cw = CARD_W * L.cardScale;
    const n = views.length;
    views.forEach((v, i) => {
      const x = L.playX + (i - (n - 1) / 2) * cw * 1.12;
      const sc = scoringIds.has(v.card.id);
      v.omega = 13;
      v.setTarget(x, L.playY + (sc ? 0 : -cw * 0.25), 1 + i * 0.02, 0, L.cardScale * (sc ? 1.02 : 0.92));
      if (!sc) v.dim = 0.55;
    });
    await this.wait(0.4);

    const rankIdx = HAND_ORDER.indexOf(res.handType);
    if (rankIdx >= HAND_ORDER.indexOf('flush')) await this.handSplash(res);
    const first = res.steps[0];
    this.hud.setHand(res.handType, res.level);
    this.hud.setScore(first.power, first.mult, 'both');
    audio.play('chip', { pitch: 0.8 });
    await this.wait(0.35);

    const byId = new Map(views.map((v) => [v.card.id, v] as const));
    let tick = 0;
    const stepWait = () => Math.max(0.16, 0.4 - tick * 0.018);
    for (const step of res.steps.slice(1)) {
      if (this.dead) return;
      switch (step.kind) {
        case 'atk': {
          const r = this.hud.rect('power');
          popup(r.left + r.width / 2, r.top - 10, `+${step.dPower} ATK`, 'power');
          this.hud.setScore(step.power, step.mult, 'power');
          audio.scoreTick(tick++);
          await this.wait(0.3);
          break;
        }
        case 'card': {
          const v = byId.get(step.cardId!)!;
          const s = this.cardTopScreen(v);
          if (step.hexed) {
            v.jiggle(1);
            popup(s.x, s.y, 'Hexed', 'bad');
            audio.play('resist');
            await this.wait(0.3);
            break;
          }
          v.pulse(1);
          const el = step.element!;
          app.fx.sparkle(v.group.position.clone().setY(v.group.position.y + v.height * 0.45), ELEMENT_INFO[el].glow, 10);
          popup(s.x, s.y + 26, `+${step.dPower}`, 'power', { rot: (Math.random() - 0.5) * 10, rise: '1.4rem' });
          // secondary effects stack down the card face so they never collide with the foe's nameplate
          const mid = this.screenOf(v.group.position);
          let dy = -6;
          const sub = (text: string, cls: string, color?: string) => {
            popup(mid.x, mid.y + dy, text, `${cls} chip`, { delay: 0.06, color, rise: '1rem', scale: 0.85 });
            dy += 32;
          };
          if (step.factor && step.factor > 1) {
            sub('WEAK ×2', 'weak', ELEMENT_INFO[el].color);
            audio.play('weak', { volume: 0.7 });
          } else if (step.factor && step.factor < 1) {
            sub('RESIST ×½', 'resist');
            audio.play('resist', { volume: 0.6 });
          }
          if (step.dMult) sub(`+${formatMult(step.dMult)} Mult`, 'mult');
          if (step.heal) sub(`+${step.heal} Heal`, 'heal');
          if (step.shield) sub(`+${step.shield} Shield`, 'shield');
          if (step.pierce) sub(`Pierce ${Math.round(step.pierce * 100)}%`, 'pierce');
          if (step.retrigger) sub('Again!', 'note');
          this.hud.setScore(step.power, step.mult, step.dMult ? 'both' : 'power');
          this.hud.setHot(step.power * step.mult >= this.b.boss.hp * 0.5);
          audio.scoreTick(tick++);
          if (step.dMult) audio.multTick(tick);
          await this.wait(stepWait());
          break;
        }
        case 'enh':
        case 'held': {
          const v = byId.get(step.cardId!) ?? this.views.get(step.cardId!);
          if (!v && step.text) {
            const hero = this.heroScreen();
            const bonus = step.dPower ? `+${step.dPower} Power` : step.dMult ? `+${step.dMult} Mult` : step.heal ? `+${step.heal} Heal` : step.shield ? `+${step.shield} Shield` : '';
            popup(hero.x, hero.y - 65, `${step.text} · ${bonus}`, 'note');
            audio.play('boonTrigger', { volume: .5 });
          }
          if (v) {
            v.pulse(0.8);
            const s = this.cardTopScreen(v);
            if (step.xMult) popup(s.x, s.y - 10, `×${formatMult(step.xMult)}`, 'xmult');
            else if (step.dMult) popup(s.x, s.y - 10, `+${formatMult(step.dMult)} Mult`, 'mult');
            else if (step.gold) {
              popup(s.x, s.y - 10, `+${step.gold}`, 'gold');
              app.fx.coinBurst(v.group.position, 12);
              audio.play('coin');
            }
          }
          this.hud.setScore(step.power, step.mult, step.xMult || step.dMult ? 'mult' : null);
          if (step.xMult) audio.play('xmult');
          else if (step.dMult) audio.multTick(tick++);
          await this.wait(Math.max(0.2, stepWait()));
          break;
        }
        case 'boon': {
          const rect = this.hud.triggerBoon(step.boonUid!);
          const x = rect ? rect.left + rect.width / 2 : app.w / 2;
          const y = rect ? rect.bottom + 22 : 120;
          let text = step.text ?? '';
          let cls = 'note';
          if (step.xMult) {
            text = `×${formatMult(step.xMult)} Mult`;
            cls = 'xmult';
          } else if (step.dMult) {
            text = `+${formatMult(step.dMult)} Mult`;
            cls = 'mult';
          } else if (step.dPower) {
            text = `+${step.dPower}`;
            cls = 'power';
          } else if (step.heal) {
            text = `+${step.heal} Heal`;
            cls = 'heal';
          } else if (step.shield) {
            text = `+${step.shield} Shield`;
            cls = 'shield';
          } else if (step.pierce) {
            text = `Pierce +${Math.round(step.pierce * 100)}%`;
            cls = 'pierce';
          } else if (step.gold) {
            text = `+${step.gold}`;
            cls = 'gold';
          }
          if (text) popup(x, y, text, cls, { rise: '1.2rem' });
          if (step.cardId !== undefined) byId.get(step.cardId)?.pulse(0.6);
          this.hud.setScore(step.power, step.mult, step.xMult || step.dMult ? 'mult' : step.dPower ? 'power' : null);
          audio.play(step.xMult ? 'xmult' : 'boonTrigger');
          await this.wait(Math.max(0.24, stepWait()));
          break;
        }
        default:
          break;
      }
    }

    // ---- total
    const big = res.total >= this.b.boss.maxHp * 0.25 || res.overkill;
    this.hud.setHot(big);
    this.hud.setTotal(formatNum(res.total), big);
    audio.play(big ? 'bigTotal' : 'total');
    if (big) {
      app.shake(0.25);
      app.rig.punch(0.6);
    }
    await this.wait(0.5);
    const defBits: string[] = [];
    if (res.effDef > 0) defBits.push(`− ${res.effDef} DEF`);
    if (res.pierce > 0) defBits.push(`${Math.round(res.pierce * 100)}% pierced`);
    if (res.guard) defBits.push('guarded');
    if (defBits.length || res.notes.length) {
      this.hud.setTotal(`${formatNum(res.total)}<span class="def-note">${[...defBits, ...res.notes].join(' · ')}</span>`, big);
      if (res.pierce > 0) audio.play('pierce', { volume: 0.7 });
      await this.wait(0.45);
    }

    // ---- strike!
    const target = this.creature.getAnchorWorld('core', new THREE.Vector3());
    const scoringViews = res.scoring.map((c) => byId.get(c.id)!).filter(Boolean);
    const unique = [...new Set(scoringViews)];
    let impacted = false;
    const strength = Math.min(3, 0.6 + (res.damage / this.b.boss.maxHp) * 4);
    const onFirstImpact = () => {
      if (impacted) return;
      impacted = true;
      this.scoring = false;
      this.creature.playHurt(Math.min(1, strength / 2));
      const bs = this.bossScreen();
      const huge = res.damage >= this.b.boss.maxHp * 0.3;
      popup(bs.x, bs.y, formatNum(res.damage), `dmg ${huge ? 'huge' : ''}`, { rot: (Math.random() - 0.5) * 8 });
      for (const [i, note] of res.notes.entries()) popup(bs.x, bs.y + 70 + i * 30, note, 'note', { delay: 0.2 });
      this.shownBossHp = res.bossHpAfter;
      this.hud.setBossHp(this.shownBossHp, this.b.boss.maxHp);
      this.hud.shakeEl('plate');
      anim.hitStop(0.05 + Math.min(0.12, strength * 0.04));
      app.shake(0.22 + strength * 0.18);
      app.rig.punch(0.4 + strength * 0.25);
      app.bg.flash(ELEMENT_INFO[res.scoring[0].element].glow, 0.06 + strength * 0.03);
      if (huge) centerFlash('rgba(255,240,220,0.35)', 0.3);
      audio.play(strength > 1.6 ? 'hitHeavy' : 'critical', { volume: 0.8 });
    };
    const flights = unique.map((v, i) =>
      anim.wait(i * 0.08).then(async () => {
        audio.play('whoosh', { pitch: 0.9 + i * 0.06, volume: 0.6 });
        v.flash = 0.6;
        const from = v.group.position.clone();
        from.z += 0.4;
        await app.fx.projectile(from, target, v.card.element, 0.36, 0.8 + strength * 0.25);
        const el = v.card.element;
        app.fx.elementHit(el, target.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2, 0.5)), 0.7 + strength * 0.35);
        audio.play(({ fire: 'hitFire', water: 'hitWater', wind: 'hitWind', earth: 'hitEarth' } as const)[el], { pitch: 0.95 + Math.random() * 0.1, volume: 0.8 });
        onFirstImpact();
      }),
    );
    if (!unique.length) onFirstImpact();
    await Promise.all(flights);
    this.hud.setHot(false);
    this.hud.setBossStats(this.b);

    // ---- self effects
    const hero = this.heroScreen();
    if (res.healed > 0) {
      this.shownHeroHp = this.b.run.hp;
      popup(hero.x, hero.y - 30, `+${res.healed} HP`, 'heal');
      app.fx.healBurst(this.L.heroWorld);
      audio.play('heal');
    }
    if (res.shield > 0) {
      popup(hero.x + 60, hero.y - 50, `+${res.shield} Shield`, 'shield', { delay: 0.1 });
      app.fx.shieldBurst(this.L.heroWorld);
      audio.play('shieldGain');
    }
    if (res.gold > 0) {
      const g = this.hud.center('gold');
      popup(g.x, g.y - 20, `+${res.gold}`, 'gold');
      audio.play('coin');
    }
    if (res.selfDamage > 0) {
      this.shownHeroHp = this.b.run.hp;
      popup(hero.x, hero.y, `-${res.selfDamage}`, 'hurt');
      audio.play('playerHurt', { volume: 0.6 });
    }
    if (res.petrify) {
      const bs = this.bossScreen();
      popup(bs.x, bs.y - 90, 'PETRIFIED', 'banner');
    }
    this.refreshHud();

    this.flyAway(views, new Set(res.shattered.map((c) => c.id)));
    await this.wait(0.45);
    this.hud.setTotal(null);
    this.hud.setHand(null);
    this.hud.setScore(0, 0);

    if (res.revived) await this.revive();
    if (res.bossDied) return this.victory();
    await this.bossPhase();
  }

  private async handSplash(res: PlayResult): Promise<void> {
    const app = this.app;
    const royal = res.handType === 'royal' || res.handType === 'straightflush';
    const el = res.scoring[0]?.element ?? 'fire';
    const color = royal ? '#ffd27a' : ELEMENT_INFO[el].glow;
    const splash = h('div', { class: `hand-splash ${royal ? 'royal' : ''}`, text: HAND_INFO[res.handType].name });
    splash.style.setProperty('--glow', color);
    this.hud.stageArea.appendChild(splash);
    splash.animate(
      [
        { opacity: 0, transform: 'translate(-50%,-50%) scale(2.2)' },
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.18 },
        { opacity: 1, transform: 'translate(-50%,-50%) scale(1.04)', offset: 0.75 },
        { opacity: 0, transform: 'translate(-50%,-50%) scale(1.15)' },
      ],
      { duration: 1300 / anim.speed, easing: 'cubic-bezier(.2,.9,.25,1)', fill: 'both' },
    ).onfinish = () => splash.remove();
    const center = new THREE.Vector3(this.L.playX, this.L.playY + 0.6, 1.5);
    app.fx.sparkle(center, color, royal ? 90 : 45, royal ? 4 : 2.5);
    app.fx.ring(center, color, royal ? 14 : 9, 0.8, 0.04, 2.6);
    if (royal) {
      centerFlash('rgba(255, 220, 140, 0.45)', 0.5);
      app.fx.coinBurst(center, 60);
    }
    app.rig.punch(royal ? 1.2 : 0.7);
    app.shake(royal ? 0.4 : 0.2);
    audio.play(royal ? 'apotheosis' : 'levelUp', { volume: royal ? 0.7 : 0.8 });
    await this.wait(royal ? 1.0 : 0.55);
  }

  /** visual of a foe's blow landing on Heracles' side of the screen */
  private async attackFx(kind: CreatureAttack, i: number): Promise<void> {
    const app = this.app;
    const el = this.b.boss.inst.element;
    const f = ELEMENT_FX[el];
    const hit = app.rig.screenToWorld(app.w * (0.4 + (Math.random() - 0.5) * 0.12), app.h * (0.6 + (Math.random() - 0.5) * 0.1), app.w, app.h, 7);
    if (kind === 'volley' || kind === 'drain') {
      const core = this.creature.getAnchorWorld('core', new THREE.Vector3());
      if (kind === 'drain') {
        app.fx.add.emit({ pos: hit, count: 60, spread: 1.2, speed: [1, 3], life: [0.5, 0.9], size: [0.1, 0.25], color: ['#ff4060', f.colors[0]], intensity: 2.4, drag: 1 });
        void app.fx.projectile(hit, core, el, 0.45, 0.7);
      } else {
        await app.fx.projectile(core, hit, el, 0.22, 0.7);
      }
    }
    if (kind === 'heavy') {
      app.fx.heavyImpact(hit, f.ring, 1.2);
      app.fx.ring(hit, '#ff3048', 10, 0.6, 0.05, 2.5, 0.5);
    }
    const n = kind === 'heavy' ? 3 : kind === 'strike' ? 3 : 1;
    for (let k = 0; k < n; k++) {
      const p = hit.clone().add(new THREE.Vector3((k - (n - 1) / 2) * 0.7, (k - (n - 1) / 2) * -0.3, 0));
      app.fx.slash(p, -0.9 + (Math.random() - 0.5) * 0.3 + (i % 2) * 0.5, k % 2 ? '#ff4060' : f.ring, kind === 'heavy' ? 7 : 4.5, 0.26);
    }
    app.fx.add.emit({ pos: hit, count: kind === 'heavy' ? 90 : 40, spread: 0.6, speed: [4, 12], life: [0.3, 0.7], size: [0.08, 0.2], color: ['#ffffff', '#ff6070', f.colors[0]], intensity: 2.6, drag: 3, shape: 1 });
  }

  private async revive(): Promise<void> {
    const app = this.app;
    const core = this.creature.getAnchorWorld('core', new THREE.Vector3());
    const fxc = ELEMENT_FX[this.b.boss.inst.element];
    // the hound falls apart into stardust...
    audio.play('bossDeath', { volume: 0.7 });
    app.shake(0.6);
    app.fx.stardust(core, [...fxc.colors, '#ffffff'], 380, 2.4);
    await this.creature.playDeath();
    await this.wait(0.3);
    // ...and the gates of Hades give it back
    const bs = this.bossScreen();
    popup(bs.x, bs.y - 40, 'GUARDIAN OF THE DEAD', 'banner');
    popup(bs.x, bs.y + 14, 'Cerberus rises again!', 'note', { delay: 0.3 });
    app.bg.flash('#ff3a2a', 0.45);
    audio.play('bossIntro');
    const reform = this.creature.playIntro(1.8);
    await anim.tween(1.4, (k) => {
      this.shownBossHp = this.b.boss.hp * k;
      this.hud.setBossHp(this.shownBossHp, this.b.boss.maxHp);
    });
    await reform;
    audio.play('bossRoar');
    app.shake(0.45);
    void this.creature.playAttack('roar').catch(() => undefined);
    this.shownBossHp = this.b.boss.hp;
    this.hud.setBossStats(this.b);
    await this.wait(0.5);
  }

  // =============================================================================== BOSS TURN
  private async bossPhase(): Promise<void> {
    if (this.dead) return;
    const app = this.app;
    const b = this.b;
    await this.wait(0.35);
    const intent = b.boss.intent;
    const petrified = b.boss.petrified;
    const attacking = intent.hits > 0 && !petrified;
    if (attacking && intent.kind === 'heavy') {
      audio.play('bossCharge');
      await anim.tween(0.75, (k) => this.creature.setCharge(k), Ease.inQuad);
    }
    const r: BossTurnResult = bossTurn(b);
    const bs = this.bossScreen();
    const hero = this.heroScreen();
    if (r.skipped) {
      popup(bs.x, bs.y - 60, 'Petrified — skips its action', 'note');
      audio.play('resist');
      await this.wait(0.8);
    } else if (r.hits.length) {
      const kind: CreatureAttack =
        intent.kind === 'drain' ? 'drain' : intent.kind === 'heavy' ? 'heavy' : r.hits.length > 1 ? 'volley' : 'strike';
      audio.play('bossAttack', { pitch: kind === 'heavy' ? 0.8 : 1 });
      await this.creature.playAttack(kind);
      this.creature.setCharge(0);
      let hp = this.shownHeroHp;
      for (const [i, hit] of r.hits.entries()) {
        hp -= hit.damage;
        this.shownHeroHp = Math.max(0, hp);
        const heavy = kind === 'heavy';
        await this.attackFx(kind, i);
        app.shake(heavy ? 0.7 : 0.35 + Math.min(0.3, hit.damage / b.stats.maxHp));
        app.rig.punch(heavy ? -0.9 : -0.4);
        if (hit.damage > 0) {
          this.hero.playHurt(.7);
          screenFlash(heavy ? 'rgba(255, 20, 40, 0.7)' : 'rgba(255, 30, 60, 0.5)', heavy ? 0.6 : 0.4);
          popup(hero.x + (Math.random() - 0.5) * 60, hero.y - 10 - i * 8, `-${hit.damage}`, 'hurt', { rot: (Math.random() - 0.5) * 14 });
          audio.play('playerHurt', { pitch: 0.9 + Math.random() * 0.2 });
          this.hud.shakeEl('heroBar');
        }
        if (hit.absorbed > 0) {
          popup(hero.x + 70, hero.y - 40, `Blocked ${hit.absorbed}`, 'blocked');
          audio.play('shieldBlock');
        }
        if (hit.reflected > 0) {
          popup(bs.x, bs.y - 20, `-${formatNum(hit.reflected)} Nemesis`, 'note');
          this.creature.playHurt(0.4);
          this.shownBossHp = Math.max(0, this.shownBossHp - hit.reflected);
          this.hud.setBossHp(this.shownBossHp, b.boss.maxHp);
        }
        this.hud.setHero(this.shownHeroHp, b.stats.maxHp, b.shield);
        anim.hitStop(heavy ? 0.12 : 0.05);
        if (r.hits.length > 1) await this.wait(0.2);
      }
      this.shownHeroHp = b.run.hp;
      if (r.bossHeal > 0) {
        popup(bs.x, bs.y - 50, `+${formatNum(r.bossHeal)}`, 'heal', { delay: 0.2 });
        this.shownBossHp = b.boss.hp;
        this.hud.setBossHp(this.shownBossHp, b.boss.maxHp);
        audio.play('heal', { pitch: 0.7 });
      }
      await this.wait(0.45);
    } else if (r.guardOn) {
      this.creature.playGuard(true);
      audio.play('bossGuard');
      popup(bs.x, bs.y - 60, 'DEF ×2', 'shield');
      await this.wait(0.7);
    } else if (r.atkUp) {
      audio.play('bossRoar');
      app.shake(0.3);
      await this.creature.playAttack('roar');
      popup(bs.x, bs.y - 60, `ATK +${r.atkUp}`, 'bad');
      await this.wait(0.6);
    }
    if (r.regrow) {
      popup(bs.x, bs.y - 30, `Regrowth +${formatNum(r.regrow)}`, 'heal');
      this.shownBossHp = b.boss.hp;
      this.hud.setBossHp(this.shownBossHp, b.boss.maxHp);
      audio.play('heal', { pitch: 0.6 });
      await this.wait(0.4);
    }
    if (r.rampage) {
      popup(bs.x, bs.y - 30, `Rampage · ATK +${r.rampage}`, 'bad');
      await this.wait(0.35);
    }
    if (!b.boss.guard) this.creature.playGuard(false);
    this.shownBossHp = b.boss.hp;
    this.refreshHud();
    if (r.playerDied) return this.defeat();
    if (r.revived) await this.revive();
    if (r.bossDied) return this.victory();
    await this.beginTurn();
  }

  // =============================================================================== endings
  private async victory(): Promise<void> {
    const app = this.app;
    const b = this.b;
    this.busy = true;
    this.refreshControls();
    audio.setMusic('none', 0.5);
    for (const v of this.handViews()) v.dim = 0.3;
    const core = this.creature.getAnchorWorld('core', new THREE.Vector3());
    audio.play('bossDeath');
    app.shake(0.9);
    anim.hitStop(0.25);
    centerFlash('rgba(255,250,235,0.35)', 0.4);
    const fxc = ELEMENT_FX[b.boss.inst.element];
    app.fx.stardust(core, [...fxc.colors, '#ffffff'], 420, 3);
    await this.creature.playDeath();
    this.banner('LABOR COMPLETE', 'rgba(255,210,120,.9)');
    audio.play('victory');
    const rewards = battleRewards(b);
    const healed = applyVictory(b, rewards);
    const run = app.run!;
    run.nodeIndex++;
    app.persist();
    await this.wait(1.6);
    if (run.nodes[run.nodeIndex]?.kind === 'apotheosis') void app.go(new EndScreen(app, 'victory'));
    else void app.go(new SpoilsScreen(app, rewards, healed, this.laborIndex));
  }

  private async defeat(): Promise<void> {
    const app = this.app;
    this.busy = true;
    this.refreshControls();
    audio.setMusic('none', 0.4);
    audio.play('defeat');
    screenFlash('rgba(120, 0, 20, 0.9)', 1.4);
    app.shake(0.6);
    for (const v of this.handViews()) {
      v.faceUp = false;
      v.dim = 0.6;
    }
    this.banner('YOUR LABORS END HERE', 'rgba(255,60,80,.9)');
    await this.creature.playAttack('roar').catch(() => undefined);
    await this.wait(2.2);
    void app.go(new EndScreen(app, 'defeat', LABOR_BY_ID[this.b.boss.inst.id].name));
  }

  /** debug helpers for automated screenshots */
  debug() {
    return {
      battle: this.b,
      selectFirst: (n: number) => {
        for (const id of this.order.slice(0, n)) this.toggleSelect(id);
      },
      play: () => this.playSelected(),
      discard: () => this.discardSelected(),
      busy: () => this.busy,
      handSize: () => handSize(this.b),
      hands: HAND_INFO,
      stats: () => effectiveStats(this.app.run!),
      sort: (m: 'rank' | 'element') => this.sortHand(m),
      bestFlushIds: () => {
        const byEl = new Map<string, number[]>();
        for (const id of this.order) {
          const c = this.views.get(id)!.card;
          byEl.set(c.element, [...(byEl.get(c.element) ?? []), id]);
        }
        return [...byEl.values()].sort((a, b2) => b2.length - a.length)[0].slice(0, 5);
      },
      selectIds: (ids: number[]) => ids.forEach((id) => this.toggleSelect(id)),
      /** exhaustive search for the strongest legal play (same as the balance bot) */
      bestPlayIds: () => {
        const hand = this.order.map((id) => this.views.get(id)!.card);
        let best: number[] = [];
        let bestDmg = -1;
        const rec = (start: number, cur: number[]) => {
          if (cur.length && canPlay(this.b, cur).ok) {
            const r = playHand(this.b, cur, true);
            if (r.damage > bestDmg) {
              bestDmg = r.damage;
              best = cur.slice();
            }
          }
          if (cur.length === 5) return;
          for (let i = start; i < hand.length; i++) {
            cur.push(hand[i].id);
            rec(i + 1, cur);
            cur.pop();
          }
        };
        rec(0, []);
        return best;
      },
    };
  }
}
