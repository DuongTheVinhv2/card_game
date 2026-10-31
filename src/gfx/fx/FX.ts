import * as THREE from 'three';
import type { Element } from '../../logic/types';
import { ParticleSystem, Shape } from './Particles';

export const ELEMENT_FX: Record<Element, { colors: string[]; end: string; ring: string; flash: string }> = {
  fire: { colors: ['#ffc06a', '#ff7a2a', '#ff4a12'], end: '#a01800', ring: '#ff7a2a', flash: '#ffd59a' },
  water: { colors: ['#9fe9ff', '#3ab4ff', '#e8fbff'], end: '#1050c0', ring: '#5fd0ff', flash: '#d8f6ff' },
  wind: { colors: ['#d4fff0', '#3fe6a8', '#ffffff'], end: '#0a8f6a', ring: '#7ff5c8', flash: '#eafff7' },
  earth: { colors: ['#ffe0a0', '#e3a548', '#b0702a'], end: '#5a3510', ring: '#ffc66a', flash: '#fff0cf' },
};

const ringFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uWidth;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float d = length(p);
  float r = d - 0.8;
  float a = exp(-r * r / (uWidth * uWidth)) + exp(-r * r / (uWidth * uWidth * 9.0)) * 0.25;
  a *= 1.0 - smoothstep(0.96, 1.0, d);
  gl_FragColor = vec4(uColor * a * uAlpha, 1.0);
}`;

const slashFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
uniform float uProg;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float d = length(p);
  float ang = atan(p.y, p.x);
  float t = (ang + 1.35) / 2.7;
  if (t < 0.0 || t > 1.0) discard;
  float thick = 0.13 * sin(t * 3.14159) + 0.005;
  float r = abs(d - 0.72);
  float a = smoothstep(thick, thick * 0.2, r);
  float head = uProg;
  a *= smoothstep(head + 0.02, head - 0.1, t) * smoothstep(head - 0.75, head - 0.2, t);
  a += exp(-r * r * 4000.0) * 0.6 * step(t, head);
  gl_FragColor = vec4(uColor * a * uAlpha, 1.0);
}`;

const quadVert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

interface RingFx {
  mesh: THREE.Mesh;
  t: number;
  dur: number;
  s0: number;
  s1: number;
  a0: number;
  active: boolean;
}

interface SlashFx {
  mesh: THREE.Mesh;
  t: number;
  dur: number;
  active: boolean;
}

interface Projectile {
  p0: THREE.Vector3;
  p1: THREE.Vector3;
  p2: THREE.Vector3;
  t: number;
  dur: number;
  colors: string[];
  end: string;
  size: number;
  resolve: () => void;
  emitAcc: number;
}

const _v = new THREE.Vector3();

export class FX {
  readonly root = new THREE.Group();
  readonly add = new ParticleSystem(10000, false);
  readonly norm = new ParticleSystem(3000, true);
  private rings: RingFx[] = [];
  private slashes: SlashFx[] = [];
  private projectiles: Projectile[] = [];
  private motes: THREE.Points;
  private moteMat: THREE.ShaderMaterial;
  intensityScale = 1;

