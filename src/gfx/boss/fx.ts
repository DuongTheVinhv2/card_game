import * as THREE from 'three';
import { FX_FS, FX_VS } from './shaders';

/** FX particle behaviours */
export const enum FK {
  Spark = 0,
  Ember = 1,
  Drop = 2,
  Streak = 3,
  Dust = 4,
  Orbit = 5,
  Shot = 6,
  Drain = 7,
  Drip = 8,
  Debris = 9,
  Twinkle = 10,
  Current = 11,
  Converge = 12,
  Ring = 13,
}

/**
 * Pool of CPU-simulated additive sprites (supports velocity-stretched streaks).
 * Coordinates are creature-local (the Points object lives inside the creature rig's parent).
 */
export class FxSystem {
  readonly points: THREE.Points;
  readonly mat: THREE.ShaderMaterial;
  readonly geo: THREE.BufferGeometry;
  readonly cap: number;
  n = 0;
  /** global multipliers */
  alphaMul = 1;
  private readonly px: Float32Array;
  private readonly py: Float32Array;
  private readonly pz: Float32Array;
  private readonly vx: Float32Array;
  private readonly vy: Float32Array;
  private readonly vz: Float32Array;
  private readonly life: Float32Array;
  private readonly max: Float32Array;
  private readonly size: Float32Array;
  private readonly alpha: Float32Array;
  private readonly cr: Float32Array;
  private readonly cg: Float32Array;
  private readonly cb: Float32Array;
  private readonly kind: Uint8Array;
  private readonly seed: Float32Array;
  /** params */
  private readonly p0: Float32Array;
  private readonly p1: Float32Array;
  private readonly p2: Float32Array;
  private readonly p3: Float32Array;
  /** start / control / target points */
  private readonly sx: Float32Array;
  private readonly sy: Float32Array;
  private readonly sz: Float32Array;
  private readonly tx: Float32Array;
  private readonly ty: Float32Array;
  private readonly tz: Float32Array;
  private readonly gPos: Float32Array;
  private readonly gF: Float32Array;
  private readonly gC: Float32Array;
  private readonly aPos: THREE.BufferAttribute;
  private readonly aF: THREE.BufferAttribute;
  private readonly aC: THREE.BufferAttribute;
  private readonly trail: number[] = [];

  constructor(cap: number) {
    this.cap = cap;
    const f = () => new Float32Array(cap);
    this.px = f();
    this.py = f();
    this.pz = f();
    this.vx = f();
    this.vy = f();
    this.vz = f();
    this.life = f();
    this.max = f();
    this.size = f();
    this.alpha = f();
    this.cr = f();
    this.cg = f();
    this.cb = f();
    this.kind = new Uint8Array(cap);
    this.seed = f();
    this.p0 = f();
    this.p1 = f();
    this.p2 = f();
    this.p3 = f();
    this.sx = f();
    this.sy = f();
    this.sz = f();
    this.tx = f();
    this.ty = f();
    this.tz = f();
    this.gPos = new Float32Array(cap * 3);
    this.gF = new Float32Array(cap * 4);
    this.gC = new Float32Array(cap * 3);
    this.geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.gPos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aF = new THREE.BufferAttribute(this.gF, 4).setUsage(THREE.DynamicDrawUsage);
    this.aC = new THREE.BufferAttribute(this.gC, 3).setUsage(THREE.DynamicDrawUsage);
    this.geo.setAttribute('position', this.aPos);
    this.geo.setAttribute('aF', this.aF);
    this.geo.setAttribute('aC', this.aC);
    this.geo.setDrawRange(0, 0);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: FX_VS,
      fragmentShader: FX_FS,
      uniforms: { uPx: { value: 500 }, uMinPx: { value: 1.5 } },
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
  }

  get free(): number {
    return this.cap - this.n;
  }

  spawn(kind: FK, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, col: THREE.Color, alpha = 1): number {
    if (this.n >= this.cap) return -1;
    const i = this.n++;
    this.kind[i] = kind;
    this.px[i] = x;
    this.py[i] = y;
    this.pz[i] = z;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.vz[i] = vz;
    this.life[i] = 0;
    this.max[i] = Math.max(0.05, life);
    this.size[i] = size;
    this.alpha[i] = alpha;
    this.cr[i] = col.r;
    this.cg[i] = col.g;
    this.cb[i] = col.b;
    this.seed[i] = Math.random();
    this.p0[i] = this.p1[i] = this.p2[i] = this.p3[i] = 0;
    this.sx[i] = x;
    this.sy[i] = y;
    this.sz[i] = z;
    this.tx[i] = x;
    this.ty[i] = y;
    this.tz[i] = z;
    return i;
  }

