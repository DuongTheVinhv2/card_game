import * as THREE from 'three';

export enum Shape {
  Glow = 0,
  Spark = 1,
  Ring = 2,
  Star = 3,
  Shard = 4,
  Smoke = 5,
  Droplet = 6,
}

const vert = /* glsl */ `
attribute vec4 aColor;
attribute float aSize;
attribute float aShape;
attribute float aAngle;
attribute vec3 aVel;
uniform float uScale;
varying vec4 vColor;
varying float vShape;
varying float vAngle;
varying float vStretch;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float stretch = 0.0;
  float ang = aAngle;
  if (aShape > 0.5 && aShape < 1.5 || aShape > 5.5) {
    vec4 p2 = projectionMatrix * (mv + modelViewMatrix * vec4(aVel * 0.03, 0.0));
    vec2 a = gl_Position.xy / gl_Position.w;
    vec2 b = p2.xy / p2.w;
    vec2 d = b - a;
    float len = length(d);
    ang = atan(d.y, d.x);
    stretch = clamp(len * 60.0, 0.0, aShape > 5.5 ? 1.2 : 5.0);
  }
  gl_PointSize = aSize * uScale / max(0.1, -mv.z) * (1.0 + stretch * 0.6);
  vColor = aColor;
  vShape = aShape;
  vAngle = ang;
  vStretch = stretch;
}`;

const frag = /* glsl */ `
varying vec4 vColor;
varying float vShape;
varying float vAngle;
varying float vStretch;
uniform float uNormalBlend;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  p.y = -p.y;
  float c = cos(vAngle);
  float s = sin(vAngle);
  p = mat2(c, s, -s, c) * p;
  float d = length(p);
  float a = 0.0;
  if (vShape < 0.5) {
    a = exp(-d * d * 5.0) * (1.0 - smoothstep(0.75, 1.0, d));
    a += exp(-d * d * 40.0) * 0.6;
  } else if (vShape < 1.5) {
    vec2 q = vec2(p.x, p.y * (1.0 + vStretch * 1.4));
    float e = length(q);
    a = exp(-e * e * 7.0) * (1.0 - smoothstep(0.85, 1.0, d)) + exp(-e * e * 40.0) * 0.8;
  } else if (vShape < 2.5) {
    float r = d - 0.72;
    a = exp(-r * r * 260.0) + exp(-r * r * 30.0) * 0.25;
    a *= 1.0 - smoothstep(0.92, 1.0, d);
  } else if (vShape < 3.5) {
    a = exp(-d * d * 14.0) * 1.2;
    a += (exp(-abs(p.x) * 16.0) * exp(-abs(p.y) * 2.6) + exp(-abs(p.y) * 16.0) * exp(-abs(p.x) * 2.6)) * 0.75;
    a *= 1.0 - smoothstep(0.85, 1.0, d);
  } else if (vShape < 4.5) {
    float k = abs(p.x) * 0.75 + abs(p.y) * 1.35;
    a = smoothstep(0.92, 0.78, k);
    float shade = 0.6 + 0.4 * step(0.0, p.x * 0.6 + p.y);
    a *= shade;
  } else if (vShape < 5.5) {
    a = smoothstep(1.0, 0.0, d);
    a = a * a * 0.7;
  } else {
    vec2 q = vec2(p.x, p.y * (1.0 + vStretch));
    float e = length(q);
    a = smoothstep(0.75, 0.45, e) + exp(-e * e * 30.0) * 0.5;
  }
  if (a < 0.002) discard;
  if (uNormalBlend > 0.5) {
    gl_FragColor = vec4(vColor.rgb, a * vColor.a);
  } else {
    gl_FragColor = vec4(vColor.rgb * a * vColor.a, 1.0);
  }
}`;

export interface EmitOpts {
  pos: THREE.Vector3;
  count: number;
  /** spawn position jitter radius */
  spread?: number;
  /** spawn in a disc (xy) instead of sphere */
  flat?: boolean;
  speed?: [number, number];
  dir?: THREE.Vector3;
  /** cone half-angle in radians (Math.PI = full sphere) */
  cone?: number;
  life?: [number, number];
  size?: [number, number];
  sizeEnd?: number;
  color: THREE.ColorRepresentation | THREE.ColorRepresentation[];
  colorEnd?: THREE.ColorRepresentation;
  intensity?: number;
  alpha?: number;
  gravity?: number;
  drag?: number;
  shape?: Shape;
  spin?: number;
  /** tangential swirl speed around the z axis through pos */
  swirl?: number;
  addVel?: THREE.Vector3;
  delay?: [number, number];
}

