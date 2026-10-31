# DODEKATHLOS - The Labors of Heracles

A turn-based poker roguelite inspired by Balatro and Slay the Spire. Eirik, a Viking far from home, faces twelve ancient Greek trials. Every poker hand attacks a mythic foe, and the foe hits back.

Built with TypeScript, Vite and Three.js. Rendering is now **2D with an orthographic camera**: ink-contoured cutout creatures, a human hero, flat cards and a painted ruined hall. The Northbound art set uses 20 production PNG assets generated with the built-in imagegen tool, stored in `public/art/v3/`. Three.js renders and animates them as transparent 2D cutouts. Music and sound effects remain procedural.

## Run

```sh
npm install
npm run dev
npm run build
npm run preview
npm run typecheck
npm run sim
```

Default development address: http://127.0.0.1:5173/. To use the alternate port: `npm run dev -- --port 5181`. Click or press a key to unlock browser audio.

## A run

Choose one of three random Olympian patrons, then face three randomly selected Labors. Between fights, visit Gifts of the Gods, the Agora shop and a Sanctuary. Defeat the third Labor for Apotheosis or continue into Endless Labors. HP carries between battles. Run progress, settings and bestiary discoveries are saved locally in the browser.

Each turn holds eight cards. Select up to five to play as a poker hand, or discard selected cards to draw replacements. Discarding does not end the turn; one discard regenerates each turn. Damage is based on hand Power, ATK, scoring-card Power and Mult, reduced by enemy DEF. Element weaknesses and resistances change card contributions.

- Fire adds Mult.
- Water heals.
- Wind pierces DEF.
- Earth grants Shield.

The element cycle is Water > Fire > Wind > Earth > Water. Each boss has a unique rule, including Hydra regeneration, Lion armor, Geryon's damage cap and Cerberus revival. Enemy intent is shown before it acts. Boons, scrolls, constellations and card enhancements create builds across the run.

## Human hero and six weapons

The Viking Eirik stands on the left and an entirely redesigned painted boss stands on the right. All twelve bosses, map previews, title and bestiary share the new 2D renderer. The artwork takes inspiration from hand-painted fantasy card games, with original code-authored shapes.

Choose a weapon in the battle dropdown **before the first attack**. Selection locks for that battle and is saved for the next one. Older saves default to the greatsword. These are basic passives, not an active-skill system; values are an initial balance pass.

| Weapon | Stats | Passive |
|---|---|---|
| Greatsword | +4 ATK | +8 Power when playing 5 cards |
| Longbow | +2 ATK | Ignore 20% enemy DEF |
| Sword & shield | +3 DEF | Gain 4 Shield per hand |
| Wanderer's staff | +1 ATK, +1 DEF | Heal 3 per hand |
| Twin daggers | +3 ATK | +1 Mult when playing up to 3 cards |
| Battleaxe | +5 ATK, -1 DEF | +10 Power vs foes at half HP or below |

## Controls

Click cards to select; drag to reorder. Enter plays a hand, X discards, R/E sorts by rank/element, 1-9 selects by position, and Esc opens options. Options include speed, shake, quality and volumes.

## Source layout

- `src/logic/`: pure game rules, hands, elements, battle scoring, weapons, boons, Labors, shop, run state and patrons.
- `src/gfx/`: orthographic Three.js stage, camera, flat cards and combat effects.
- `src/gfx/boss/IllustratedCreature.ts`: painted 2D creature layers and animation. `ConstellationCreature.ts` is a compatibility re-export.
- `public/art/v3/`: 12 new boss sprites, 6 Viking loadouts, a ruined-hall backdrop and a four-panel card illustration atlas. The old anatomical DSL is no longer used by the game renderer.
- `src/gfx/art/assets.ts`: explicit preloading, alpha bounds and shared asset caching. `hero2d.ts` composes Viking loadout previews.
- `src/gfx/background.ts`: full-screen painted ruin texture and combat flash. `src/styles/northbound.css`: slate/iron/leather HUD theme.
- `src/audio/`: procedural Web Audio music and SFX.
- `src/ui/` and `src/styles/`: DOM HUD, tooltips, modals, coach marks and screen styles.
- `src/app/`: application shell and screens.
- `tools/`: balance simulator, poker/equipment tests, screenshots and scripted playtests.
- `dev/`: isolated creature, armory, card and audio previews.

## Development previews

- `/dev/armory.html`: all six human loadouts with links to playable battles.
- `/dev/creatures.html?grid=1`: all twelve bosses and the hero.
- `/dev/cards.html?sheet=cards`: card artwork.
- `/dev/audio.html`: audio lab.
- `/?dev=battle&labor=hydra&el=water&stage=1&weapon=staff`: debug battle. Weapon IDs: `greatsword`, `bow`, `swordshield`, `staff`, `daggers`, `axe`.
- Other debug screens: `map`, `agora`, `spoils`, `sanctuary`, `patron`, `bestiary`, `victory`, `defeat`.

## Validation

```sh
npm run typecheck
npm run build
npx tsx tools/test-hands.ts
npx tsx tools/test-weapons.ts
```

Equipment checks cover stats, passive activation, dry-run safety, preview/actual parity and legacy-save fallback. Browser playtests require Chrome and a running dev server: `node tools/playtest.mjs battle --port 5181`.

## Northbound art production notes

Approved direction: scene 2 in `art-direction/approved-scene-v2.png`. Broad hand-painted color shapes, two/three shadow values, worn iron and leather, dark navy/teal environments and warmer actors. Eirik has a red braided beard, shaved sides, fur shoulders, a blue-grey tunic and iron armor. All six loadouts share that identity. Boss silhouettes and assets were generated anew; none use the old constellation geometry.

All prompts and asset paths are recorded in `art-direction/prompts-v3.json`. Generated originals are copied into the workspace; the game has no dependency on the generator's output folder. The manifest preloads required art before entering a screen, and reports a loading error rather than silently reverting to old models.

Combat animations are sprite-based: idle breathing, directional attack lean/lunge, hurt flash/recoil, guarding tint and intro/death fades. They are not a full frame-by-frame skeletal animation set. Original logical IDs and the save schema remain compatible. Weapon bonuses are unchanged.

Validation: `node tools/check-art.mjs` checks all 20 production PNGs, dimensions and alpha channels. Total uncompressed-on-disk PNG payload is about 29 MB; the first load downloads the set, later loads use the browser cache. `npm run build` copies the artwork into the production output.
