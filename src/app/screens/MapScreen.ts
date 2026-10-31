import * as THREE from 'three';
import type { App } from '../App';
import type { Screen } from '../Screen';
import { h } from '../../ui/dom';
import { icon, boonArt, scrollArt } from '../../ui/art';
import { tooltip } from '../../ui/tooltip';
import { audio } from '../../audio/audio';
import { ConstellationCreature } from '../../gfx/boss/ConstellationCreature';
import { ELEMENT_PALETTE, HERO_PALETTE } from '../../gfx/palette';
import { LABOR_BY_ID } from '../../logic/labors';
import { ELEMENT_INFO } from '../../logic/elements';
import type { MapNode } from '../../logic/run';
import { effectiveStats, healRun } from '../../logic/run';
import { popup } from '../../ui/popups';
import { BOON_BY_ID } from '../../logic/boons';
import { SCROLL_BY_ID } from '../../logic/scrolls';
import { anim, Ease, formatNum } from '../../core/anim';
import { openOptions, openDeckViewer, openHandsTable } from '../../ui/modals';
import { boonTooltip } from '../../ui/BattleHud';
import { BattleScreen } from './BattleScreen';
import { AgoraScreen } from './AgoraScreen';
import { SanctuaryScreen } from './SanctuaryScreen';
import { SpoilsScreen } from './SpoilsScreen';
import { EndScreen } from './EndScreen';

const NODE_INFO: Record<MapNode['kind'], { name: string; icon: string; desc: string; action: string }> = {
  labor: { name: 'Labor', icon: 'skull', desc: '', action: 'Begin the Labor' },
  spoils: { name: 'Gifts of the Gods', icon: 'laurel', desc: 'The Olympians offer a boon for your trials.', action: 'Receive the gift' },
  agora: { name: 'The Agora', icon: 'amphora', desc: 'Merchants of Hellas sell boons, scrolls, constellations and elixirs.', action: 'Enter the Agora' },
  sanctuary: { name: 'Sanctuary', icon: 'temple', desc: 'Rest, train, or study the stars before the next Labor.', action: 'Enter the Sanctuary' },
  apotheosis: { name: 'Olympus', icon: 'olympus', desc: 'Complete the Labors and ascend.', action: 'Ascend' },
};

export class MapScreen implements Screen {
  readonly music = 'map';
  private app: App;
  private root!: HTMLElement;
  private svg!: SVGSVGElement;
  private nodeEls: HTMLElement[] = [];
  private nodePos: THREE.Vector3[] = [];
  private creatures: Array<{ c: ConstellationCreature; idx: number }> = [];
  private group = new THREE.Group();
  private heroStar = new THREE.Vector3();
  private heroEl!: HTMLElement;
  private focusX = 0;
  private ready = false;
  private leaving = false;

  constructor(app: App) {
    this.app = app;
  }