const tmpC = new THREE.Color();
const tmpC2 = new THREE.Color();
const tmpV = new THREE.Vector3();

export class ParticleSystem {
  readonly points: THREE.Points;
  readonly max: number;
  private count = 0;
  private pos: Float32Array;
  private vel: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private shape: Float32Array;
  private angle: Float32Array;
  // simulation-only
  private c0: Float32Array;
  private c1: Float32Array;
  private s0: Float32Array;
  private s1: Float32Array;
  private a0: Float32Array;
  private life: Float32Array;
  private age: Float32Array;
  private drag: Float32Array;
  private grav: Float32Array;
  private spin: Float32Array;
  private geo: THREE.BufferGeometry;
  private mat: THREE.ShaderMaterial;

  constructor(max: number, normalBlend = false) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.shape = new Float32Array(max);
    this.angle = new Float32Array(max);
    this.c0 = new Float32Array(max * 3);
    this.c1 = new Float32Array(max * 3);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.a0 = new Float32Array(max);
    this.life = new Float32Array(max);
    this.age = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.spin = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aVel', new THREE.BufferAttribute(this.vel, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aShape', new THREE.BufferAttribute(this.shape, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAngle', new THREE.BufferAttribute(this.angle, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setDrawRange(0, 0);
    this.geo = geo;
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { uScale: { value: 500 }, uNormalBlend: { value: normalBlend ? 1 : 0 } },
      transparent: true,
      depthWrite: false,
      blending: normalBlend ? THREE.NormalBlending : THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = normalBlend ? 5 : 10;
  }

