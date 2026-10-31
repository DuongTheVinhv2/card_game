import type { App } from '../App';
import type { Screen } from '../Screen';
import type { BattleRewards } from '../../logic/battle';
import { rollGifts } from '../../logic/shop';
import { BOON_BY_ID } from '../../logic/boons';
import { addBoon, canAddBoon, removeBoon, boonSellValue } from '../../logic/run';
import { LABOR_BY_ID } from '../../logic/labors';
import { h } from '../../ui/dom';
import { boonArt, icon } from '../../ui/art';
import { tooltip } from '../../ui/tooltip';
import { anim } from '../../core/anim';
import { audio } from '../../audio/audio';
import { popup } from '../../ui/popups';
import { openModal } from '../../ui/modals';
import { attachTilt } from '../../ui/tilt';
import { MapScreen } from './MapScreen';

export class SpoilsScreen implements Screen {
  readonly music = 'shop';
  private app: App;
  private rewards: BattleRewards | null;
  private healed: number;
  private laborIndex: number;
  private root!: HTMLElement;
  private done = false;

  constructor(app: App, rewards: BattleRewards | null, healed: number, laborIndex: number) {
    this.app = app;
    this.rewards = rewards;
    this.healed = healed;
    this.laborIndex = laborIndex;
  }

  async enter(): Promise<void> {
    const app = this.app;
    const run = app.run!;
    app.bg.setPalette(null, 1.5);
    app.fx.setMoteColor('#ffd9a0');
    const inst = run.labors[this.laborIndex];
    const def = LABOR_BY_ID[inst.id];

    const lines = h('div', { class: 'cash-lines' });
    const total = h('div', { class: 'cash-total' });
    const gifts = h('div', { class: 'gift-row' });
    const giftWrap = h('div', { class: 'gift-wrap', style: 'opacity:0' },
      h('div', { class: 'section-title title-gold', text: 'Gifts of the Gods' }),
      h('div', { class: 'label', style: 'text-align:center;margin-bottom:1rem', text: 'Choose one boon to carry into the next Labor' }),
      gifts,
      h('div', { class: 'actions', style: 'display:flex;justify-content:center;margin-top:1.4rem' },
        h('button', { class: 'btn dark small', text: 'Decline (+3 drachmae)', on: { click: () => this.finish(null) } }),
      ),
    );
    this.root = h('div', { class: 'screen spoils' },
      h('div', { class: 'spoils-card panel rise-in' },
        h('div', { class: 'label', style: 'text-align:center', text: `Labor ${def.numeral} complete` }),
        h('div', { class: 'section-title title-gold', text: def.name }),
        h('div', { class: 'meander', style: 'margin:.6rem 0 1rem' }),
        lines,
        total,
      ),
      giftWrap,
    );
    app.ui.appendChild(this.root);

    // cash-out sequence
    void (async () => {
      await anim.wait(0.7);
      let sum = 0;
      for (const l of this.rewards?.lines ?? []) {
        const row = h('div', { class: 'cash-line rise-in' }, h('span', { text: l.label }), h('span', { class: 'c-gold', html: `+${l.amount} ${icon('gold', '', '#ffd25a')}` }));
        lines.appendChild(row);
        sum += l.amount;
        audio.play('coin', { pitch: 0.9 + Math.random() * 0.3 });
        await anim.wait(0.32);
      }
      if (this.healed > 0) {
        lines.appendChild(h('div', { class: 'cash-line rise-in' }, h('span', { text: 'Rest after the Labor' }), h('span', { class: 'c-heal', text: `+${this.healed} HP` })));
        audio.play('heal');
        await anim.wait(0.3);
      }
      total.innerHTML = `<span>Drachmae</span><span class="c-gold">${run.gold} ${icon('gold', '', '#ffd25a')}</span>`;
      total.classList.add('bump');
      const r = total.getBoundingClientRect();
      popup(r.right - 40, r.top, `+${sum}`, 'gold');
      audio.play('buy');
      await anim.wait(0.5);
      this.showGifts(gifts);
      giftWrap.animate([{ opacity: 0, transform: 'translateY(1rem)' }, { opacity: 1, transform: 'none' }], { duration: 500, fill: 'both', easing: 'ease-out' });
    })();
  }

  private showGifts(row: HTMLElement): void {
    const run = this.app.run!;
    const ids = rollGifts(run, 3);
    ids.forEach((id, i) => {
      const d = BOON_BY_ID[id];
      const card = h('div', { class: 'offer-card', style: `--i:${i}` },
        h('div', { class: 'tilt' }, h('img', { attrs: { src: boonArt(id), alt: d.name } }), h('div', { class: 'glare' })),
        h('div', { class: `offer-name rarity-${d.rarity}`, text: d.name }),
        h('div', { class: 'offer-desc', text: d.desc() }),
        h('div', { class: `offer-rarity rarity-${d.rarity}`, text: d.rarity }),
      );
      attachTilt(card.querySelector('.tilt') as HTMLElement);
      card.addEventListener('click', () => this.pick(id));
      card.addEventListener('mouseenter', () => audio.play('hover', { volume: 0.5 }));
      row.appendChild(card);
    });
  }

  private pick(id: string): void {
    if (this.done) return;
    const run = this.app.run!;
    if (!canAddBoon(run)) {
      this.replacePrompt(id);
      return;
    }
    addBoon(run, id);
    audio.play('levelUp');
    this.finish(id);
  }

  private replacePrompt(id: string): void {
    const run = this.app.run!;
    let close: () => void = () => undefined;
    const row = h('div', { class: 'gift-row', style: 'gap:.8rem' });
    for (const inst of run.boons) {
      const d = BOON_BY_ID[inst.id];
      const el = h('div', { class: 'offer-card small' },
        h('img', { attrs: { src: boonArt(inst.id), alt: d.name } }),
        h('div', { class: 'offer-name', text: d.name }),
        h('div', { class: 'offer-desc', html: `Release for <span class="c-gold">${boonSellValue(inst)}</span>` }),
      );
      el.addEventListener('click', () => {
        removeBoon(run, inst.uid);
        run.gold += boonSellValue(inst);
        addBoon(run, id);
        audio.play('sell');
        close();
        this.finish(id);
      });
      row.appendChild(el);
    }
    const panel = h('div', { class: 'panel modal' },
      h('h2', { class: 'title-gold', text: 'Your hands are full' }),
      h('div', { class: 'label', style: 'text-align:center;margin-bottom:1rem', text: `Release a boon to accept ${BOON_BY_ID[id].name}` }),
      row,
      h('div', { class: 'actions' }, h('button', { class: 'btn dark small', text: 'Cancel', on: { click: () => close() } })),
    );
    close = openModal(panel);
  }

  private finish(id: string | null): void {
    if (this.done) return;
    this.done = true;
    const run = this.app.run!;
    if (!id) {
      run.gold += 3;
      audio.play('coin');
    }
    tooltip.hide();
    run.nodeIndex++;
    this.app.persist();
    void this.app.go(new MapScreen(this.app));
  }

  exit(): void {
    this.root.remove();
  }

  update(): void {}
}
