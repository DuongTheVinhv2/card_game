import type { App } from '../App';
import type { Screen } from '../Screen';
import { h } from '../../ui/dom';
import { icon } from '../../ui/art';
import { audio } from '../../audio/audio';
import { popup } from '../../ui/popups';
import { sanctuaryOptions } from '../../logic/shop';
import { effectiveStats } from '../../logic/run';
import { anim } from '../../core/anim';
import { MapScreen } from './MapScreen';

export class SanctuaryScreen implements Screen {
  readonly music = 'map';
  private app: App;
  private root!: HTMLElement;
  private chosen = false;

  constructor(app: App) {
    this.app = app;
  }

  async enter(): Promise<void> {
    const app = this.app;
    const run = app.run!;
    app.bg.setPalette(null, 1.5);
    const st = effectiveStats(run);
    const opts = sanctuaryOptions(run);
    const row = h('div', { class: 'sanct-row' });
    opts.forEach((o, i) => {
      const tile = h('div', { class: 'sanct-tile panel no-gems rise-in', style: `animation-delay:${i * 0.07}s` },
        h('div', { class: 'sanct-ico', html: icon(o.icon) }),
        h('div', { class: 'offer-name', text: o.name }),
        h('div', { class: 'offer-desc', text: o.desc }),
      );
      tile.addEventListener('mouseenter', () => audio.play('hover', { volume: 0.5 }));
      tile.addEventListener('click', () => this.pick(i, tile));
      row.appendChild(tile);
    });
    this.root = h('div', { class: 'screen sanctuary' },
      h('div', { class: 'agora-head' },
        h('div', { class: 'label', text: 'A quiet temple among the stars' }),
        h('div', { class: 'title-gold agora-title', text: 'Sanctuary' }),
        h('div', { class: 'label', style: 'margin-top:.4rem', text: `HP ${run.hp} / ${st.maxHp} · ATK ${st.atk} · DEF ${st.def}` }),
      ),
      h('div', { class: 'label sanct-sub', text: 'Choose one blessing' }),
      row,
    );
    app.ui.appendChild(this.root);
  }

  private async pick(i: number, tile: HTMLElement): Promise<void> {
    if (this.chosen) return;
    this.chosen = true;
    const run = this.app.run!;
    const o = sanctuaryOptions(run)[i];
    o.apply(run);
    audio.play(o.id === 'rest' ? 'heal' : 'levelUp');
    tile.classList.add('chosen');
    const r = tile.getBoundingClientRect();
    popup(r.left + r.width / 2, r.top + r.height / 2, 'Blessed', 'banner', { scale: 0.7 });
    this.root.querySelectorAll('.sanct-tile').forEach((t) => {
      if (t !== tile) (t as HTMLElement).style.opacity = '0.25';
    });
    run.nodeIndex++;
    this.app.persist();
    await anim.waitReal(1.0);
    void this.app.go(new MapScreen(this.app));
  }

  exit(): void {
    this.root.remove();
  }

  update(): void {}
}
