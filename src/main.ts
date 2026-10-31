import '@fontsource/cinzel/400.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/cinzel/900.css';
import '@fontsource/cinzel-decorative/700.css';
import '@fontsource/cinzel-decorative/900.css';
import '@fontsource/marcellus/400.css';
import './styles/main.css';
import './styles/battle.css';
import './styles/screens.css';
import './styles/northbound.css';
import { App } from './app/App';
import { audio } from './audio/audio';
import { prewarmCreatures, CREATURE_IDS } from './gfx/boss/ConstellationCreature';
import { loadCardFonts, warmCardArt } from './gfx/art/cardPainter';
import { warmFaceTextures } from './gfx/cards/cardTextures';
import { createStandardDeck } from './logic/cards';
import { TitleScreen } from './app/screens/TitleScreen';
import { BattleScreen } from './app/screens/BattleScreen';
import { MapScreen } from './app/screens/MapScreen';
import { AgoraScreen } from './app/screens/AgoraScreen';
import { SpoilsScreen } from './app/screens/SpoilsScreen';
import { SanctuaryScreen } from './app/screens/SanctuaryScreen';
import { EndScreen } from './app/screens/EndScreen';
import { PatronScreen } from './app/screens/PatronScreen';
import { BestiaryScreen } from './app/screens/BestiaryScreen';
import { newRun, addBoon } from './logic/run';
import { choosePatron } from './logic/patrons';
import { rollLaborInstance, type LaborId } from './logic/labors';
import { RNG } from './logic/rng';
import type { Element } from './logic/types';
import type { ScrollId } from './logic/scrolls';
import { weaponDef } from './logic/weapons';
import { loadGameArt } from './gfx/art/assets';

async function boot(): Promise<void> {
  const fill = document.querySelector('.boot-fill') as HTMLElement;
  const set = (p: number) => (fill.style.width = `${p}%`);
  set(8);
  await loadGameArt(p => set(8 + p * 24));
  await loadCardFonts();
  set(30);
  const app = new App();
  (window as unknown as { __app: App; __audio: typeof audio }).__app = app;
  (window as unknown as { __audio: typeof audio }).__audio = audio;
  app.start();
  await warmCardArt({ enhancements: ['none', 'bronze', 'divine'], specials: true });
  set(65);
  let id = 1;
  await warmFaceTextures(createStandardDeck(() => id++), 8);
  set(100);

  const q = new URLSearchParams(location.search);
  const dev = q.get('dev');
  if (dev) {
    const seed = Number(q.get('seed') ?? 1234);
    const run = newRun(seed);
    run.weapon = weaponDef(q.get('weapon')).id;
    choosePatron(run, q.get('patron') ?? 'zeus');
    for (const b of (q.get('boons') ?? '').split(',').filter(Boolean)) addBoon(run, b);
    if (q.get('gold')) run.gold = Number(q.get('gold'));
    for (const sc of (q.get('scrolls') ?? '').split(',').filter(Boolean)) run.consumables.push(sc as ScrollId);
    const labor = q.get('labor') as LaborId | null;
    const stage = Number(q.get('stage') ?? 0);
    if (labor) {
      const el = (q.get('el') ?? run.labors[0].element) as Element;
      run.labors[0] = rollLaborInstance(new RNG(seed), labor, stage, el);
    }
    app.run = run;
    const screens: Record<string, () => unknown> = {
      battle: () => new BattleScreen(app, 0),
      map: () => new MapScreen(app),
      agora: () => new AgoraScreen(app),
      sanctuary: () => new SanctuaryScreen(app),
      spoils: () => new SpoilsScreen(app, { lines: [{ label: 'Labor I completed', amount: 8 }, { label: 'Interest', amount: 1 }], total: 9, heal: 30 }, 30, 0),
      victory: () => new EndScreen(app, 'victory'),
      defeat: () => new EndScreen(app, 'defeat', 'The Nemean Lion'),
      patron: () => new PatronScreen(app),
      bestiary: () => new BestiaryScreen(app),
    };
    const make = screens[dev] ?? (() => new TitleScreen(app));
    await app.go(make() as never, false);
  } else {
    await app.go(new TitleScreen(app), false);
  }
  document.getElementById('boot')!.classList.add('done');
  // sample every constellation in idle slices so maps and battles never hitch on first sight
  void prewarmCreatures(CREATURE_IDS, 'preview').then(() => prewarmCreatures(CREATURE_IDS, 'full'));
}

void boot().catch(error => {
  console.error(error);
  const label = document.querySelector('.boot-sub') ?? document.getElementById('boot');
  if (label) label.textContent = `Artwork could not load. Reload to retry. ${error instanceof Error ? error.message : ''}`;
});
