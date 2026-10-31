import type { CreatureId } from '../../../logic/types';
import type { CreatureDef } from '../rig';
import { buildLion } from './lion';

/**
 * Creature registry.
 *
 * Every module in this folder that exports
 *   `export const CREATURE: CreatureModule = { id: '<CreatureId>', build: () => CreatureDef }`
 * is registered automatically (Vite `import.meta.glob`), so adding a creature never requires editing this file.
 */
export interface CreatureModule {
  id: CreatureId;
  build: () => CreatureDef;
}

/** explicit registrations (take precedence over auto-registered modules) */
const EXPLICIT: Partial<Record<CreatureId, () => CreatureDef>> = {
  lion: buildLion,
};

const BUILDERS: Partial<Record<CreatureId, () => CreatureDef>> = {};

const modules = import.meta.glob<{ CREATURE?: CreatureModule }>(['./*.ts', '!./index.ts'], { eager: true });
for (const [path, mod] of Object.entries(modules)) {
  const c = mod.CREATURE;
  if (!c) continue;
  if (!c.id || typeof c.build !== 'function') {
    console.warn(`[creatures] ${path}: CREATURE export must be { id, build }`);
    continue;
  }
  BUILDERS[c.id] = c.build;
}
Object.assign(BUILDERS, EXPLICIT);

const cache = new Map<CreatureId, CreatureDef>();
const warned = new Set<CreatureId>();

/** true when a dedicated definition exists for the id (otherwise getCreatureDef falls back to the lion) */
export function hasCreatureDef(id: CreatureId): boolean {
  return !!BUILDERS[id];
}

export function getCreatureDef(id: CreatureId): CreatureDef {
  let d = cache.get(id);
  if (!d) {
    const b = BUILDERS[id];
    if (!b && !warned.has(id)) {
      warned.add(id);
      console.warn(`[creatures] no definition for '${id}' yet — using the lion as a placeholder`);
    }
    d = (b ?? buildLion)();
    if (d.id !== id) d = { ...d, id };
    cache.set(id, d);
  }
  return d;
}
