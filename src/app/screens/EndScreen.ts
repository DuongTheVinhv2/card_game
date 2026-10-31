import * as THREE from 'three';
import type { App } from '../App';
import type { Screen } from '../Screen';
import { h } from '../../ui/dom';
import { audio } from '../../audio/audio';
import { ConstellationCreature } from '../../gfx/boss/ConstellationCreature';
import { HERO_PALETTE } from '../../gfx/palette';
import type { ElementPalette } from '../../gfx/palette';
import { HAND_INFO } from '../../logic/hands';
import { saveRun, effectiveStats } from '../../logic/run';
import { generateEndlessLabor, LABOR_BY_ID } from '../../logic/labors';
import type { LaborId } from '../../logic/labors';
import { runRng, saveRng } from '../../logic/run';
import { anim, formatNum } from '../../core/anim';
import { boonArt } from '../../ui/art';

const DEFEAT_PALETTE: ElementPalette = { core: new THREE.Color('#ffb0b8'), glow: new THREE.Color('#c0203a'), accent: new THREE.Color('#5a0818') };

export class EndScreen implements Screen {
  readonly music: string;
  private app: App;
  private kind: 'victory' | 'defeat';
  private cause: string;
  private root!: HTMLElement;
  private hero: ConstellationCreature | null = null;
  private t = 0;
  private fireworkT = 0;

  constructor(app: App, kind: 'victory' | 'defeat', cause = '') {
    this.app = app;
    this.kind = kind;
    this.cause = cause;
    this.music = kind === 'victory' ? 'victory' : 'defeat';
  }

  async enter(): Promise<void> {
    const app = this.app;
    const run = app.run;
    const s = app.settings;
    const victory = this.kind === 'victory';
    app.bg.setPalette(victory ? HERO_PALETTE : DEFEAT_PALETTE, 2);
    if (run && !run.endless) {
      s.runs++;
      if (victory) s.wins++;
    }
    if (run) s.bestLabors = Math.max(s.bestLabors, run.laborsDefeated);
    app.saveSettings();

    if (victory) {
      this.hero = new ConstellationCreature('heracles', HERO_PALETTE, null, { detail: 'full' });
      this.hero.position.set(0, 3.1, -9);
      this.hero.scale.setScalar(0.95);
      app.stage.scene.add(this.hero);
      void this.hero.playIntro(3);
      audio.play('apotheosis');
    }

    const st = run?.stats;
    const stats = run && st
      ? h('div', { class: 'end-stats' },
          stat('Labors completed', String(run.laborsDefeated)),
          stat('Best hit', `${formatNum(st.bestHit)}${st.bestHitHand ? ` · ${HAND_INFO[st.bestHitHand].name}` : ''}`),
          stat('Hands played', String(st.handsPlayed)),
          stat('Total damage', formatNum(st.damageDealt)),
          stat('Cards discarded', String(st.cardsDiscarded)),
          stat('Drachmae earned', String(st.goldEarned)),
        )
      : null;
    const boons = run ? h('div', { class: 'end-boons' }, ...run.boons.map((b) => h('img', { attrs: { src: boonArt(b.id) } }))) : null;

    const canEndless = victory && run;
    this.root = h('div', { class: `screen end ${victory ? 'win' : 'lose'}` },
      h('div', { class: 'end-wrap rise-in' },
        h('div', { class: 'label', style: 'text-align:center', text: victory ? 'The gods are pleased' : this.cause === 'Abandoned' ? 'The labors were abandoned' : `Fallen to ${this.cause}` }),
        h('div', { class: `end-title ${victory ? 'title-gold' : 'title-red'}`, text: victory ? 'APOTHEOSIS' : 'DEFEAT' }),
        h('div', { class: 'end-sub', text: victory ? 'Eirik has overcome the ancient trials. The road north awaits.' : 'Even the northborn fall. The trials await another dawn.' }),
        h('div', { class: 'meander', style: 'margin:1rem auto;width:60%' }),
        stats,
        boons,
        h('div', { class: 'actions', style: 'display:flex;gap:.8rem;justify-content:center;margin-top:1.6rem' },
          canEndless ? h('button', { class: 'btn blue', html: 'Endless Labors<span class="sub">face the remaining labors</span>', on: { click: () => this.endless() } }) : null,
          h('button', { class: 'btn', text: 'New Run', on: { click: () => this.newRun() } }),
          h('button', { class: 'btn dark', text: 'Title', on: { click: () => this.title() } }),
        ),
      ),
    );
    app.ui.appendChild(this.root);
    // the run is over unless the player chooses Endless (which re-saves)
    saveRun(null);
    await anim.wait(0.1);
  }

  private endless(): void {
    const app = this.app;
    const run = app.run!;
    audio.play('button');
    run.endless = true;
    const rng = runRng(run);
    const faced = run.labors.map((l) => l.id) as LaborId[];
    const stage = run.labors.length;
    const inst = generateEndlessLabor(rng, faced, stage);
    saveRng(run, rng);
    run.labors.push(inst);
    const apo = run.nodes.length - 1;
    run.nodes.splice(apo, 0, { kind: 'spoils' }, { kind: 'agora' }, { kind: 'sanctuary' }, { kind: 'labor', labor: run.labors.length - 1 });
    // we are on the apotheosis node; step back so the new spoils node is current
    run.nodeIndex = apo;
    void LABOR_BY_ID;
    void effectiveStats;
    app.persist();
    void import('./MapScreen').then(({ MapScreen }) => app.go(new MapScreen(app)));
  }

  private newRun(): void {
    audio.play('button');
    saveRun(null);
    this.app.run = null;
    void import('./TitleScreen').then(({ TitleScreen }) => this.app.go(new TitleScreen(this.app, true)));
  }

  private title(): void {
    audio.play('button');
    if (this.kind === 'defeat') {
      saveRun(null);
      this.app.run = null;
    }
    void import('./TitleScreen').then(({ TitleScreen }) => this.app.go(new TitleScreen(this.app)));
  }

  exit(): void {
    this.root.remove();
    this.hero?.removeFromParent();
    this.hero?.dispose();
  }

  update(dt: number, time: number): void {
    this.t += dt;
    this.hero?.update(dt, time);
    if (this.kind === 'victory') {
      this.fireworkT -= dt;
      if (this.fireworkT <= 0) {
        this.fireworkT = 0.5 + Math.random() * 0.7;
        const p = new THREE.Vector3((Math.random() < 0.5 ? -1 : 1) * (7 + Math.random() * 8), 0.5 + Math.random() * 6, -5 - Math.random() * 5);
        const cols = [['#ffe2a0', '#ffc861', '#ffffff'], ['#9fe9ff', '#ffffff'], ['#ffb0c0', '#ffe2a0'], ['#c9ffe6', '#ffffff']][Math.floor(Math.random() * 4)];
        this.app.fx.firework(p, cols, 150);
        audio.play('coin', { pitch: 0.5 + Math.random() * 0.4, volume: 0.25 });
      }
    }
  }
}

function stat(k: string, v: string): HTMLElement {
  return h('div', { class: 'end-stat' }, h('div', { class: 'label', text: k }), h('div', { class: 'v', text: v }));
}
