import * as THREE from 'three';
import type { Card } from '../../logic/types';
import { ELEMENT_INFO } from '../../logic/elements';
import { getCardGeometry, getShadowTexture, CARD_H } from './cardGeometry';
import { createFrontMaterial, createBackMaterial, createEdgeMaterial } from './cardMaterials';
import { acquireFaceTexture, releaseFaceTexture, getBackTexture, faceKey, acquireMaskTexture, releaseMaskTexture, maskKey } from './cardTextures';
import { springStepZ, clamp } from '../../core/anim';

const FOIL: Record<string, number> = { divine: 1, olympian: 2, crystal: 3 };
const EDGE: Record<string, string> = {
  none: '#cbb68a', bronze: '#b8743a', gilded: '#f0c75a', marble: '#e9e6e0', divine: '#c9d8ff', olympian: '#ffd98a', crystal: '#bfefff',
};

let backMat: ReturnType<typeof createBackMaterial> | null = null;
function sharedBack() {
  if (!backMat) backMat = createBackMaterial(getBackTexture());
  return backMat;
}

export interface CardTarget {
  x: number;
  y: number;
  z: number;
  rot: number;
  scale: number;
}

/** A flat, spring-animated card; flipping uses a 2D squash and a texture swap. */
export class CardView {
  readonly group = new THREE.Group();
  readonly inner = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly shadow: THREE.Mesh;
  readonly front = createFrontMaterial();
  readonly edge = createEdgeMaterial();
  card: Card;
  private texKey: string | null = null;
  private maskKey: string | null = null;

  // spring state
  pos = new THREE.Vector3();
  vel = new THREE.Vector3();
  rot = 0;
  rotV = 0;
  scl = 1;
  sclV = 0;
  flip = 0;
  flipV = 0;
  tiltX = 0;
  tiltY = 0;
  extraRotY = 0;

  target: CardTarget = { x: 0, y: 0, z: 0, rot: 0, scale: 1 };
  faceUp = true;
  hovered = false;
  selected = false;
  hoverAmt = 0;
  selectAmt = 0;
  highlight = 0;
  flash = 0;
  dim = 0;
  hexAmt = 0;
  hexed = false;
  dissolve = 0;
  /** pointer position in card-local normalized coords (-1..1) while hovered */
  pointer = new THREE.Vector2();
  /** springs off: follow target exactly (used while dragging) */
  stiff = false;
  omega = 15;
  zeta = 0.72;
  private phase = Math.random() * 100;
  visibleShadow = true;

