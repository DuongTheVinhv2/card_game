import type { App } from '../App';
import type { Screen } from '../Screen';
import { h } from '../../ui/dom';
import { patronArt } from '../../ui/art';
import { audio } from '../../audio/audio';
import { attachTilt } from '../../ui/tilt';
import { offerPatrons, choosePatron } from '../../logic/patrons';
import type { PatronDef } from '../../logic/patrons';
import { anim } from '../../core/anim';
import { MapScreen } from './MapScreen';

export class PatronScreen implements Screen {
  readonly music = 'title';
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
    const patrons = offerPatrons(run, 3);
    const row = h('div', { class: 'patron-row' });
    patrons.forEach((p, i) => row.appendChild(this.card(p, i)));
    this.root = h('div', { class: 'screen patron' },
      h('div', { class: 'agora-head' },
        h('div', { class: 'label', text: 'Before the first Labor' }),
        h('div', { class: 'title-gold agora-title', text: 'Choose your Patron' }),
        h('div', { class: 'label', style: 'margin-top:.4rem', text: 'An Olympian will watch over this run' }),
      ),
      row,
    );
    app.ui.appendChild(this.root);
  }

  private card(p: PatronDef, i: number): HTMLElement {
    const el = h('div', { class: 'offer-card patron-card', style: `--i:${i};--pc:${p.color}` },
      h('div', { class: 'tilt' }, h('img', { attrs: { src: patronArt(p.id), alt: p.name } }), h('div', { class: 'glare' })),
      h('div', { class: 'offer-name', text: p.name }),
      h('div', { class: 'offer-kind', text: p.epithet }),
      h('div', { class: 'offer-desc', text: p.desc }),
    );
    el.animate([{ opacity: 0, transform: 'translateY(2rem) rotateY(70deg)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: 200 + i * 140, easing: 'cubic-bezier(.2,.9,.25,1)', fill: 'both' });
    attachTilt(el.querySelector('.tilt') as HTMLElement);
    el.addEventListener('mouseenter', () => audio.play('hover', { volume: 0.5 }));
    el.addEventListener('click', () => this.pick(p, el));
    return el;
  }

  private async pick(p: PatronDef, el: HTMLElement): Promise<void> {
    if (this.chosen) return;
    this.chosen = true;
    const run = this.app.run!;
    choosePatron(run, p.id);
    audio.play('levelUp');
    el.classList.add('chosen');
    this.root.querySelectorAll('.patron-card').forEach((c) => {
      if (c !== el) (c as HTMLElement).animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(1rem) scale(.95)' }], { duration: 400, fill: 'both' });
    });
    this.app.persist();
    await anim.waitReal(1.0);
    void this.app.go(new MapScreen(this.app));
  }

  exit(): void {
    this.root.remove();
  }

  update(): void {}
}
