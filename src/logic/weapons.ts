export const WEAPONS = [
  { id: 'greatsword', name: 'Greatsword', atk: 4, def: 0, desc: '+4 ATK · +8 Power with 5 cards' },
  { id: 'bow', name: 'Longbow', atk: 2, def: 0, desc: '+2 ATK · ignore 20% DEF' },
  { id: 'swordshield', name: 'Sword & shield', atk: 0, def: 3, desc: '+3 DEF · gain 4 Shield per hand' },
  { id: 'staff', name: 'Wanderer’s staff', atk: 1, def: 1, desc: '+1 ATK / DEF · heal 3 per hand' },
  { id: 'daggers', name: 'Twin daggers', atk: 3, def: 0, desc: '+3 ATK · +1 Mult with 1–3 cards' },
  { id: 'axe', name: 'Battleaxe', atk: 5, def: -1, desc: '+5 ATK / −1 DEF · +10 Power vs wounded foes' },
] as const;
export type WeaponId = typeof WEAPONS[number]['id'];
export function weaponDef(id: unknown) { return WEAPONS.find(w => w.id === id) ?? WEAPONS[0]; }
