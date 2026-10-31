import * as THREE from 'three';
import type { CreatureId, Element } from '../../logic/types';
import type { ElementPalette } from '../palette';
import { creatureArt, loadGameArt } from '../art/assets';
import type { WeaponId } from '../../logic/weapons';
import { anim } from '../../core/anim';

export type CreatureAttack='strike'|'heavy'|'volley'|'roar'|'drain';
export interface CreatureOptions {detail?:'full'|'preview'}
export const CREATURE_IDS:CreatureId[]=['lion','hydra','hind','boar','stables','birds','bull','mares','hippolyta','geryon','ladon','cerberus','heracles'];
export const CREATURE_NAMES:Record<CreatureId,string>={lion:'The Nemean Lion',hydra:'The Lernaean Hydra',hind:'The Ceryneian Hind',boar:'The Erymanthian Boar',stables:'The Augean Mire',birds:'The Stymphalian Warden',bull:'The Cretan Minotaur',mares:'The Diomedian Nightmare',hippolyta:'Hippolyta',geryon:'Geryon',ladon:'Ladon',cerberus:'Cerberus',heracles:'Eirik the Northbound'};
export async function prewarmCreatures(ids:CreatureId[],_detail?:string):Promise<void>{await loadGameArt();for(const id of ids)creatureArt(id);}
const vert=`
  varying vec2 vUv;
  uniform float uBreath; uniform float uBend; uniform float uHeight;
  void main(){ vUv=uv; vec3 p=position; float weight=uv.y;
    p.x+=uBend*weight*weight; p.y+=uBreath*weight*uHeight;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
  }`;
const frag=`
  varying vec2 vUv; uniform sampler2D map; uniform float uOpacity; uniform float uHurt; uniform float uGuard;
  void main(){vec4 c=texture2D(map,vUv);if(c.a<.015)discard;
    c.rgb=mix(c.rgb,vec3(1.,.76,.58),uHurt*.65);
    c.rgb=mix(c.rgb,c.rgb*vec3(.75,.94,1.15),uGuard*.45);
    gl_FragColor=vec4(c.rgb,c.a*uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

/** New painted sprite renderer. No old silhouette DSL, particles, star maps or fallback models. */
export class IllustratedCreature extends THREE.Group {
  readonly creatureId:CreatureId;readonly attackTarget=new THREE.Vector3();
  private rig=new THREE.Group();private sprite!:THREE.Mesh;private texture!:THREE.CanvasTexture;private material!:THREE.ShaderMaterial;
  private weapon:WeaponId='greatsword';private action=0;private kind:CreatureAttack='strike';private hurt=0;
  private charge=0;private low=0;private dim=0;private guard=0;private intro=1;private dying=0;private disposed=false;private generation=0;
  private height=7; private facing=1;
  constructor(id:CreatureId,_palette:ElementPalette,_element:Element|null,_opts:CreatureOptions={}){
    super();this.creatureId=id;this.facing=id==='heracles'?1:-1;this.add(this.rig);this.build();
  }
  private build():void {
    const source=creatureArt(this.creatureId,this.weapon),ratio=source.width/source.height;
    const hero=this.creatureId==='heracles';const h=hero?7.5:Math.min(7.1,10.8/ratio),w=h*ratio;this.height=h;
    this.texture=new THREE.CanvasTexture(source);this.texture.colorSpace=THREE.SRGBColorSpace;this.texture.anisotropy=4;
    this.material=new THREE.ShaderMaterial({vertexShader:vert,fragmentShader:frag,uniforms:{map:{value:this.texture},uBreath:{value:0},uBend:{value:0},uHeight:{value:h},uOpacity:{value:1},uHurt:{value:0},uGuard:{value:0}},transparent:true,depthWrite:false,depthTest:false,toneMapped:false});
    this.sprite=new THREE.Mesh(new THREE.PlaneGeometry(w,h,10,10),this.material);this.sprite.position.y=-3.2+h/2;this.sprite.renderOrder=20;this.rig.add(this.sprite);
  }
  setWeapon(weapon:WeaponId):void{if(this.creatureId!=='heracles'||this.weapon===weapon)return;this.weapon=weapon;this.release();this.build();}
  private release():void{this.sprite.removeFromParent();this.sprite.geometry.dispose();this.material.dispose();this.texture.dispose();}
  update(dt:number,time:number):void {
    if(this.disposed)return;this.hurt=Math.max(0,this.hurt-dt*3.8);
    const speed=this.kind==='heavy'?1.05:this.creatureId==='heracles'&&this.weapon==='daggers'?2.5:1.65;
    this.action=Math.max(0,this.action-dt*speed);
    const phase=1-this.action,windup=Math.sin(phase*Math.PI*2)*this.action;
    const melee=this.creatureId!=='heracles'||!['bow','staff'].includes(this.weapon);
    this.rig.position.x=this.facing*windup*(melee?.9:.18)+Math.sin(time*64)*this.hurt*.12;
    this.rig.position.y=-this.dying*.55;this.rig.rotation.z=-this.facing*windup*(melee?.045:.012)+this.dying*this.facing*.16;
    const u=this.material.uniforms;
    u.uBreath.value=Math.sin(time*2.1)*.006-this.low*.005;
    u.uBend.value=this.facing*(windup*.2-this.charge*.1);
    u.uOpacity.value=this.intro*(1-this.dying)*(1-this.dim*.87);
    u.uHurt.value=this.hurt;u.uGuard.value=this.guard;
  }
  async playIntro(seconds=1):Promise<void>{const g=++this.generation;this.intro=0;this.dying=0;await anim.tween(seconds,k=>{if(!this.disposed&&g===this.generation)this.intro=k;});}
  async playAttack(kind:CreatureAttack):Promise<void>{if(this.disposed)return;this.kind=kind;this.action=1;await anim.wait(kind==='heavy'?.65:.3);}
  playHurt(strength:number):void{this.hurt=Math.min(1,strength);}
  playGuard(on:boolean):void{this.guard=on?1:0;}
  setCharge(v:number):void{this.charge=v;}
  setLowHp(v:number):void{this.low=v;}
  setDim(v:number,_seconds=0):void{this.dim=v;}
  setPalette(_palette:ElementPalette,_element:Element|null,_seconds=0):void{}
  async playDeath():Promise<void>{const g=++this.generation;await anim.tween(.85,k=>{if(!this.disposed&&g===this.generation)this.dying=k;});}
  getAnchorWorld(name:'core'|'head',target:THREE.Vector3):THREE.Vector3{this.updateWorldMatrix(true,true);return this.rig.localToWorld(target.set(0,-3.2+this.height*(name==='head'?.8:.48),0));}
  get particleCount():number{return 0;}
  dispose():void{this.disposed=true;this.generation++;this.release();this.removeFromParent();}
}
