import type { CreatureId } from '../../logic/types';
import { WEAPONS, type WeaponId } from '../../logic/weapons';

export const BOSS_IDS = ['lion','hydra','hind','boar','stables','birds','bull','mares','hippolyta','geryon','ladon','cerberus'] as const;
const images = new Map<string, HTMLImageElement>();
const cutouts = new Map<string, HTMLCanvasElement>();
const pending = new Map<string, Promise<void>>();
export const ART_ROOT = '/art/v3/';

async function load(name:string):Promise<void> {
  if(images.has(name)) return;
  let task=pending.get(name);
  if(!task){task=new Promise<void>((resolve,reject)=>{
    const img=new Image();img.onload=()=>{images.set(name,img);resolve();};
    img.onerror=()=>reject(new Error(`Could not load artwork: ${name}`));img.src=`${ART_ROOT}${name}.png`;
  });pending.set(name,task);}
  await task;
}
/** Every entry point awaits its own art dependencies; a missing production asset is visible. */
export async function loadGameArt(progress?:(fraction:number)=>void):Promise<void> {
  const names=[...BOSS_IDS,...WEAPONS.map(w=>`hero-${w.id}`),'ruined-hall','card-illustrations'];
  let done=0;await Promise.all(names.map(async n=>{await load(n);progress?.(++done/names.length);}));
}
export function artImage(name:string):HTMLImageElement {
  const img=images.get(name);if(!img)throw new Error(`Artwork not preloaded: ${name}`);return img;
}
/** Tight alpha bounds remove generator padding without changing the artwork itself. */
export function artCutout(name:string):HTMLCanvasElement {
  const cached=cutouts.get(name);if(cached)return cached;
  const img=artImage(name),cv=document.createElement('canvas');cv.width=img.naturalWidth;cv.height=img.naturalHeight;
  const c=cv.getContext('2d')!;c.drawImage(img,0,0);const data=c.getImageData(0,0,cv.width,cv.height).data;
  let x0=cv.width,y0=cv.height,x1=0,y1=0;
  for(let y=0;y<cv.height;y++)for(let x=0;x<cv.width;x++)if(data[(y*cv.width+x)*4+3]>96){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  if(x1<x0||y1<y0)throw new Error(`Empty sprite: ${name}`);
  const pad=8;x0=Math.max(0,x0-pad);y0=Math.max(0,y0-pad);x1=Math.min(cv.width-1,x1+pad);y1=Math.min(cv.height-1,y1+pad);
  const out=document.createElement('canvas');out.width=x1-x0+1;out.height=y1-y0+1;out.getContext('2d')!.drawImage(img,x0,y0,out.width,out.height,0,0,out.width,out.height);
  cutouts.set(name,out);return out;
}
export function creatureArt(id:CreatureId,weapon:WeaponId='greatsword'):HTMLCanvasElement {return artCutout(id==='heracles'?`hero-${weapon}`:id);}
