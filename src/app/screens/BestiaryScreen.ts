import type { App } from '../App';
import type { Screen } from '../Screen';
import { h } from '../../ui/dom';
import { icon } from '../../ui/art';
import { audio } from '../../audio/audio';
import { ConstellationCreature } from '../../gfx/boss/ConstellationCreature';
import { ELEMENT_PALETTE } from '../../gfx/palette';
import { LABORS, INTENT_DESC, makeIntent } from '../../logic/labors';
import type { LaborDef } from '../../logic/labors';
import { ELEMENTS } from '../../logic/types';
import type { Element } from '../../logic/types';
import { ELEMENT_INFO } from '../../logic/elements';
import { tooltip } from '../../ui/tooltip';

/** A museum of the twelve Labors: constellations unlock as you face them. */
export class BestiaryScreen implements Screen {
  readonly music = 'title';
  private app: App;
  private root!: HTMLElement;
  private list!: HTMLElement;
  private info!: HTMLElement;
  private creature: ConstellationCreature | null = null;
  private current: LaborDef = LABORS[0];
  private element: Element = 'fire';
  private cycleT = 0;
  private autoCycle = true;

  constructor(app: App) {
    this.app = app;
  }

  async enter(): Promise<void> {
    const app = this.app;
    app.bg.setAstrolabe(0.5, 0.52, 0.42, 0.8);
    this.list = h('div', { class: 'best-list panel no-gems' });
    this.info = h('div', { class: 'best-info panel' });
    this.root = h('div', { class: 'screen bestiary' },
      h('div', { class: 'map-title' }, h('div', { class: 'label', text: `${app.settings.seen.length} / 12 encountered` }), h('div', { class: 'title-gold', text: 'Bestiary of the Labors' })),
      this.list,
      this.info,
      h('div', { class: 'best-back' }, h('button', { class: 'btn dark', text: 'Back', on: { click: () => this.back() } })),
    );
    app.ui.appendChild(this.root);
    LABORS.forEach((l) => {
      const seen = this.isSeen(l);
      const row = h('div', { class: `best-row ${seen ? '' : 'locked'}`, attrs: { 'data-id': l.id } },
        h('span', { class: 'best-num', text: l.numeral }),
        h('span', { class: 'best-name', text: seen ? l.short : '— unknown —' }),
      );
      row.addEventListener('click', () => {
        audio.play('buttonSoft');
        this.show(l);
      });
      this.list.appendChild(row);
    });
    const first = LABORS.find((l) => this.isSeen(l)) ?? LABORS[0];
    this.show(first);
  }

  private isSeen(l: LaborDef): boolean {
    return this.app.settings.seen.includes(l.id);
  }

  private show(l: LaborDef): void {
    const app = this.app;
    this.current = l;
    this.list.querySelectorAll('.best-row').forEach((r) => r.classList.toggle('on', (r as HTMLElement).dataset.id === l.id));
    const seen = this.isSeen(l);
    this.creature?.removeFromParent();
    this.creature?.dispose();
    this.creature = new ConstellationCreature(l.id, ELEMENT_PALETTE[this.element], this.element, { detail: 'full' });
    this.creature.position.set(-1.2, 0.9, -7);
    this.creature.scale.setScalar(0.95);
    if (!seen) this.creature.setDim(0.85);
    app.stage.scene.add(this.creature);
    void this.creature.playIntro(1.6);
    app.bg.setPalette(ELEMENT_PALETTE[this.element], 1);

    const pattern = l.pattern.map((k) => makeIntent(l, k));
    const bar = (label: string, v: number) =>
      `<div class="best-stat"><span class="label">${label}</span><div class="best-bar"><div style="width:${Math.min(100, v * 55)}%"></div></div><span class="best-v">×${v.toFixed(2)}</span></div>`;
    this.info.innerHTML = '';
    const parts: Array<HTMLElement | null> = [
      h('div', { class: 'label', text: `Labor ${l.numeral}` }),
      h('div', { class: 'title-gold', style: 'font-size:1.8rem;margin:.15rem 0 .3rem', text: seen ? l.name : '???' }),
      h('div', { class: 'flavor', style: 'font-style:italic;color:var(--muted);margin-bottom:.7rem', text: seen ? l.flavor : 'Face this Labor to learn its secrets.' }),
      h('div', { class: 'best-lore', text: seen ? l.lore : '' }),
      seen ? h('div', { class: 'twist', style: 'margin-top:.8rem' }, h('div', { class: 't-name', html: `${icon('skull', '', '#ff9d7a')} ${l.twist.name}` }), h('div', { class: 't-desc', text: l.twist.desc })) : null,
      seen ? h('div', { class: 'best-stats', html: bar('HP', l.mods.hp) + bar('ATK', l.mods.atk) + bar('DEF', l.mods.def) }) : null,
      seen ? h('div', { class: 'label', style: 'margin-top:.8rem', text: 'Battle pattern' }) : null,
      seen ? h('div', { class: 'best-pattern', html: pattern.map((i) => `<span class="bchip" data-tt="${INTENT_DESC[i.kind]}">${i.name}</span>`).join('<span class="arrow">›</span>') }) : null,
      h('div', { class: 'label', style: 'margin-top:.9rem', text: 'Element of this run (random)' }),
      h('div', { class: 'best-els' }, ...ELEMENTS.map((e) => {
        const b = h('span', { class: `chip-mini el-${e} ${e === this.element ? 'weak' : ''}`, html: `${icon(e)}${ELEMENT_INFO[e].name}` });
        b.style.cursor = 'pointer';
        b.addEventListener('click', () => {
          this.autoCycle = false;
          this.setElement(e);
        });
        return b;
      })),
    ];
    this.info.append(...parts.filter((x): x is HTMLElement => !!x));
    this.info.querySelectorAll<HTMLElement>('[data-tt]').forEach((el) => tooltip.attach(el, el.dataset.tt!));
  }

  private setElement(e: Element): void {
    this.element = e;
    this.creature?.setPalette(ELEMENT_PALETTE[e], e, 0.8);
    this.app.bg.setPalette(ELEMENT_PALETTE[e], 1);
    this.info.querySelectorAll('.best-els .chip-mini').forEach((c, i) => c.classList.toggle('weak', ELEMENTS[i] === e));
  }

  private back(): void {
    audio.play('button');
    void import('./TitleScreen').then(({ TitleScreen }) => this.app.go(new TitleScreen(this.app)));
  }

  onKey(e: KeyboardEvent): void {
    const i = LABORS.indexOf(this.current);
    if (e.key === 'ArrowDown') this.show(LABORS[(i + 1) % 12]);
    else if (e.key === 'ArrowUp') this.show(LABORS[(i + 11) % 12]);
    else if (e.key === 'Escape') this.back();
  }

  update(dt: number, time: number): void {
    this.creature?.update(dt, time);
    if (this.autoCycle) {
      this.cycleT += dt;
      if (this.cycleT > 6) {
        this.cycleT = 0;
        this.setElement(ELEMENTS[(ELEMENTS.indexOf(this.element) + 1) % 4]);
      }
    }
  }

  exit(): void {
    this.creature?.removeFromParent();
    this.creature?.dispose();
    this.root.remove();
    this.app.bg.setAstrolabe(0.5, 0.5, 0.4, 0);
    tooltip.hide();
  }
}
