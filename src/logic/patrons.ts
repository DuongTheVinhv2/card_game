import type { RunState } from './run';
import { addBoon, runRng, saveRng } from './run';
import type { RNG } from './rng';
import { SCROLLS } from './scrolls';
import type { Enhancement } from './types';

export interface PatronDef {
  id: string;
  name: string;
  epithet: string;
  icon: string;
  color: string;
  desc: string;
  apply: (run: RunState, rng: RNG) => void;
}

function enhanceRandom(run: RunState, rng: RNG, n: number, enh: Enhancement): void {
  const plain = run.deck.filter((c) => c.enh === 'none');
  for (const c of rng.sample(plain, n)) c.enh = enh;
}

export const PATRONS: PatronDef[] = [
  {
    id: 'zeus', name: 'Zeus', epithet: 'King of the Gods', icon: 'thunderbolt', color: '#f5c542',
    desc: 'Begin with the Thunderbolt of Zeus (+4 Mult on every hand).',
    apply: (run) => void addBoon(run, 'thunderbolt'),
  },
  {
    id: 'poseidon', name: 'Poseidon', epithet: 'Lord of the Seas', icon: 'trident', color: '#1fa3ff',
    desc: 'Begin with the Trident of Poseidon and +20 max HP.',
    apply: (run) => {
      run.base.maxHp += 20;
      run.hp += 20;
      addBoon(run, 'trident');
    },
  },
  {
    id: 'athena', name: 'Athena', epithet: 'Grey-eyed Strategist', icon: 'owl', color: '#a9c0e6',
    desc: 'Begin with the Owl of Athena (+1 hand size).',
    apply: (run) => void addBoon(run, 'owl'),
  },
  {
    id: 'ares', name: 'Ares', epithet: 'God of War', icon: 'ares', color: '#e0402a',
    desc: '+10 ATK, but −15 max HP.',
    apply: (run) => {
      run.base.atk += 10;
      run.base.maxHp -= 15;
      run.hp = Math.min(run.hp, run.base.maxHp);
    },
  },
  {
    id: 'hera', name: 'Hera', epithet: 'Queen of Olympus', icon: 'peacock', color: '#8d6bff',
    desc: '+40 max HP and +3 DEF.',
    apply: (run) => {
      run.base.maxHp += 40;
      run.hp += 40;
      run.base.def += 3;
    },
  },
  {
    id: 'hephaestus', name: 'Hephaestus', epithet: 'Smith of the Gods', icon: 'hammer', color: '#d0874a',
    desc: '6 random cards in your deck begin forged in Bronze (+15 Power).',
    apply: (run, rng) => enhanceRandom(run, rng, 6, 'bronze'),
  },
  {
    id: 'hermes', name: 'Hermes', epithet: 'Swift Messenger', icon: 'caduceus', color: '#2fd99a',
    desc: '+12 Drachmae and +1 Discard every battle.',
    apply: (run) => {
      run.gold += 12;
      run.base.discards += 1;
      run.base.maxDiscards += 1;
    },
  },
  {
    id: 'apollo', name: 'Apollo', epithet: 'Lord of Light', icon: 'sun', color: '#ffd35a',
    desc: '4 random cards in your deck begin Divine (+4 Mult when scored).',
    apply: (run, rng) => enhanceRandom(run, rng, 4, 'divine'),
  },
  {
    id: 'artemis', name: 'Artemis', epithet: 'Huntress of the Moon', icon: 'artemis', color: '#c9d6ff',
    desc: 'Begin with the Bow of Artemis (×3 Mult on your first hand of each battle).',
    apply: (run) => void addBoon(run, 'artemis'),
  },
  {
    id: 'hades', name: 'Hades', epithet: 'Lord of the Dead', icon: 'bident', color: '#8a5cff',
    desc: 'Begin with the Helm of Hades and the Shears of the Fates.',
    apply: (run) => {
      addBoon(run, 'hades');
      run.consumables.push('fates');
    },
  },
  {
    id: 'demeter', name: 'Demeter', epithet: 'Mother of the Harvest', icon: 'wheat', color: '#c8d65a',
    desc: 'Fully heal after every Labor, and +15 max HP.',
    apply: (run) => {
      run.mods.healAfter = 1;
      run.base.maxHp += 15;
      run.hp += 15;
    },
  },
  {
    id: 'aphrodite', name: 'Aphrodite', epithet: 'Born of Sea Foam', icon: 'dove', color: '#ff8fb1',
    desc: 'Begin with 2 random Scrolls. Everything in the Agora costs 1 less.',
    apply: (run, rng) => {
      run.mods.discount = 1;
      const pool = SCROLLS.filter((s) => s.id !== 'nectar');
      for (const s of rng.sample(pool, 2)) run.consumables.push(s.id);
    },
  },
];

export const PATRON_BY_ID: Record<string, PatronDef> = Object.fromEntries(PATRONS.map((p) => [p.id, p]));

export function offerPatrons(run: RunState, n = 3): PatronDef[] {
  const rng = runRng(run);
  const out = rng.sample(PATRONS, n);
  saveRng(run, rng);
  return out;
}

export function choosePatron(run: RunState, id: string): void {
  const p = PATRON_BY_ID[id];
  if (!p) return;
  const rng = runRng(run);
  run.patron = id;
  p.apply(run, rng);
  saveRng(run, rng);
}
