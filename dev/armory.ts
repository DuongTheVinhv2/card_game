import { paintHero } from '../src/gfx/art/hero2d';
import { WEAPONS } from '../src/logic/weapons';
import { loadGameArt } from '../src/gfx/art/assets';
await loadGameArt();
const root=document.getElementById('armory')!;
for(const w of WEAPONS){
  const panel=document.createElement('article');panel.appendChild(paintHero(w.id));
  const title=document.createElement('h2');title.textContent=w.name;
  const detail=document.createElement('small');detail.textContent=w.desc;
  const play=document.createElement('a');play.href=`/?dev=battle&labor=lion&weapon=${w.id}`;play.textContent='Try this weapon →';
  panel.append(title,detail,play);root.appendChild(panel);
}