  constructor(card: Card) {
    this.card = card;
    this.mesh = new THREE.Mesh(getCardGeometry(), [this.front, sharedBack(), this.edge]);
    this.mesh.userData.view = this;
    this.shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 1.3 * 1.25),
      new THREE.MeshBasicMaterial({ map: getShadowTexture(), transparent: true, opacity: 0.55, depthWrite: false, color: 0x000000 }),
    );
    this.shadow.renderOrder = -10;
    this.group.add(this.shadow);
    this.group.add(this.inner);
    this.inner.add(this.mesh);
    this.setCard(card);
  }

  setCard(card: Card): void {
    this.card = card;
    const key = faceKey(card);
    if (key !== this.texKey) {
      const { key: k, tex } = acquireFaceTexture(card);
      if (this.texKey) releaseFaceTexture(this.texKey);
      this.texKey = k;
      this.front.uniforms.map.value = tex;
    }
    this.front.uniforms.uFoil.value = FOIL[card.enh] ?? 0;
    const mk = FOIL[card.enh] ? maskKey(card) : null;
    if (mk !== this.maskKey) {
      if (this.maskKey) releaseMaskTexture(this.maskKey);
      this.maskKey = null;
      this.front.uniforms.uMask.value = null;
      this.front.uniforms.uHasMask.value = 0;
      if (mk) {
        const m = acquireMaskTexture(card);
        this.maskKey = m.key;
        this.front.uniforms.uMask.value = m.tex;
        this.front.uniforms.uHasMask.value = 1;
      }
    }
    this.edge.uniforms.uColor.value.set(EDGE[card.enh] ?? EDGE.none);
    this.front.uniforms.uGlow.value.set(ELEMENT_INFO[card.element].glow);
  }

  /** refresh texture after the card data changed (scrolls) */
  refresh(): void {
    this.setCard(this.card);
  }

  snap(): void {
    this.pos.set(this.target.x, this.target.y, this.target.z);
    this.vel.set(0, 0, 0);
    this.rot = this.target.rot;
    this.rotV = 0;
    this.scl = this.target.scale;
    this.sclV = 0;
    this.flip = this.faceUp ? 0 : 1;
    this.flipV = 0;
    this.apply(0, 0);
  }

  setTarget(x: number, y: number, z: number, rot = 0, scale = this.target.scale): void {
    this.target.x = x;
    this.target.y = y;
    this.target.z = z;
    this.target.rot = rot;
    this.target.scale = scale;
  }

  /** scoring pop: scale kick + glow */
  pulse(strength = 1): void {
    this.sclV += 6 * strength;
    this.rotV += (Math.random() - 0.5) * 3 * strength;
    this.highlight = Math.max(this.highlight, 1);
  }

  jiggle(strength = 1): void {
    this.rotV += (Math.random() < 0.5 ? -1 : 1) * 4 * strength;
    this.sclV += 2 * strength;
  }

  update(dt: number, time: number): void {
    const t = this.target;
    if (this.stiff) {
      this.pos.lerp(new THREE.Vector3(t.x, t.y, t.z), 1 - Math.exp(-dt * 30));
      this.vel.set(0, 0, 0);
    } else {
      [this.pos.x, this.vel.x] = springStepZ(this.pos.x, this.vel.x, t.x, this.omega, this.zeta, dt);
      [this.pos.y, this.vel.y] = springStepZ(this.pos.y, this.vel.y, t.y, this.omega, this.zeta, dt);
      [this.pos.z, this.vel.z] = springStepZ(this.pos.z, this.vel.z, t.z, this.omega, 0.9, dt);
    }
    [this.rot, this.rotV] = springStepZ(this.rot, this.rotV, t.rot, 14, 0.6, dt);
    [this.scl, this.sclV] = springStepZ(this.scl, this.sclV, t.scale * (1 + this.hoverAmt * 0.12), 16, 0.55, dt);
    [this.flip, this.flipV] = springStepZ(this.flip, this.flipV, this.faceUp ? 0 : 1, 13, 0.75, dt);

    const k = 1 - Math.exp(-dt * 14);
    this.hoverAmt += ((this.hovered ? 1 : 0) - this.hoverAmt) * k;
    this.selectAmt += ((this.selected ? 1 : 0) - this.selectAmt) * k;
    this.hexAmt += ((this.hexed ? 1 : 0) - this.hexAmt) * (1 - Math.exp(-dt * 5));
    this.highlight *= Math.exp(-dt * 3.2);
    this.flash *= Math.exp(-dt * 9);

    // tilt toward pointer when hovered
    const tx = this.hovered ? -this.pointer.y * 0.32 : 0;
    const ty = this.hovered ? this.pointer.x * 0.38 : 0;
    this.tiltX += (tx - this.tiltX) * (1 - Math.exp(-dt * 12));
    this.tiltY += (ty - this.tiltY) * (1 - Math.exp(-dt * 12));
    this.apply(dt, time);
  }

  private apply(_dt: number, time: number): void {
    const wob = clamp(this.vel.x * 0.035, -0.45, 0.45);
    const wobY = clamp(this.vel.y * 0.03, -0.35, 0.35);
    const idle = Math.sin(time * 1.3 + this.phase) * 0.012 + Math.sin(time * 0.7 + this.phase * 2.1) * 0.008;
    this.group.position.copy(this.pos);
    this.group.rotation.set(0, 0, this.rot - wob * 0.35 + idle);
    this.group.scale.setScalar(Math.max(0.0001, this.scl));
    this.inner.rotation.set(0, 0, 0);
    this.inner.scale.x = Math.max(.035, Math.abs(Math.cos(this.flip * Math.PI)));
    this.mesh.material = this.flip > .5 ? sharedBack() : this.front;

    // fake contact shadow: drifts away as the card lifts
    const lift = Math.max(0, this.pos.z) + this.hoverAmt * 0.3 + this.selectAmt * 0.25;
    this.shadow.visible = this.visibleShadow && this.dissolve < 0.5;
    this.shadow.position.set(0.06 + lift * 0.12, -0.1 - lift * 0.2, -0.06 - lift * 0.35);
    (this.shadow.material as THREE.MeshBasicMaterial).opacity = clamp(0.5 - lift * 0.12, 0.15, 0.5);

    const u = this.front.uniforms;
    u.uTime.value = time;
    u.uHover.value = this.hoverAmt;
    u.uSelect.value = this.selectAmt;
    u.uHighlight.value = this.highlight;
    u.uFlash.value = this.flash;
    u.uHex.value = this.hexAmt;
    u.uDim.value = this.dim;
    u.uDissolve.value = this.dissolve;
    u.uTilt.value.set(this.inner.rotation.y + this.group.rotation.z, this.inner.rotation.x);
    this.edge.uniforms.uDissolve.value = this.dissolve;
  }

  /** world-space height of the card at current scale */
  get height(): number {
    return CARD_H * this.scl;
  }

  dispose(): void {
    if (this.texKey) releaseFaceTexture(this.texKey);
    this.texKey = null;
    if (this.maskKey) releaseMaskTexture(this.maskKey);
    this.maskKey = null;
    this.front.dispose();
    this.edge.dispose();
    (this.shadow.material as THREE.Material).dispose();
    this.shadow.geometry.dispose();
    this.group.removeFromParent();
  }
}
