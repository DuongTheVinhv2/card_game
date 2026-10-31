import * as THREE from 'three';
import type { FlatCamera } from './stage';

/** Owns camera motion: parallax, trauma shake, zoom kicks. Layout math uses the un-shaken base. */
export class CameraRig {
  readonly camera: FlatCamera;
  readonly base = new THREE.Vector3(0, 0, 20);
  /** extra offset for cinematic moves (tweened by screens) */
  readonly offset = new THREE.Vector3();
  readonly lookOffset = new THREE.Vector3();
  trauma = 0;
  shakeEnabled = true;
  private kick = 0;
  private kickV = 0;
  readonly mouse = new THREE.Vector2();
  readonly parallax = new THREE.Vector2();
  parallaxStrength = 0;
  private t = 0;

  constructor(camera: FlatCamera) {
    this.camera = camera;
    camera.position.copy(this.base);
  }

  /** add trauma 0..1 (shake intensity is trauma²) */
  shake(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  /** quick zoom punch toward the scene (positive) */
  punch(amount: number): void {
    this.kickV += amount * 30;
  }

  update(dt: number): void {
    this.t += dt;
    // smooth parallax toward mouse
    const k = 1 - Math.exp(-dt * 3);
    this.parallax.x += (this.mouse.x - this.parallax.x) * k;
    this.parallax.y += (this.mouse.y - this.parallax.y) * k;

    // damped zoom kick spring
    this.kickV += (-this.kick * 180 - this.kickV * 16) * dt;
    this.kick += this.kickV * dt;

    const s = this.shakeEnabled ? this.trauma * this.trauma : 0;
    const n = (f: number, o: number) =>
      Math.sin(this.t * f + o) * 0.6 + Math.sin(this.t * f * 2.13 + o * 1.7) * 0.4;
    const sx = s * 0.55 * n(37, 1.1);
    const sy = s * 0.45 * n(41, 4.2);
    const rz = s * 0.035 * n(29, 7.7);
    this.trauma = Math.max(0, this.trauma - dt * 1.6);

    const p = this.parallaxStrength;
    this.camera.position.set(
      this.base.x + this.offset.x + this.parallax.x * 0.45 * p + sx,
      this.base.y + this.offset.y + this.parallax.y * 0.3 * p + sy,
      this.base.z + this.offset.z - this.kick,
    );
    // Pan and shake only. A 2D camera never pitches/yaws into the illustrations.
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateZ(rz);
  }

  /** half extents of the view at plane z for the un-shaken base camera */
  halfExtents(z: number): { hw: number; hh: number } {
    const hh = this.camera.top / this.camera.zoom;
    return { hw: hh * this.camera.aspect, hh };
  }

  /** world point on plane z under the given screen pixel */
  screenToWorld(px: number, py: number, w: number, h: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
    const { hw, hh } = this.halfExtents(z);
    const nx = (px / w) * 2 - 1;
    const ny = -((py / h) * 2 - 1);
    return out.set(this.base.x + nx * hw, this.base.y + ny * hh, z);
  }

  /** screen pixel of a world point (using the live camera) */
  worldToScreen(p: THREE.Vector3, w: number, h: number, out = new THREE.Vector2()): THREE.Vector2 {
    const v = p.clone().project(this.camera);
    return out.set((v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h);
  }

  /** world units per css pixel at plane z */
  unitsPerPixel(z: number, h: number): number {
    return (this.halfExtents(z).hh * 2) / h;
  }
}