  async enter(): Promise<void> {
    const app = this.app;
    const run = app.run!;
    app.bg.setPalette(null, 1.5);
    app.bg.setAstrolabe(0.5, 0.5, 0.4, 0);
    app.fx.setMoteColor('#ffd9a0');
    app.stage.scene.add(this.group);

    // world layout along a gently winding path
    let x = 0;
    run.nodes.forEach((n, i) => {
      if (i > 0) x += n.kind === 'labor' || run.nodes[i - 1].kind === 'labor' ? 6.2 : 4.0;
      const y = n.kind === 'labor' ? -3.4 : -3.4 + Math.sin(i * 1.7) * 1.0;
      this.nodePos.push(new THREE.Vector3(x, y, -2));
    });
    run.nodes.forEach((n, i) => {
      if (n.kind !== 'labor' || n.labor === undefined) return;
      const inst = run.labors[n.labor];
      const defeated = n.labor < run.laborsDefeated;
      const c = new ConstellationCreature(inst.id, defeated ? HERO_PALETTE : ELEMENT_PALETTE[inst.element], inst.element, { detail: 'preview' });
      c.position.set(this.nodePos[i].x, 3.6, -10);
      c.scale.setScalar(0.78);
      const current = i === run.nodeIndex;
      c.setDim(defeated ? 0.15 : current ? 0 : 0.55);
      this.group.add(c);
      this.creatures.push({ c, idx: i });
    });

    // ---------------- DOM
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.classList.add('map-svg');
    const nodesLayer = h('div', { class: 'map-nodes' });
    run.nodes.forEach((n, i) => {
      const el = this.makeNode(n, i);
      nodesLayer.appendChild(el);
      this.nodeEls.push(el);
    });
    this.heroEl = h('div', { class: 'map-hero', html: `<div class="hero-star"></div>` });
    nodesLayer.appendChild(this.heroEl);

    const st = effectiveStats(run);
    const hpFill = h('div', { class: 'fill', style: `width:${(run.hp / st.maxHp) * 100}%` });
    const hpTxt = h('div', { class: 'txt', text: `${run.hp} / ${st.maxHp}` });
    const side = h('div', { class: 'panel map-side rise-in' },
      h('div', { class: 'title-gold', style: 'font-size:1.25rem', text: 'Heracles' }),
      h('div', { class: 'bar', style: 'margin:.5rem 0 .6rem' }, hpFill, h('div', { class: 'shine' }), hpTxt),
      h('div', { class: 'stat-grid' },
        h('div', { class: 'stat atk', html: `${icon('atk')}<span class="v">${st.atk}</span><span class="k">ATK</span>` }),
        h('div', { class: 'stat def', html: `${icon('def')}<span class="v">${st.def}</span><span class="k">DEF</span>` }),
        h('div', { class: 'stat', html: `${icon('gold', '', '#ffd25a')}<span class="v c-gold">${run.gold}</span><span class="k">GOLD</span>` }),
      ),
      h('div', { class: 'label', style: 'margin-top:.9rem', text: 'Boons' }),
      h('div', { class: 'map-boons' }, ...run.boons.map((b) => {
        const img = h('img', { attrs: { src: boonArt(b.id) } });
        tooltip.attach(img, () => boonTooltip(b.id, b.counter));
        return img;
      }), ...(run.boons.length ? [] : [h('div', { class: 'tt-dim', style: 'font-size:.8rem', text: 'None yet' })])),
      h('div', { class: 'label', style: 'margin-top:.7rem', text: 'Scrolls' }),
      h('div', { class: 'map-boons' }, ...run.consumables.map((s, slot) => {
        const d = SCROLL_BY_ID[s];
        const img = h('img', { attrs: { src: scrollArt(s) }, style: d.battleOnly ? '' : 'cursor:pointer' });
        tooltip.attach(img, () => `<div class="tt-title">${d.name}</div>${d.desc}<div class="tt-row tt-dim">${d.battleOnly ? 'Use it during a Labor.' : 'Click to use now.'}</div>`);
        if (!d.battleOnly) {
          img.addEventListener('click', () => {
            const healed = healRun(run, effectiveStats(run).maxHp * 0.3);
            run.consumables.splice(slot, 1);
            audio.play('heal');
            const r = img.getBoundingClientRect();
            popup(r.left + r.width / 2, r.top, `+${healed} HP`, 'heal');
            tooltip.hide();
            app.persist();
            img.remove();
            hpFill.style.width = `${(run.hp / effectiveStats(run).maxHp) * 100}%`;
            hpTxt.textContent = `${run.hp} / ${effectiveStats(run).maxHp}`;
          });
        }
        return img;
      }), ...(run.consumables.length ? [] : [h('div', { class: 'tt-dim', style: 'font-size:.8rem', text: 'None' })])),
      h('div', { class: 'left-foot', style: 'margin-top:1rem' },
        h('button', { class: 'btn dark small', text: 'Hands', on: { click: () => openHandsTable(run) } }),
        h('button', { class: 'btn dark small', text: `Deck ${run.deck.length}`, on: { click: () => openDeckViewer(app, null) } }),
        h('button', { class: 'btn dark small', text: 'Options', on: { click: () => openOptions(app, { inRun: true }) } }),
      ),
    );

    const info = this.makeInfo(run.nodes[run.nodeIndex], run.nodeIndex);
    this.root = h('div', { class: 'screen map' },
      h('div', { class: 'map-title' }, h('div', { class: 'label', text: run.endless ? 'Endless Labors' : `Labors completed · ${run.laborsDefeated} / ${run.labors.length}` }), h('div', { class: 'title-gold', text: 'The Path of Heracles' })),
      this.svg as unknown as HTMLElement,
      nodesLayer,
      side,
      info,
    );
    app.ui.appendChild(this.root);

    // camera & hero star travel
    const prev = Math.max(0, run.nodeIndex - 1);
    const from = this.nodePos[prev];
    const to = this.nodePos[run.nodeIndex] ?? from;
    this.heroStar.copy(run.nodeIndex > 0 ? from : to);
    this.focusX = this.heroStar.x;
    this.applyFocus();
    this.ready = true;
    if (run.nodeIndex > 0) {
      void anim.wait(0.5).then(() => {
        audio.play('mapStep');
        return anim.tween(1.1, (k) => {
          this.heroStar.lerpVectors(from, to, k);
          this.heroStar.y += Math.sin(k * Math.PI) * 1.2;
          this.focusX = this.heroStar.x;
        }, Ease.inOutCubic);
      }).then(() => {
        audio.play('nodeSelect', { volume: 0.6 });
        this.app.fx.sparkle(to, '#ffd27a', 26, 1.5);
      });
    }
  }