  constructor() {
    this.root.add(this.norm.points, this.add.points);
    for (let i = 0; i < 14; i++) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: quadVert,
        fragmentShader: ringFrag,
        uniforms: { uColor: { value: new THREE.Color() }, uAlpha: { value: 0 }, uWidth: { value: 0.05 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      mesh.visible = false;
      mesh.renderOrder = 11;
      this.root.add(mesh);
      this.rings.push({ mesh, t: 0, dur: 1, s0: 0, s1: 1, a0: 1, active: false });
    }
    for (let i = 0; i < 8; i++) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: quadVert,
        fragmentShader: slashFrag,
        uniforms: { uColor: { value: new THREE.Color() }, uAlpha: { value: 0 }, uProg: { value: 0 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      mesh.visible = false;
      mesh.renderOrder = 12;
      this.root.add(mesh);
      this.slashes.push({ mesh, t: 0, dur: 0.4, active: false });
    }
    // ambient bokeh motes drifting in front of everything
    const N = 260;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 24;
      pos[i * 3 + 2] = -12 + Math.random() * 18;
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.moteMat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uScale: { value: 500 }, uColor: { value: new THREE.Color('#ffd9a0') } },
      vertexShader: /* glsl */ `
        attribute float aSeed;
        uniform float uTime;
        uniform float uScale;
        varying float vA;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.07 + aSeed * 40.0) * 1.5 + uTime * 0.12 * (aSeed - 0.3);
          p.y += sin(uTime * 0.11 + aSeed * 17.0) * 1.0 + uTime * 0.05;
          p.x = mod(p.x + 20.0, 40.0) - 20.0;
          p.y = mod(p.y + 12.0, 24.0) - 12.0;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float depthBlur = clamp((p.z + 2.0) / 8.0, 0.0, 1.0);
          gl_PointSize = (0.05 + depthBlur * 0.35 + aSeed * 0.06) * uScale / max(0.5, -mv.z);
          vA = (0.35 + 0.65 * sin(uTime * (0.4 + aSeed) + aSeed * 30.0) * 0.5 + 0.5) * (0.25 + (1.0 - depthBlur) * 0.6) * 0.5;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vA;
        void main() {
          float d = length(gl_PointCoord * 2.0 - 1.0);
          float a = smoothstep(1.0, 0.3, d) * vA;
          gl_FragColor = vec4(uColor * a, 1.0);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.motes = new THREE.Points(g, this.moteMat);
    this.motes.frustumCulled = false;
    this.motes.renderOrder = 20;
    this.root.add(this.motes);
  }

  setViewport(heightPx: number, fovDeg: number): void {
    this.add.setViewport(heightPx, fovDeg);
    this.norm.setViewport(heightPx, fovDeg);
    this.moteMat.uniforms.uScale.value = (heightPx * 0.5) / Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2);
  }

  setMoteColor(c: THREE.ColorRepresentation): void {
    (this.moteMat.uniforms.uColor.value as THREE.Color).set(c);
  }

  update(dt: number, time: number): void {
    this.moteMat.uniforms.uTime.value = time;
    for (const p of this.projectiles.slice()) {
      p.t += dt / p.dur;
      const t = Math.min(1, p.t);
      const head = bezier(p.p0, p.p1, p.p2, t, _v);
      p.emitAcc += dt * 140;
      const n = Math.floor(p.emitAcc);
      p.emitAcc -= n;
      if (n > 0) {
        this.add.emit({ pos: head, count: n, spread: 0.08 * p.size, speed: [0.2, 1.2], life: [0.25, 0.5], size: [0.18 * p.size, 0.42 * p.size], sizeEnd: 0.1, color: p.colors, colorEnd: p.end, intensity: 2.6, drag: 3 });
        this.add.emit({ pos: head, count: Math.max(1, n >> 2), spread: 0.04, speed: [0.5, 2.5], life: [0.3, 0.6], size: [0.06, 0.12], color: '#ffffff', intensity: 3, shape: Shape.Spark, drag: 2 });
      }
      this.add.emit({ pos: head, count: 1, speed: [0, 0], life: [0.06, 0.06], size: [0.9 * p.size, 0.9 * p.size], sizeEnd: 1, color: p.colors[0], intensity: 3.2 });
      if (p.t >= 1) {
        this.projectiles.splice(this.projectiles.indexOf(p), 1);
        p.resolve();
      }
    }
    this.add.update(dt);
    this.norm.update(dt);
    for (const r of this.rings) {
      if (!r.active) continue;
      r.t += dt;
      const k = Math.min(1, r.t / r.dur);
      const e = 1 - Math.pow(1 - k, 3);
      const s = r.s0 + (r.s1 - r.s0) * e;
      r.mesh.scale.set(s, s, s);
      (r.mesh.material as THREE.ShaderMaterial).uniforms.uAlpha.value = r.a0 * (1 - k) * (1 - k);
      if (k >= 1) {
        r.active = false;
        r.mesh.visible = false;
      }
    }
    for (const sl of this.slashes) {
      if (!sl.active) continue;
      sl.t += dt;
      const k = Math.min(1, sl.t / sl.dur);
      const u = (sl.mesh.material as THREE.ShaderMaterial).uniforms;
      u.uProg.value = k * 1.4;
      u.uAlpha.value = 2.5 * (1 - Math.max(0, k - 0.6) / 0.4);
      if (k >= 1) {
        sl.active = false;
        sl.mesh.visible = false;
      }
    }
  }

  ring(pos: THREE.Vector3, color: THREE.ColorRepresentation, size = 4, dur = 0.6, width = 0.05, alpha = 2.2, startScale = 0.2): void {
    const r = this.rings.find((x) => !x.active) ?? this.rings[0];
    r.active = true;
    r.t = 0;
    r.dur = dur;
    r.s0 = startScale;
    r.s1 = size;
    r.a0 = alpha;
    r.mesh.visible = true;
    r.mesh.position.copy(pos);
    r.mesh.scale.setScalar(startScale);
    const u = (r.mesh.material as THREE.ShaderMaterial).uniforms;
    (u.uColor.value as THREE.Color).set(color);
    u.uWidth.value = width;
  }

  slash(pos: THREE.Vector3, angle: number, color: THREE.ColorRepresentation, size = 4, dur = 0.35): void {
    const s = this.slashes.find((x) => !x.active) ?? this.slashes[0];
    s.active = true;
    s.t = 0;
    s.dur = dur;
    s.mesh.visible = true;
    s.mesh.position.copy(pos);
    s.mesh.rotation.set(0, 0, angle);
    s.mesh.scale.setScalar(size);
    ((s.mesh.material as THREE.ShaderMaterial).uniforms.uColor.value as THREE.Color).set(color);
  }

  /** comet from a card to the foe; resolves on arrival */
  projectile(from: THREE.Vector3, to: THREE.Vector3, el: Element, dur = 0.42, size = 1): Promise<void> {
    const f = ELEMENT_FX[el];
    const mid = from.clone().lerp(to, 0.5);
    mid.y += 2.5 + Math.random() * 1.5;
    mid.x += (Math.random() - 0.5) * 4;
    return new Promise((resolve) => {
      this.projectiles.push({ p0: from.clone(), p1: mid, p2: to.clone(), t: 0, dur, colors: f.colors, end: f.end, size, resolve, emitAcc: 0 });
    });
  }

  /** element-specific impact burst. strength ~0.5..3 */
  elementHit(el: Element, pos: THREE.Vector3, strength = 1): void {
    const s = Math.max(0.4, strength) * this.intensityScale;
    const f = ELEMENT_FX[el];
    const n = (k: number) => Math.round(k * Math.min(3, s));
    this.add.emit({ pos, count: 1, speed: [0, 0], life: [0.16, 0.16], size: [2.4 * Math.min(1.6, s), 2.4 * Math.min(1.6, s)], sizeEnd: 1.8, color: f.flash, intensity: 1.3 });
    switch (el) {
      case 'fire':
        this.add.emit({ pos, count: n(70), spread: 0.4, speed: [4, 14], life: [0.5, 1.3], size: [0.15, 0.45], sizeEnd: 0.1, color: f.colors, colorEnd: f.end, intensity: 3, gravity: -4, drag: 2.2, shape: Shape.Spark });
        this.add.emit({ pos, count: n(26), spread: 0.8, speed: [1, 4], life: [0.4, 0.9], size: [0.9, 1.8], sizeEnd: 2.2, color: f.colors, colorEnd: '#300800', intensity: 1.8, gravity: -2, drag: 2 });
        this.norm.emit({ pos, count: n(14), spread: 1, speed: [0.5, 2], life: [1, 2], size: [1.2, 2.2], sizeEnd: 2.5, color: '#1a0c08', alpha: 0.5, gravity: -1.2, drag: 1, shape: Shape.Smoke });
        this.ring(pos, f.ring, 5 * s, 0.5, 0.06);
        break;
      case 'water':
        this.add.emit({ pos, count: n(55), spread: 0.4, speed: [5, 12], dir: new THREE.Vector3(0, 1, 0.3), cone: 1.2, life: [0.6, 1.2], size: [0.16, 0.32], sizeEnd: 0.6, color: f.colors, colorEnd: f.end, intensity: 2.6, gravity: 14, drag: 1, shape: Shape.Droplet });
        this.add.emit({ pos, count: n(30), spread: 1.2, speed: [0.5, 2], life: [0.6, 1.2], size: [0.6, 1.2], sizeEnd: 1.8, color: f.colors, intensity: 1.3, drag: 2 });
        this.ring(pos, f.ring, 4.5 * s, 0.55, 0.04);
        this.ring(pos, f.ring, 7 * s, 0.9, 0.03, 1.4, 0.5);
        break;
      case 'wind': {
        for (let i = 0; i < 3; i++) {
          const p = pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 1.2, 0.5));
          this.slash(p, Math.random() * Math.PI * 2, f.ring, 3.5 * Math.min(1.8, s) + Math.random(), 0.3 + i * 0.05);
        }
        this.add.emit({ pos, count: n(70), spread: 1, flat: true, speed: [3, 8], life: [0.4, 0.9], size: [0.1, 0.25], sizeEnd: 0.2, color: f.colors, colorEnd: f.end, intensity: 2.6, drag: 2.5, swirl: 9, shape: Shape.Spark });
        this.add.emit({ pos, count: n(20), spread: 0.6, speed: [1, 3], life: [0.5, 1.0], size: [0.6, 1.3], sizeEnd: 2, color: f.colors, intensity: 1.2, drag: 2, swirl: 4 });
        this.ring(pos, f.ring, 4 * s, 0.4, 0.03);
        break;
      }
      case 'earth':
        this.norm.emit({ pos, count: n(34), spread: 0.4, speed: [5, 12], dir: new THREE.Vector3(0, 1, 0.4), cone: 1.4, life: [0.8, 1.4], size: [0.25, 0.55], sizeEnd: 0.8, color: ['#8a5a2a', '#6b4420', '#b07a3a', '#4a2e14'], alpha: 1, gravity: 16, drag: 0.6, shape: Shape.Shard, spin: 10 });
        this.add.emit({ pos, count: n(40), spread: 0.4, speed: [4, 10], life: [0.4, 0.9], size: [0.1, 0.22], sizeEnd: 0.1, color: f.colors, colorEnd: f.end, intensity: 2.8, gravity: 8, drag: 1.5, shape: Shape.Spark });
        this.norm.emit({ pos, count: n(16), spread: 1.2, speed: [0.5, 2.5], life: [1, 1.8], size: [1.4, 2.6], sizeEnd: 2.2, color: '#2a1c10', alpha: 0.55, gravity: 0.5, drag: 1.5, shape: Shape.Smoke });
        this.ring(pos, f.ring, 5.5 * s, 0.55, 0.07);
        break;
    }
  }

  heavyImpact(pos: THREE.Vector3, color: THREE.ColorRepresentation, strength = 1): void {
    const s = strength * this.intensityScale;
    this.add.emit({ pos, count: 1, speed: [0, 0], life: [0.3, 0.3], size: [9 * s, 9 * s], sizeEnd: 1.5, color, intensity: 2.5 });
    this.add.emit({ pos, count: Math.round(90 * Math.min(2, s)), spread: 0.5, speed: [8, 22], life: [0.5, 1.2], size: [0.12, 0.3], sizeEnd: 0.1, color: ['#ffffff', color], intensity: 3, drag: 2.4, shape: Shape.Spark });
    this.add.emit({ pos, count: 24, spread: 0.6, speed: [2, 6], life: [0.6, 1.2], size: [0.2, 0.5], color, intensity: 3, drag: 1.5, shape: Shape.Star, spin: 3 });
    this.ring(pos, color, 9 * s, 0.7, 0.05, 3);
    this.ring(pos, '#ffffff', 5 * s, 0.35, 0.03, 3);
  }

  sparkle(pos: THREE.Vector3, color: THREE.ColorRepresentation, count = 14, size = 1): void {
    this.add.emit({ pos, count, spread: 0.35 * size, speed: [1, 3.5], life: [0.4, 0.8], size: [0.08 * size, 0.2 * size], sizeEnd: 0.1, color: ['#ffffff', color], intensity: 2.5, drag: 3, shape: Shape.Star, spin: 4 });
  }

  healBurst(pos: THREE.Vector3): void {
    this.add.emit({ pos, count: 40, spread: 1.4, flat: true, speed: [0.5, 1.5], dir: new THREE.Vector3(0, 1, 0), cone: 0.4, life: [0.8, 1.5], size: [0.12, 0.3], color: ['#9dffb8', '#e6ffef', '#5fe08f'], intensity: 2.4, gravity: -2.5, drag: 1, shape: Shape.Star, spin: 2 });
  }

  shieldBurst(pos: THREE.Vector3): void {
    this.ring(pos, '#ffcf6a', 3.5, 0.5, 0.06, 2.4, 0.5);
    this.add.emit({ pos, count: 30, spread: 1.2, flat: true, speed: [0.3, 1.2], life: [0.6, 1.0], size: [0.12, 0.26], color: ['#ffe2a0', '#ffc65a'], intensity: 2.4, drag: 2, shape: Shape.Shard, spin: 3 });
  }

  /** stardust explosion for a defeated foe */
  stardust(pos: THREE.Vector3, colors: string[], count = 600, spread = 3): void {
    this.add.emit({ pos, count, spread, speed: [2, 14], life: [1.2, 3.2], size: [0.06, 0.22], sizeEnd: 0.2, color: colors, intensity: 2.4, drag: 0.9, gravity: 0.6, shape: Shape.Star, spin: 3 });
    // faint nebula puffs — kept dim so overlapping glows never blow out to white
    this.add.emit({ pos, count: Math.max(4, Math.round(count / 16)), spread: spread * 0.7, speed: [0.5, 2.5], life: [1.5, 3], size: [0.8, 2.0], sizeEnd: 2, color: colors, intensity: 0.28, drag: 1 });
    this.ring(pos, colors[0], 18, 1.4, 0.04, 1.8);
    this.ring(pos, '#ffffff', 10, 0.8, 0.025, 2.0);
  }

  /** celebratory firework: a sphere of twinkling stars with a soft core */
  firework(pos: THREE.Vector3, colors: string[], count = 140): void {
    this.add.emit({ pos, count, spread: 0.1, speed: [3, 6.5], life: [1.0, 1.9], size: [0.08, 0.18], sizeEnd: 0.25, color: colors, intensity: 2.6, drag: 1.6, gravity: 1.4, shape: Shape.Star, spin: 3 });
    this.add.emit({ pos, count: Math.round(count / 3), spread: 0.1, speed: [1, 3], life: [0.6, 1.1], size: [0.05, 0.1], color: '#ffffff', intensity: 3, drag: 2, gravity: 1, shape: Shape.Spark });
    this.add.emit({ pos, count: 1, speed: [0, 0], life: [0.25, 0.25], size: [1.6, 1.6], sizeEnd: 2, color: colors[0], intensity: 1.6 });
  }

  coinBurst(pos: THREE.Vector3, count = 20): void {
    this.add.emit({ pos, count, spread: 0.3, speed: [3, 8], dir: new THREE.Vector3(0, 1, 0.2), cone: 0.9, life: [0.7, 1.2], size: [0.18, 0.3], sizeEnd: 0.6, color: ['#ffd76a', '#fff0b8', '#e8a83a'], intensity: 2.2, gravity: 12, drag: 0.8, shape: Shape.Star, spin: 6 });
  }

  clear(): void {
    this.add.clear();
    this.norm.clear();
    for (const p of this.projectiles) p.resolve();
    this.projectiles = [];
  }
}

function bezier(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, t: number, out: THREE.Vector3): THREE.Vector3 {
  const u = 1 - t;
  out.set(
    u * u * a.x + 2 * u * t * b.x + t * t * c.x,
    u * u * a.y + 2 * u * t * b.y + t * t * c.y,
    u * u * a.z + 2 * u * t * b.z + t * t * c.z,
  );
  return out;
}
