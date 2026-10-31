/** Northbound art set: painted illustrations inside carved iron and parchment frames. */
import { RANK_LABEL, type Element, type Enhancement, type Rank, type HandType } from '../../logic/types';
import { iconPathAt, type IconName } from './icons';
import { loadCardFonts as loadFonts } from './fonts';
import { artImage, artCutout, loadGameArt } from './assets';
export const CARD_TEX_W=440, CARD_TEX_H=616;
const W=440,H=616;
type Ctx=CanvasRenderingContext2D;
const ELEMENT:Record<Element,{name:string;ink:string;light:string;panel:number}>={
  fire:{name:'EMBER',ink:'#a95536',light:'#e6b36c',panel:0},
  water:{name:'TIDE',ink:'#477c9b',light:'#a5cfdb',panel:1},
  wind:{name:'GALE',ink:'#547f70',light:'#b1c4a1',panel:2},
  earth:{name:'STONE',ink:'#967347',light:'#d5bc7f',panel:3},
};
const ENH:Record<Enhancement,string>={none:'#8e8c7e',bronze:'#bd8050',divine:'#aabfd7',olympian:'#e1be77',gilded:'#d7a34b',marble:'#d6d0bf',crystal:'#8ac9ce'};
const RUNE='M-13 -20 L-13 20 M-13 -20 L13 -4 -13 7 M13 -4 L13 20';
function rect(c:Ctx,x:number,y:number,w:number,h:number,r=8){c.beginPath();c.roundRect(x,y,w,h,r);}
function fill(c:Ctx,x:number,y:number,w:number,h:number,color:string,r=8){rect(c,x,y,w,h,r);c.fillStyle=color;c.fill();}
function text(c:Ctx,s:string,x:number,y:number,size:number,color:string,align:CanvasTextAlign='center'){
  c.font=`700 ${size}px Cinzel, Georgia, serif`;c.textAlign=align;c.textBaseline='middle';c.fillStyle=color;c.fillText(s,x,y);
}
function wrap(c:Ctx,s:string,x:number,y:number,max:number,size=23){
  c.font=`700 ${size}px Cinzel,Georgia,serif`;const words=s.split(' ');let line='',row=0;
  for(const word of words){const test=line?line+' '+word:word;if(c.measureText(test).width>max&&line){text(c,line,x,y+row*30,size,'#e5d8b7');line=word;row++;}else line=test;}
  text(c,line,x,y+row*30,size,'#e5d8b7');
}
function frame(c:Ctx,accent:string){
  c.clearRect(0,0,W,H);c.lineJoin='round';
  fill(c,0,0,W,H,'#101d26',25);fill(c,9,9,W-18,H-18,accent,19);fill(c,17,17,W-34,H-34,'#24343c',14);
  c.strokeStyle='#080f15';c.lineWidth=4;rect(c,17,17,W-34,H-34,14);c.stroke();
  c.strokeStyle='#ffffff18';c.lineWidth=2;c.beginPath();c.moveTo(27,46);c.lineTo(27,28);c.lineTo(410,28);c.stroke();
  for(const [x,y] of [[28,28],[412,28],[28,588],[412,588]]){c.fillStyle='#101a20';c.beginPath();c.arc(x,y,5,0,Math.PI*2);c.fill();c.fillStyle=accent;c.fillRect(x-2,y-2,3,3);}
}
function panel(c:Ctx,index:number,x=35,y=128,w=370,h=365){
  const atlas=artImage('card-illustrations'),sw=atlas.naturalWidth/2,sh=atlas.naturalHeight/2;
  c.save();rect(c,x,y,w,h,8);c.clip();
  const sx=(index%2)*sw,sy=Math.floor(index/2)*sh;
  // Crop the centered square illustration rather than stretch the painted object.
  const side=Math.min(sw,sh);c.drawImage(atlas,sx+(sw-side)/2,sy+(sh-side)/2,side,side,x,y,w,h);c.restore();
  c.strokeStyle='#0e1920';c.lineWidth=5;rect(c,x,y,w,h,8);c.stroke();
}
function emblem(c:Ctx,name:IconName,x:number,y:number,size:number,color:string){
  const p=iconPathAt(name,x,y,size);c.save();c.translate(3,5);c.fillStyle='#081218aa';c.fill(p);c.restore();c.fillStyle=color;c.fill(p);
}
export async function loadCardFonts():Promise<void>{await loadFonts();await loadGameArt();}
export function paintCardFace(c:Ctx,s:{rank:Rank;element:Element;enh:Enhancement;power:number}):void{
  c.save();c.setTransform(1,0,0,1,0,0);const a=ELEMENT[s.element];frame(c,ENH[s.enh]);
  fill(c,28,30,384,83,'#dbd0b5',8);
  text(c,RANK_LABEL[s.rank],51,76,68,'#263840','left');emblem(c,s.element,338,45,52,a.ink);
  text(c,a.name,244,75,20,a.ink);
  panel(c,a.panel);
  if(s.rank>=11){
    const id=s.rank===12?'hippolyta':s.rank===13?'geryon':s.rank===14?({fire:'lion',water:'hydra',wind:'birds',earth:'bull'} as const)[s.element]:'hero-greatsword';
    const img=artCutout(id);c.save();rect(c,38,131,364,359,6);c.clip();c.fillStyle='#11232ddb';c.fillRect(38,131,364,359);
    const scale=Math.min(344/img.width,345/img.height),w=img.width*scale,h=img.height*scale;c.drawImage(img,(W-w)/2,485-h,w,h);c.restore();
  }
  fill(c,29,509,382,77,'#152630',8);emblem(c,'power',49,529,35,a.light);
  text(c,String(s.power),114,551,31,'#f0dfb9');text(c,s.enh==='none'?'NORTHBOUND':s.enh.toUpperCase(),263,552,16,a.light);
  // Large upright rank and suit remain visible when the cards overlap in a hand.
  text(c,RANK_LABEL[s.rank],65,157,36,'#f3e9d1');emblem(c,s.element,48,179,34,a.light);
  if(s.enh!=='none'){c.strokeStyle=ENH[s.enh];c.lineWidth=5;rect(c,24,24,392,568,10);c.stroke();}
  c.restore();
}
export function paintCardFoilMask(c:Ctx,_s:{rank:Rank;element:Element;enh?:Enhancement}):void{c.clearRect(0,0,W,H);c.fillStyle='#fff';c.fillRect(10,10,15,H-20);c.fillRect(W-25,10,15,H-20);}
export function paintCardBack(c:Ctx):void{
  c.save();frame(c,'#817d6d');fill(c,34,35,372,546,'#1b343f',12);
  c.strokeStyle='#56717a';c.lineWidth=3;rect(c,48,49,344,518,6);c.stroke();
  // New knotwork of crossing angular bands, independent of the old celestial card back.
  c.strokeStyle='#a99b75';c.lineWidth=12;
  for(const mirror of [-1,1]){c.save();c.translate(220,308);c.scale(mirror,1);c.beginPath();c.moveTo(0,-190);c.lineTo(115,-76);c.lineTo(0,72);c.lineTo(96,170);c.lineTo(0,230);c.lineTo(-96,170);c.lineTo(0,72);c.lineTo(-115,-76);c.closePath();c.stroke();c.restore();}
  fill(c,166,248,108,120,'#1b3039',6);c.save();c.translate(220,308);c.strokeStyle='#dfc89b';c.lineWidth=8;c.lineCap='square';c.stroke(new Path2D(RUNE));c.restore();
  text(c,'NORTHBOUND',220,526,19,'#d0bd94');c.restore();
}
function relic(c:Ctx,name:string,icon:IconName,accent:string,tag:string,seed=0){
  frame(c,accent);panel(c,seed%4,35,72,370,385);
  c.fillStyle='#10212b99';c.fillRect(39,76,362,377);
  // Carved stone medallion and simple bronze inlay: matching the new painted materials.
  fill(c,105,161,230,230,'#273a42',25);c.strokeStyle=accent;c.lineWidth=7;rect(c,105,161,230,230,25);c.stroke();
  emblem(c,icon,139,195,162,'#decb9f');text(c,tag,220,47,17,'#d4c39f');
  wrap(c,name,220,497,340,24);text(c,'THE NORTHBOUND',220,579,13,accent);
}
export function paintBoonCard(c:Ctx,s:{id:string;name:string;rarity:'common'|'rare'|'legendary';icon:IconName}):void{
  c.save();const color={common:'#84948f',rare:'#82aab4',legendary:'#caa56b'}[s.rarity];relic(c,s.name,s.icon,color,s.rarity.toUpperCase()+' RELIC',hash(s.id));c.restore();
}
export function paintScrollCard(c:Ctx,s:{id:string;name:string;icon:IconName;tint?:string}):void{c.save();relic(c,s.name,s.icon,s.tint??'#b39d77','RUNIC SCROLL',hash(s.id));c.restore();}
export function paintPatronCard(c:Ctx,s:{id:string;name:string;epithet:string;icon:IconName;color:string}):void{c.save();relic(c,s.name,s.icon,s.color,'ANCIENT PATRON',hash(s.id));text(c,s.epithet.slice(0,31),220,553,13,'#b6bcae');c.restore();}
export function paintConstellationCard(c:Ctx,s:{hand:HandType;constellation:string;handName:string}):void{c.save();relic(c,s.handName,'star','#9ba8b7','FATE SIGIL',hash(s.hand));text(c,s.constellation,220,550,15,'#bec9c6');c.restore();}
function hash(s:string):number{return [...s].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0);}
export async function warmCardArt(_opts:{enhancements?:Enhancement[];specials?:boolean}={}):Promise<void>{await loadCardFonts();}