  params(i: number, a: number, b = 0, c = 0, d = 0): void {
    if (i < 0) return;
    this.p0[i] = a;
    this.p1[i] = b;
    this.p2[i] = c;
    this.p3[i] = d;
  }

  target(i: number, x: number, y: number, z: number): void {
    if (i < 0) return;
    this.tx[i] = x;
    this.ty[i] = y;
    this.tz[i] = z;
  }

  /** start point override (used as control point / orbit centre) */
  origin(i: number, x: number, y: number, z: number): void {
    if (i < 0) return;
    this.sx[i] = x;
    this.sy[i] = y;
    this.sz[i] = z;
  }

  clear(): void {
    this.n = 0;
    this.geo.setDrawRange(0, 0);
  }

  private kill(i: number): void {
    const j = --this.n;
    if (i === j) return;
    this.kind[i] = this.kind[j];
    this.px[i] = this.px[j];
    this.py[i] = this.py[j];
    this.pz[i] = this.pz[j];
    this.vx[i] = this.vx[j];
    this.vy[i] = this.vy[j];
    this.vz[i] = this.vz[j];
    this.life[i] = this.life[j];
    this.max[i] = this.max[j];
    this.size[i] = this.size[j];
    this.alpha[i] = this.alpha[j];
    this.cr[i] = this.cr[j];
    this.cg[i] = this.cg[j];
    this.cb[i] = this.cb[j];
    this.seed[i] = this.seed[j];
    this.p0[i] = this.p0[j];
    this.p1[i] = this.p1[j];
    this.p2[i] = this.p2[j];
    this.p3[i] = this.p3[j];
    this.sx[i] = this.sx[j];
    this.sy[i] = this.sy[j];
    this.sz[i] = this.sz[j];
    this.tx[i] = this.tx[j];
    this.ty[i] = this.ty[j];
    this.tz[i] = this.tz[j];
  }

