import * as THREE from 'three';
import type { ElementPalette } from './palette';
import { artImage } from './art/assets';

/** Full-screen painted 2D stage shared by every screen. */
export class Background {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private pulse = 0;
  constructor() {
    const texture = new THREE.Texture(artImage('ruined-hall')); texture.needsUpdate = true; texture.colorSpace = THREE.SRGBColorSpace;
    this.material = new THREE.ShaderMaterial({
      uniforms: { map: { value: texture }, flashColor: { value: new THREE.Color() }, flashAmount: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy, .99999, 1.); }',
      fragmentShader: 'uniform sampler2D map; uniform vec3 flashColor; uniform float flashAmount; varying vec2 vUv; void main(){ vec4 c=texture2D(map,vUv); gl_FragColor=vec4(mix(c.rgb,flashColor,flashAmount),1.); }',
      depthWrite: false, depthTest: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2,2), this.material);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = -1000;
  }
  setPalette(_p: ElementPalette | null, _seconds=0): void {}
  setAstrolabe(_x:number,_y:number,_radius:number,_alpha:number):void {}
  flash(color:THREE.ColorRepresentation,strength=.35):void { this.material.uniforms.flashColor.value.set(color); this.pulse=Math.max(this.pulse,strength); }
  update(dt:number,_time:number,_w:number,_h:number,_parallax:THREE.Vector2):void { this.pulse*=Math.exp(-dt*5); this.material.uniforms.flashAmount.value=this.pulse; }
}
