import * as THREE from 'three';
import type { App } from '../App';
import type { Screen } from '../Screen';
import { h } from '../../ui/dom';
import { audio } from '../../audio/audio';
import { ConstellationCreature } from '../../gfx/boss/ConstellationCreature';
import { HERO_PALETTE } from '../../gfx/palette';
import { CardView } from '../../gfx/cards/CardView';
import { loadRun, newRun, saveRun } from '../../logic/run';
import { randomSeed } from '../../logic/rng';
import { openOptions, openHowToPlay } from '../../ui/modals';
import { anim } from '../../core/anim';
import type { Card } from '../../logic/types';
import { PatronScreen } from './PatronScreen';
import { MapScreen } from './MapScreen';
import { BestiaryScreen } from './BestiaryScreen';

export class TitleScreen implements Screen {
  readonly music = 'title';
  private app: App;
  private root!: HTMLElement;
  private hero!: ConstellationCreature;
  private cards: CardView[] = [];
  private group = new THREE.Group();
  private autoNew: boolean;
  private t = 0;

  constructor(app: App, autoNew = false) {
    this.app = app;
    this.autoNew = autoNew;
  }

  async enter(): Promise<void> {
    const app = this.app;
    app.bg.setPalette(null, 2);
    app.bg.setAstrolabe(0.5, 0.56, 0.5, 0.9);
    app.fx.setMoteColor('#ffd9a0');
    app.stage.scene.add(this.group);

    this.hero = new ConstellationCreature('heracles', HERO_PALETTE, null, { detail: 'full' });
    this.hero.position.set(0, 0.9, -9);
    this.hero.scale.setScalar(1.15);
    this.group.add(this.hero);
    void this.hero.playIntro(3.2);

    const aces: Card[] = (['fire', 'water', 'wind', 'earth'] as const).map((el, i) => ({ id: -10 - i, rank: 14, element: el, enh: i === 1 ? 'divine' : i === 2 ? 'olympian' : 'none' }));
    aces.forEach((c, i) => {
      const v = new CardView(c);
      v.faceUp = false;
      this.group.add(v.group);
      this.cards.push(v);
      v.setTarget(0, -9, 0, 0, 1.55);
      v.snap();
      void anim.wait(0.9 + i * 0.12).then(() => {
        v.faceUp = true;
        audio.play('deal', { volume: 0.6 });
      });
    });

    const saved = loadRun();
    const s = app.settings;
    const title = h('div', { class: 'title-logo' });
    'DODEKATHLOS'.split('').forEach((ch, i) => {
      const sp = h('span', { text: ch });
      sp.style.animationDelay = `${0.15 + i * 0.06}s`;
      title.appendChild(sp);
    });
    this.root = h('div', { class: 'screen title' },
      h('div', { class: 'title-top' },
        h('div', { class: 'title-kicker', text: 'The Northbound · Twelve Ancient Trials' }),
        title,
        h('div', { class: 'title-tag', text: 'A Viking far from home. Twelve gods standing in his way.' }),
      ),
      h('div', { class: 'title-menu' },
        saved ? h('button', { class: 'btn blue', html: `Continue<span class="sub">Labors ${saved.laborsDefeated}/${saved.labors.length} · ${saved.gold} drachmae</span>`, on: { click: () => this.cont() } }) : null,
        h('button', { class: 'btn big-btn', text: 'Begin the Labors', on: { click: () => this.start() } }),
        h('div', { class: 'title-sub-row' },
          h('button', { class: 'btn dark small', text: 'How to play', on: { click: () => { audio.play('button'); openHowToPlay(); } } }),
          h('button', { class: 'btn dark small', text: 'Bestiary', on: { click: () => { audio.play('button'); void app.go(new BestiaryScreen(app)); } } }),
          h('button', { class: 'btn dark small', text: 'Options', on: { click: () => { audio.play('button'); openOptions(app, { inRun: false }); } } }),
        ),
      ),
      h('div', { class: 'title-foot label', text: s.runs ? `Runs ${s.runs} · Apotheoses ${s.wins} · Most labors ${s.bestLabors}` : 'Click anywhere to awaken the music' }),
    );
    app.ui.appendChild(this.root);
    if (this.autoNew) void anim.waitReal(0.2).then(() => this.start());
  }

  private start(): void {
    audio.play('button');
    const app = this.app;
    const run = newRun(randomSeed());
    app.run = run;
    saveRun(run);
    const first = !app.settings.tutorialSeen;
    if (first) {
      app.settings.tutorialSeen = true;
      app.saveSettings();
      openHowToPlay(() => void app.go(new PatronScreen(app)));
    } else void app.go(new PatronScreen(app));
  }

  private cont(): void {
    audio.play('button');
    const run = loadRun();
    if (!run) return;
    this.app.run = run;
    void this.app.go(new MapScreen(this.app));
  }

  update(dt: number, time: number): void {
    this.t += dt;
    this.hero.update(dt, time);
    const n = this.cards.length;
    const pr = this.app.rig.parallax;
    // two Aces flank each side of the menu, fanned outward
    const xs = [-6.4, -4.75, 4.75, 6.4];
    const rots = [0.2, 0.08, -0.08, -0.2];
    this.cards.forEach((v, i) => {
      const asp = this.app.w / this.app.h / (16 / 9);
      const x = xs[i] * Math.min(1.15, Math.max(0.8, asp)) + pr.x * 0.3;
      const y = -3.95 - (i === 0 || i === 3 ? 0.25 : 0) + Math.sin(this.t * 1.1 + i) * 0.08;
      void n;
      v.setTarget(x, y, i * 0.05, rots[i], 1.3);
      v.pointer.set(pr.x, pr.y);
      v.hovered = false;
      v.tiltX = -pr.y * 0.25;
      v.tiltY = pr.x * 0.3;
      v.update(dt, time);
    });
  }

  exit(): void {
    this.hero.removeFromParent();
    this.hero.dispose();
    for (const c of this.cards) c.dispose();
    this.group.removeFromParent();
    this.root.remove();
    this.app.bg.setAstrolabe(0.5, 0.5, 0.4, 0);
  }
}