  update(dt: number, time: number): void {
    const tr = this.trail;
    tr.length = 0;
    let i = 0;
    while (i < this.n) {
      this.life[i] += dt;
      if (this.life[i] >= this.max[i]) {
        this.kill(i);
        continue;
      }
      const u = this.life[i] / this.max[i];
      const s = this.seed[i];
      let a = 1;
      let stretch = 0;
      let sz = this.size[i];
      let ang = Math.atan2(this.vy[i], this.vx[i]);
      switch (this.kind[i] as FK) {
        case FK.Spark: {
          const drag = Math.exp(-(this.p0[i] || 2.5) * dt);
          this.vx[i] *= drag;
          this.vy[i] = this.vy[i] * drag - this.p1[i] * dt;
          this.vz[i] *= drag;
          this.px[i] += this.vx[i] * dt;
          this.py[i] += this.vy[i] * dt;
          this.pz[i] += this.vz[i] * dt;
          a = Math.pow(1 - u, 1.4);
          sz *= 1 - 0.55 * u;
          stretch = Math.min(5, Math.hypot(this.vx[i], this.vy[i]) * 0.35);
          ang = Math.atan2(this.vy[i], this.vx[i]);
          break;
        }
        case FK.Ember: {
          this.vy[i] += 0.35 * dt;
          this.vx[i] += Math.sin(time * 2.3 + s * 40) * 0.6 * dt;
          this.px[i] += this.vx[i] * dt;
          this.py[i] += this.vy[i] * dt;
          this.pz[i] += this.vz[i] * dt;
          const fl = 0.55 + 0.45 * Math.sin(time * 23 + s * 60) * Math.sin(time * 7.3 + s * 13);
          a = Math.pow(Math.sin(Math.PI * u), 0.7) * fl;
          sz *= 1 - 0.6 * u;
          stretch = 0.6;
          ang = Math.atan2(this.vy[i], this.vx[i]);
          break;
        }
        case FK.Drop: {
          this.vy[i] = Math.max(this.vy[i] - 0.25 * dt, -1.2);
          this.px[i] += (this.vx[i] + Math.sin(time * 1.3 + s * 20) * 0.08) * dt;
          this.py[i] += this.vy[i] * dt;
          a = Math.sin(Math.PI * u);
          stretch = 0.8;
          ang = Math.PI / 2;
          break;
        }
        case FK.Streak: {
          this.vy[i] = this.p0[i] * Math.sin(time * this.p1[i] + s * 30) + this.p2[i];
          this.px[i] += this.vx[i] * dt;
          this.py[i] += this.vy[i] * dt;
          a = Math.pow(Math.sin(Math.PI * u), 1.2);
          stretch = 4.5 + 2 * s;
          ang = Math.atan2(this.vy[i], this.vx[i]);
          break;
        }
        case FK.Dust: {
          this.px[i] += (this.vx[i] + Math.sin(time * 0.5 + s * 9) * 0.05) * dt;
          this.py[i] += this.vy[i] * dt;
          this.pz[i] += this.vz[i] * dt;
          a = Math.pow(Math.sin(Math.PI * u), 1.5);
          break;
        }
        case FK.Orbit: {
          // p0 angle0, p1 angular speed, p2 radius, p3 tilt height; s* = centre
          const th = this.p0[i] + this.p1[i] * this.life[i];
          const R = this.p2[i];
          this.px[i] = this.sx[i] + Math.cos(th) * R;
          this.py[i] = this.sy[i] + Math.sin(th) * R * 0.2 + this.p3[i];
          this.pz[i] = this.sz[i] + Math.sin(th) * R * 0.5;
          a = Math.min(1, u * 6, (1 - u) * 6);
          // dim when passing behind
          a *= 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(th));
          break;
        }
        case FK.Shot: {
          // quadratic bezier start -> control(p0..p2 offsets) -> target
          const e = u * u * (1.6 - 0.6 * u);
          const cx = (this.sx[i] + this.tx[i]) * 0.5 + this.p0[i];
          const cy = (this.sy[i] + this.ty[i]) * 0.5 + this.p1[i];
          const cz = (this.sz[i] + this.tz[i]) * 0.5 + this.p2[i];
          const q = 1 - e;
          const nx = q * q * this.sx[i] + 2 * q * e * cx + e * e * this.tx[i];
          const ny = q * q * this.sy[i] + 2 * q * e * cy + e * e * this.ty[i];
          const nz = q * q * this.sz[i] + 2 * q * e * cz + e * e * this.tz[i];
          const ddt = Math.max(dt, 1e-4);
          this.vx[i] = (nx - this.px[i]) / ddt;
          this.vy[i] = (ny - this.py[i]) / ddt;
          this.vz[i] = (nz - this.pz[i]) / ddt;
          this.px[i] = nx;
          this.py[i] = ny;
          this.pz[i] = nz;
          a = Math.min(1, u * 8);
          stretch = Math.min(3, Math.hypot(this.vx[i], this.vy[i]) * 0.12);
          ang = Math.atan2(this.vy[i], this.vx[i]);
          if (Math.random() < 0.9) tr.push(i);
          break;
        }
        case FK.Drain: {
          const e = u * u;
          const cx = (this.sx[i] + this.tx[i]) * 0.5 + this.p0[i];
          const cy = (this.sy[i] + this.ty[i]) * 0.5 + this.p1[i];
          const cz = (this.sz[i] + this.tz[i]) * 0.5;
          const q = 1 - e;
          const w = Math.sin(u * Math.PI * 3 + s * 20) * 0.35 * (1 - u);
          const nx = q * q * this.sx[i] + 2 * q * e * cx + e * e * this.tx[i] + w;
          const ny = q * q * this.sy[i] + 2 * q * e * cy + e * e * this.ty[i] + w * 0.6;
          const nz = q * q * this.sz[i] + 2 * q * e * cz + e * e * this.tz[i];
          const ddt = Math.max(dt, 1e-4);
          this.vx[i] = (nx - this.px[i]) / ddt;
          this.vy[i] = (ny - this.py[i]) / ddt;
          this.px[i] = nx;
          this.py[i] = ny;
          this.pz[i] = nz;
          a = Math.min(1, u * 5) * (1 - Math.pow(u, 6));
          stretch = Math.min(3, Math.hypot(this.vx[i], this.vy[i]) * 0.15);
          ang = Math.atan2(this.vy[i], this.vx[i]);
          break;
        }
        case FK.Drip: {
          const g = u < 0.25 ? 0.15 : 1.6;
          this.vy[i] -= g * dt;
          this.py[i] += this.vy[i] * dt;
          this.px[i] += this.vx[i] * dt;
          a = Math.min(1, u * 5) * (1 - u);
          stretch = Math.min(2.5, 0.3 + Math.abs(this.vy[i]) * 0.9);
          ang = Math.PI / 2;
          sz *= u < 0.25 ? 0.6 + u * 1.6 : 1 - (u - 0.25) * 0.5;
          break;
        }
        case FK.Debris: {
          this.px[i] += this.vx[i] * dt;
          this.py[i] += this.vy[i] * dt;
          this.pz[i] += this.vz[i] * dt;
          a = Math.min(1, u * 4) * Math.pow(1 - u, 1.2) * (0.6 + 0.4 * Math.sin(time * 9 + s * 30));
          break;
        }
        case FK.Twinkle: {
          const k = Math.sin(Math.PI * u);
          a = k * k;
          sz *= 0.6 + 0.6 * k;
          break;
        }
        case FK.Current: {
          // p0 speed, p1 amplitude, p2 wavenumber; sy = base line
          this.px[i] += this.p0[i] * dt;
          this.py[i] = this.sy[i] + this.p1[i] * Math.sin(this.px[i] * this.p2[i] + time * 1.4 + s * 6);
          const dy = this.p1[i] * this.p2[i] * Math.cos(this.px[i] * this.p2[i] + time * 1.4 + s * 6);
          a = Math.pow(Math.sin(Math.PI * u), 1.3);
          stretch = 2.2;
          ang = Math.atan2(dy * Math.sign(this.p0[i]), Math.sign(this.p0[i]));
          break;
        }
        case FK.Converge: {
          const dx = this.tx[i] - this.px[i];
          const dy = this.ty[i] - this.py[i];
          const dz = this.tz[i] - this.pz[i];
          const d = Math.hypot(dx, dy, dz);
          if (d < 0.12) {
            this.kill(i);
            continue;
          }
          const sp = (this.p0[i] || 3) * (0.4 + u * 1.6);
          const k = Math.min(1, (sp * dt) / d);
          this.vx[i] = dx / d * sp;
          this.vy[i] = dy / d * sp;
          this.px[i] += dx * k;
          this.py[i] += dy * k;
          this.pz[i] += dz * k;
          a = Math.min(1, u * 4);
          stretch = Math.min(3.5, sp * 0.4);
          ang = Math.atan2(dy, dx);
          break;
        }
        case FK.Ring: {
          const drag = Math.exp(-3.2 * dt);
          this.vx[i] *= drag;
          this.vy[i] *= drag;
          this.vz[i] *= drag;
          this.px[i] += this.vx[i] * dt;
          this.py[i] += this.vy[i] * dt;
          this.pz[i] += this.vz[i] * dt;
          a = Math.pow(1 - u, 1.6);
          stretch = 1.4;
          ang = Math.atan2(this.vy[i], this.vx[i]) + Math.PI / 2;
          break;
        }
      }
      const o3 = i * 3;
      this.gPos[o3] = this.px[i];
      this.gPos[o3 + 1] = this.py[i];
      this.gPos[o3 + 2] = this.pz[i];
      const o4 = i * 4;
      this.gF[o4] = sz;
      this.gF[o4 + 1] = a * this.alpha[i] * this.alphaMul;
      this.gF[o4 + 2] = stretch;
      this.gF[o4 + 3] = ang;
      this.gC[o3] = this.cr[i];
      this.gC[o3 + 1] = this.cg[i];
      this.gC[o3 + 2] = this.cb[i];
      i++;
    }
    // projectile trails
    for (const k of tr) {
      if (this.n >= this.cap) break;
      const j = this.n++;
      this.kind[j] = FK.Spark;
      this.px[j] = this.px[k] + (Math.random() - 0.5) * 0.08;
      this.py[j] = this.py[k] + (Math.random() - 0.5) * 0.08;
      this.pz[j] = this.pz[k];
      this.vx[j] = (Math.random() - 0.5) * 0.6 - this.vx[k] * 0.05;
      this.vy[j] = (Math.random() - 0.5) * 0.6 - this.vy[k] * 0.05;
      this.vz[j] = (Math.random() - 0.5) * 0.3;
      this.life[j] = 0;
      this.max[j] = 0.22 + Math.random() * 0.2;
      this.size[j] = this.size[k] * 0.55;
      this.alpha[j] = this.alpha[k] * 0.7;
      this.cr[j] = this.cr[k];
      this.cg[j] = this.cg[k];
      this.cb[j] = this.cb[k];
      this.seed[j] = Math.random();
      this.p0[j] = 3;
      this.p1[j] = 0;
      const o3 = j * 3;
      this.gPos[o3] = this.px[j];
      this.gPos[o3 + 1] = this.py[j];
      this.gPos[o3 + 2] = this.pz[j];
      const o4 = j * 4;
      this.gF[o4] = 0;
      this.gF[o4 + 1] = 0;
      this.gF[o4 + 2] = 0;
      this.gF[o4 + 3] = 0;
      this.gC[o3] = this.cr[j];
      this.gC[o3 + 1] = this.cg[j];
      this.gC[o3 + 2] = this.cb[j];
    }
    this.geo.setDrawRange(0, this.n);
    if (this.n > 0) {
      this.aPos.clearUpdateRanges();
      this.aPos.addUpdateRange(0, this.n * 3);
      this.aPos.needsUpdate = true;
      this.aF.clearUpdateRanges();
      this.aF.addUpdateRange(0, this.n * 4);
      this.aF.needsUpdate = true;
      this.aC.clearUpdateRanges();
      this.aC.addUpdateRange(0, this.n * 3);
      this.aC.needsUpdate = true;
    }
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}