  private makeNode(n: MapNode, i: number): HTMLElement {
    const run = this.app.run!;
    const state = i < run.nodeIndex ? 'done' : i === run.nodeIndex ? 'current' : 'future';
    let inner = icon(NODE_INFO[n.kind].icon);
    let cls = '';
    if (n.kind === 'labor' && n.labor !== undefined) {
      const inst = run.labors[n.labor];
      inner = `<span class="numeral">${LABOR_BY_ID[inst.id].numeral}</span>`;
      cls = `labor el-${inst.element}`;
    }
    const el = h('div', { class: `map-node ${n.kind} ${state} ${cls}`, html: `<div class="disc">${inner}</div><div class="cap">${this.nodeCaption(n)}</div>` });
    if (state === 'current') el.addEventListener('click', () => this.go());
    tooltip.attach(el, () => this.nodeTooltip(n));
    el.addEventListener('mouseenter', () => audio.play('hover', { volume: 0.4 }));
    return el;
  }

  private nodeCaption(n: MapNode): string {
    if (n.kind === 'labor' && n.labor !== undefined) return LABOR_BY_ID[this.app.run!.labors[n.labor].id].short;
    return NODE_INFO[n.kind].name;
  }

  private nodeTooltip(n: MapNode): string {
    const run = this.app.run!;
    if (n.kind === 'labor' && n.labor !== undefined) {
      const inst = run.labors[n.labor];
      const d = LABOR_BY_ID[inst.id];
      return `<div class="tt-sub">Labor ${d.numeral} · Stage ${inst.stage + 1}</div><div class="tt-title">${d.name}</div>` +
        `<div class="tt-row"><span class="el-${inst.element}">${ELEMENT_INFO[inst.element].name}</span> · weak to <span class="el-${inst.weak}">${ELEMENT_INFO[inst.weak].name}</span> · resists ${inst.resists.map((r) => `<span class="el-${r}">${ELEMENT_INFO[r].name}</span>`).join(', ')}</div>` +
        `<div class="tt-row">HP <b>${formatNum(inst.maxHp)}</b> · DEF <b>${inst.def}</b> · ATK <b>${inst.atk}</b></div>` +
        `<div class="tt-row"><b style="color:#ff9d7a">${d.twist.name}:</b> ${d.twist.desc}</div>`;
    }
    return `<div class="tt-title">${NODE_INFO[n.kind].name}</div><div class="tt-row">${NODE_INFO[n.kind].desc}</div>`;
  }