  setViewport(heightPx: number, fovDeg: number): void {
    this.mat.uniforms.uScale.value = (heightPx * 0.5) / Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2);
  }

  get alive(): number {
    return this.count;
  }

  emit(o: EmitOpts): void {
    const colors = Array.isArray(o.color) ? o.color : [o.color];
    const intensity = o.intensity ?? 1;
    const [sp0, sp1] = o.speed ?? [1, 3];
    const [l0, l1] = o.life ?? [0.5, 1.0];
    const [z0, z1] = o.size ?? [0.1, 0.25];
    const cone = o.cone ?? Math.PI;
    const dir = o.dir ? tmpV.copy(o.dir).normalize() : null;
    let t1: THREE.Vector3 | null = null;
    let t2: THREE.Vector3 | null = null;
    if (dir) {
      const up = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      t1 = new THREE.Vector3().crossVectors(dir, up).normalize();
      t2 = new THREE.Vector3().crossVectors(dir, t1);
    }
    for (let n = 0; n < o.count; n++) {
      if (this.count >= this.max) return;
      const i = this.count++;
      // position
      const r = (o.spread ?? 0) * Math.cbrt(Math.random());
      const th = Math.random() * Math.PI * 2;
      const ph = o.flat ? Math.PI / 2 : Math.acos(2 * Math.random() - 1);
      this.pos[i * 3] = o.pos.x + r * Math.sin(ph) * Math.cos(th);
      this.pos[i * 3 + 1] = o.pos.y + r * Math.sin(ph) * Math.sin(th);
      this.pos[i * 3 + 2] = o.pos.z + (o.flat ? 0 : r * Math.cos(ph));
      // velocity in cone
      let vx: number;
      let vy: number;
      let vz: number;
      const sp = sp0 + Math.random() * (sp1 - sp0);
      if (dir && t1 && t2 && cone < Math.PI) {
        const ct = 1 - Math.random() * (1 - Math.cos(cone));
        const st = Math.sqrt(1 - ct * ct);
        const a = Math.random() * Math.PI * 2;
        vx = (dir.x * ct + (t1.x * Math.cos(a) + t2.x * Math.sin(a)) * st) * sp;
        vy = (dir.y * ct + (t1.y * Math.cos(a) + t2.y * Math.sin(a)) * st) * sp;
        vz = (dir.z * ct + (t1.z * Math.cos(a) + t2.z * Math.sin(a)) * st) * sp;
      } else {
        const u = 2 * Math.random() - 1;
        const a = Math.random() * Math.PI * 2;
        const s = Math.sqrt(1 - u * u);
        vx = s * Math.cos(a) * sp;
        vy = s * Math.sin(a) * sp;
        vz = (o.flat ? u * 0.15 : u) * sp;
      }
      if (o.swirl) {
        const dx = this.pos[i * 3] - o.pos.x;
        const dy = this.pos[i * 3 + 1] - o.pos.y;
        const dl = Math.hypot(dx, dy) || 1;
        vx += (-dy / dl) * o.swirl;
        vy += (dx / dl) * o.swirl;
      }
      if (o.addVel) {
        vx += o.addVel.x;
        vy += o.addVel.y;
        vz += o.addVel.z;
      }
      this.vel[i * 3] = vx;
      this.vel[i * 3 + 1] = vy;
      this.vel[i * 3 + 2] = vz;
      tmpC.set(colors[(Math.random() * colors.length) | 0]).multiplyScalar(intensity);
      this.c0[i * 3] = tmpC.r;
      this.c0[i * 3 + 1] = tmpC.g;
      this.c0[i * 3 + 2] = tmpC.b;
      if (o.colorEnd !== undefined) tmpC2.set(o.colorEnd).multiplyScalar(intensity);
      else tmpC2.copy(tmpC);
      this.c1[i * 3] = tmpC2.r;
      this.c1[i * 3 + 1] = tmpC2.g;
      this.c1[i * 3 + 2] = tmpC2.b;
      this.a0[i] = o.alpha ?? 1;
      const s0 = z0 + Math.random() * (z1 - z0);
      this.s0[i] = s0;
      this.s1[i] = s0 * (o.sizeEnd ?? 0.2);
      this.life[i] = l0 + Math.random() * (l1 - l0);
      this.age[i] = o.delay ? -(o.delay[0] + Math.random() * (o.delay[1] - o.delay[0])) : 0;
      this.drag[i] = o.drag ?? 1.5;
      this.grav[i] = o.gravity ?? 0;
      this.shape[i] = o.shape ?? Shape.Glow;
      this.angle[i] = Math.random() * Math.PI * 2;
      this.spin[i] = (Math.random() - 0.5) * (o.spin ?? 0) * 2;
      this.size[i] = 0;
      this.col[i * 4 + 3] = 0;
    }
  }

  update(dt: number): void {
    let i = 0;
    while (i < this.count) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        this.kill(i);
        continue;
      }
      if (this.age[i] < 0) {
        this.size[i] = 0;
        i++;
        continue;
      }
      const t = this.age[i] / this.life[i];
      const dr = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= dr;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * dr - this.grav[i] * dt;
      this.vel[i * 3 + 2] *= dr;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.angle[i] += this.spin[i] * dt;
      const fadeIn = Math.min(1, t * 12);
      const fadeOut = 1 - t * t;
      this.col[i * 4] = this.c0[i * 3] + (this.c1[i * 3] - this.c0[i * 3]) * t;
      this.col[i * 4 + 1] = this.c0[i * 3 + 1] + (this.c1[i * 3 + 1] - this.c0[i * 3 + 1]) * t;
      this.col[i * 4 + 2] = this.c0[i * 3 + 2] + (this.c1[i * 3 + 2] - this.c0[i * 3 + 2]) * t;
      this.col[i * 4 + 3] = this.a0[i] * fadeIn * fadeOut;
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      i++;
    }
    this.geo.setDrawRange(0, this.count);
    for (const k of ['position', 'aVel', 'aColor', 'aSize', 'aShape', 'aAngle']) {
      const attr = this.geo.getAttribute(k) as THREE.BufferAttribute;
      attr.clearUpdateRanges();
      attr.addUpdateRange(0, this.count * attr.itemSize);
      attr.needsUpdate = true;
    }
  }

  private kill(i: number): void {
    const last = --this.count;
    if (i === last) return;
    const cp3 = (arr: Float32Array) => {
      arr[i * 3] = arr[last * 3];
      arr[i * 3 + 1] = arr[last * 3 + 1];
      arr[i * 3 + 2] = arr[last * 3 + 2];
    };
    cp3(this.pos);
    cp3(this.vel);
    cp3(this.c0);
    cp3(this.c1);
    for (let k = 0; k < 4; k++) this.col[i * 4 + k] = this.col[last * 4 + k];
    this.size[i] = this.size[last];
    this.shape[i] = this.shape[last];
    this.angle[i] = this.angle[last];
    this.s0[i] = this.s0[last];
    this.s1[i] = this.s1[last];
    this.a0[i] = this.a0[last];
    this.life[i] = this.life[last];
    this.age[i] = this.age[last];
    this.drag[i] = this.drag[last];
    this.grav[i] = this.grav[last];
    this.spin[i] = this.spin[last];
  }

  clear(): void {
    this.count = 0;
    this.geo.setDrawRange(0, 0);
  }
}
