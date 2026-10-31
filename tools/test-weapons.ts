import { newRun, effectiveStats } from '../src/logic/run';
import { createBattle, playHand } from '../src/logic/battle';
import { WEAPONS, weaponDef } from '../src/logic/weapons';
import type { Card, Rank } from '../src/logic/types';
function check(ok: unknown, message: string): void { if(!ok) throw new Error(message); }
const ranks: Rank[]=[2,4,6,8,10];
for(const w of WEAPONS){
  const run=newRun(1234);run.weapon=w.id;run.hp=50;
  const stats=effectiveStats(run);check(stats.atk===10+w.atk,`${w.id}: ATK`);check(stats.def===Math.max(0,4+w.def),`${w.id}: DEF`);
  const b=createBattle(run,0);b.boss.hp=Math.floor(b.boss.maxHp/2);
  b.hand=ranks.map((rank,i):Card=>({id:i+1,rank,element:'water',enh:'none'}));
  const before=JSON.stringify(run),rng=b.rng.s;
  const n=w.id==='daggers'?3:5,ids=b.hand.slice(0,n).map(c=>c.id);
  const preview=playHand(b,ids,true);check(JSON.stringify(run)===before&&b.rng.s===rng,`${w.id}: dry run mutated state`);
  if(w.id==='bow')check(preview.pierce>=.2,'bow: pierce');
  else check(preview.steps.some(s=>s.text?.startsWith(w.id==='swordshield'?'Shield':w.id==='staff'?'Staff':w.id==='daggers'?'Daggers':w.id==='axe'?'Battleaxe':'Greatsword')),`${w.id}: missing passive`);
  const actual=playHand(b,ids);check(preview.damage===actual.damage&&preview.heal===actual.heal&&preview.shield===actual.shield,`${w.id}: preview mismatch`);
  console.log(`ok ${w.name}: stats, passive, dry-run safety, preview/actual parity`);
}
check(weaponDef(undefined).id==='greatsword','legacy save fallback');check(weaponDef('invalid').id==='greatsword','invalid weapon fallback');
console.log('All equipment checks passed.');
