import fs from 'node:fs';
const bosses=['lion','hydra','hind','boar','stables','birds','bull','mares','hippolyta','geryon','ladon','cerberus'];
const weapons=['greatsword','bow','swordshield','staff','daggers','axe'];
let bytes=0;
for(const name of [...bosses,...weapons.map(w=>`hero-${w}`),'ruined-hall','card-illustrations']){
  const path=`public/art/v3/${name}.png`,png=fs.readFileSync(path);
  if(png.subarray(1,4).toString()!=='PNG')throw new Error(`Invalid PNG: ${path}`);
  const w=png.readUInt32BE(16),h=png.readUInt32BE(20),color=png[25];
  if(w<900||h<900)throw new Error(`Low resolution: ${path} ${w}x${h}`);
  if(name!=='ruined-hall'&&name!=='card-illustrations'&&color!==6)throw new Error(`Missing alpha channel: ${path}`);
  bytes+=png.length;console.log(`ok ${name}: ${w}x${h}, ${Math.round(png.length/1024)} KB`);
}
console.log(`20 production artworks verified; ${(bytes/1024/1024).toFixed(1)} MB total.`);
