export interface Settings {
  speed: number;
  shake: boolean;
  quality: number;
  tutorialSeen: boolean;
  coachSeen: boolean;
  bestLabors: number;
  wins: number;
  runs: number;
  /** labors encountered (bestiary) */
  seen: string[];
}

const KEY = 'dodek.settings.v1';

const DEFAULTS: Settings = { speed: 1, shake: true, quality: 2, tutorialSeen: false, coachSeen: false, bestLabors: 0, wins: 0, runs: 0, seen: [] };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