  private makeInfo(n: MapNode | undefined, i: number): HTMLElement {
    const run = this.app.run!;
    if (!n) return h('div');
    let body: HTMLElement;
    if (n.kind === 'labor' && n.labor !== undefined) {
      const inst = run.labors[n.labor];
      const d = LABOR_BY_ID[inst.id];
      body = h('div', null,
        h('div', { class: 'label', text: `Next · Labor ${d.numeral} · Stage ${inst.stage + 1}` }),
        h('div', { class: 'title-gold', style: 'font-size:1.7rem;margin:.2rem 0', text: d.name }),
        h('div', { class: 'flavor', style: 'font-style:italic;color:var(--muted);margin-bottom:.6rem', text: d.flavor }),
        h('div', { class: 'el-row', html:
          `<span class="chip-mini el-${inst.element}">${icon(inst.element)}${ELEMENT_INFO[inst.element].name}</span>` +
          ` <span class="tt-dim" style="font-size:.75rem">weak</span> <span class="chip-mini el-${inst.weak} weak">${icon(inst.weak)}${ELEMENT_INFO[inst.weak].name}</span>` +
          ` <span class="tt-dim" style="font-size:.75rem">resists</span> ${inst.resists.map((r) => `<span class="chip-mini el-${r} res">${icon(r)}${ELEMENT_INFO[r].name}</span>`).join(' ')}` }),
        h('div', { class: 'boss-mini-stats', html:
          `<span class="bchip">${icon('hp', '', '#ff6b7f')}<span class="k">HP</span>${formatNum(inst.maxHp)}</span>` +
          `<span class="bchip def">${icon('def')}<span class="k">DEF</span>${inst.def}</span>` +
          `<span class="bchip atk">${icon('atk')}<span class="k">ATK</span>${inst.atk}</span>` }),
        h('div', { class: 'twist', style: 'margin-top:.7rem' }, h('div', { class: 't-name', html: `${icon('skull', '', '#ff9d7a')} ${d.twist.name}` }), h('div', { class: 't-desc', text: d.twist.desc })),
      );
    } else {
      body = h('div', null,
        h('div', { class: 'label', text: 'Next' }),
        h('div', { class: 'title-gold', style: 'font-size:1.7rem;margin:.2rem 0', text: NODE_INFO[n.kind].name }),
        h('div', { style: 'color:var(--text);opacity:.85', text: NODE_INFO[n.kind].desc }),
      );
    }
    void i;
    return h('div', { class: 'panel map-info rise-in' }, body,
      h('div', { class: 'map-go' },
        h('button', { class: `btn ${n.kind === 'labor' ? 'red' : ''}`, text: NODE_INFO[n.kind].action, on: { click: () => this.go() } }),
      ),
    );
  }

  private go(): void {
    if (this.leaving) return;
    this.leaving = true;
    const app = this.app;
    const run = app.run!;
    const n = run.nodes[run.nodeIndex];
    audio.play('nodeSelect');
    if (!n) return;
    switch (n.kind) {
      case 'labor':
        void app.go(new BattleScreen(app, n.labor!));
        break;
      case 'agora':
        void app.go(new AgoraScreen(app));
        break;
      case 'sanctuary':
        void app.go(new SanctuaryScreen(app));
        break;
      case 'spoils':
        void app.go(new SpoilsScreen(app, null, 0, Math.max(0, run.laborsDefeated - 1)));
        break;
      case 'apotheosis':
        void app.go(new EndScreen(app, 'victory'));
        break;
    }
  }

  private applyFocus(): void {
    const rig = this.app.rig;
    // look a little ahead along the path, from further away so the whole journey reads
    rig.offset.set(this.focusX + 7, 1.5, 13);
    rig.lookOffset.set(this.focusX + 7, 0, 0);
  }

  update(dt: number, time: number): void {
    if (!this.ready) return;
    this.applyFocus();
    for (const { c } of this.creatures) c.update(dt, time);
    const app = this.app;
    const w = app.w;
    const hh = app.h;
    const pts: Array<{ x: number; y: number }> = [];
    this.nodePos.forEach((p, i) => {
      const s = app.rig.worldToScreen(p, w, hh);
      pts.push({ x: s.x, y: s.y });
      const el = this.nodeEls[i];
      el.style.transform = `translate(${s.x}px, ${s.y}px)`;
    });
    const hs = app.rig.worldToScreen(this.heroStar, w, hh);
    this.heroEl.style.transform = `translate(${hs.x}px, ${hs.y}px)`;
    // path
    const run = app.run!;
    let d1 = '';
    let d2 = '';
    pts.forEach((p, i) => {
      if (i === 0) return;
      const a = pts[i - 1];
      const mx = (a.x + p.x) / 2;
      const seg = `M${a.x},${a.y} C${mx},${a.y} ${mx},${p.y} ${p.x},${p.y}`;
      if (i <= run.nodeIndex) d1 += seg;
      else d2 += seg;
    });
    this.svg.setAttribute('viewBox', `0 0 ${w} ${hh}`);
    this.svg.innerHTML = `<path d="${d2}" class="path-future"/><path d="${d1}" class="path-done"/>`;
    // glitter on the hero star
    if (Math.random() < dt * 20) {
      app.fx.add.emit({ pos: this.heroStar, count: 1, spread: 0.2, speed: [0.2, 0.8], life: [0.5, 1], size: [0.06, 0.14], color: ['#ffe2a0', '#ffffff'], intensity: 2.5, drag: 1, gravity: -0.4 });
    }
  }

  exit(): void {
    for (const { c } of this.creatures) {
      c.removeFromParent();
      c.dispose();
    }
    this.group.removeFromParent();
    this.root.remove();
  }
}
