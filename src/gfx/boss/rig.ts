// Creature definition DSL: bones (2D pivots), layered SDF parts, detail strokes,
// key stars + constellation lines, anchors and a procedural animation function.
import type { CreatureId } from '../../logic/types';
import { catmullOpen, pCapsule, pCircle, pEllipse, pPoly, type Prim } from './sdf';

export interface BoneDef {
  name: string;
  parent: number;
  px: number;
  py: number;
}

/** Particle flow styles (handled in the vertex shader). */
export const enum Flow {
  None = 0,
  /** flickering upward licks (manes of fire) */
  Flame = 1,
  /** slow downward ooze */
  Drip = 2,
  /** soft wisps fluttering (fur, hair, mane) */
  Wisp = 3,
  /** stiff quivering spikes */
  Bristle = 4,
}

export interface PartOpts {
  /** draw order: higher parts occlude the rim of lower ones */
  layer: number;
  /** depth offset (negative = farther from camera) */
  z: number;
  /** smooth-union radius between the part's primitives */
  k: number;
  /** rim brightness multiplier */
  rim: number;
  /** brightness multiplier of rim segments lying inside lower parts (internal contours) */
  inner: number;
  /** fill density multiplier */
  fill: number;
  /** overall brightness multiplier (far limbs < 1) */
  bright: number;
  /** colour bias (+ = toward core white, - = toward accent) */
  tint: number;
  /** z inflation thickness */
  thick: number;
  flow: Flow;
  /** bone blend falloff (world units) */
  blend: number;
}

export interface PartDef extends PartOpts {
  name: string;
  prims: Prim[];
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface StrokeOpts {
  /** half width of the filament */
  w: number;
  bright: number;
  tint: number;
  /** particles per unit length multiplier */
  density: number;
  /** part name used for skinning (default: top-most part under each point) */
  part: string;
  z: number;
  /** 0 = constant width, 1 = taper to a point at the end */
  taper: number;
  flow: Flow;
  /** Catmull-Rom subdivisions (0 = polyline) */
  smooth: number;
}

export interface StrokeDef {
  pts: number[];
  w: number;
  bright: number;
  tint: number;
  density: number;
  part: number;
  z: number;
  taper: number;
  flow: Flow;
}

export interface StarDef {
  name: string;
  x: number;
  y: number;
  z: number;
  /** magnitude: 1 = normal key star, 1.5+ = major, <1 = minor */
  mag: number;
  /** stays golden regardless of palette */
  gold: boolean;
  part: number;
}

export interface Pt {
  x: number;
  y: number;
  z: number;
}

export interface AnimCtx {
  /** seconds */
  t: number;
  dt: number;
  /** -1..1 slow breathing sine */
  breath: number;
  /** -1 (wind-up / rear back) .. 1+ (full lunge) */
  lunge: number;
  /** 0..1 jaws open */
  mouth: number;
  /** 0..1 head raised, roaring */
  roar: number;
  /** 0..1 charging */
  charge: number;
  /** 0..1 recoil from a hit */
  hurt: number;
  /** 0..1 defensive stance */
  guard: number;
  /** 0..1 low HP sag */
  low: number;
  /** 0..1 volley pulses */
  volley: number;
  /** 0..1 draining */
  drain: number;
  /** 0..1 dying */
  dead: number;
  /** index of the current volley pulse (0..2) */
  pulseIdx: number;
  /** per-instance random 0..1 */
  seed: number;
}

export class Pose {
  readonly n: number;
  readonly rot: Float32Array;
  readonly ox: Float32Array;
  readonly oy: Float32Array;
  readonly oz: Float32Array;
  readonly sx: Float32Array;
  readonly sy: Float32Array;
  constructor(n: number) {
    this.n = n;
    this.rot = new Float32Array(n);
    this.ox = new Float32Array(n);
    this.oy = new Float32Array(n);
    this.oz = new Float32Array(n);
    this.sx = new Float32Array(n).fill(1);
    this.sy = new Float32Array(n).fill(1);
  }
  reset(): void {
    this.rot.fill(0);
    this.ox.fill(0);
    this.oy.fill(0);
    this.oz.fill(0);
    this.sx.fill(1);
    this.sy.fill(1);
  }
  /** add rotation (radians, CCW) */
  r(b: number, a: number): this {
    if (b >= 0) this.rot[b] += a;
    return this;
  }
  /** add offset */
  o(b: number, x: number, y: number, z = 0): this {
    if (b >= 0) {
      this.ox[b] += x;
      this.oy[b] += y;
      this.oz[b] += z;
    }
    return this;
  }
  /** multiply scale about the pivot */
  s(b: number, sx: number, sy = sx): this {
    if (b >= 0) {
      this.sx[b] *= sx;
      this.sy[b] *= sy;
    }
    return this;
  }
  /** traveling wave along a bone chain */
  wave(chain: number[], amp: number, t: number, speed: number, lag: number, ampGrow = 0): this {
    for (let i = 0; i < chain.length; i++) {
      this.rot[chain[i]] += amp * (1 + ampGrow * i) * Math.sin(t * speed - i * lag);
    }
    return this;
  }
  /** same rotation spread along a chain (curl) */
  curl(chain: number[], total: number): this {
    const per = total / Math.max(1, chain.length);
    for (const b of chain) this.rot[b] += per;
    return this;
  }
}

export type AnimateFn = (p: Pose, c: AnimCtx) => void;

export interface CreatureDef {
  id: CreatureId;
  bones: BoneDef[];
  parts: PartDef[];
  strokes: StrokeDef[];
  stars: StarDef[];
  /** flat pairs of star indices */
  lines: number[];
  core: Pt;
  head: Pt;
  /** projectile origins / drain targets */
  mouths: Pt[];
  /** drip emitters (stables) */
  drips: Pt[];
  animate: AnimateFn;
  /** star index order for the intro (default: as declared) */
  starOrder: number[];
  /** -1 = profile facing left (lunges drift toward -X), 0 = frontal */
  facing: number;
}

export const deg = Math.PI / 180;

/** smooth 0..1 pulse that fires every `period` seconds (offset by `phase`) lasting `dur` seconds */
export function pulse(t: number, period: number, phase: number, dur: number): number {
  const u = (((t + phase) % period) + period) % period;
  if (u > dur) return 0;
  return Math.sin((u / dur) * Math.PI);
}

const PART_DEFAULTS: PartOpts = {
  layer: 0,
  z: 0,
  k: 0.12,
  rim: 1,
  inner: 0.55,
  fill: 1,
  bright: 1,
  tint: 0,
  thick: 0.35,
  flow: Flow.None,
  blend: 0.12,
};

const STROKE_DEFAULTS: StrokeOpts = {
  w: 0.025,
  bright: 1,
  tint: 0.35,
  density: 1,
  part: '',
  z: 0.05,
  taper: 0,
  flow: Flow.None,
  smooth: 6,
};

/**
 * Authoring helper. Coordinates are in creature space: x right, y up, box ~[-5,5] x [-3.5,3.5].
 */
export class Builder {
  readonly bones: BoneDef[] = [{ name: 'root', parent: -1, px: 0, py: 0 }];
  readonly parts: PartDef[] = [];
  readonly strokes: (StrokeDef & { partName: string })[] = [];
  readonly stars: (StarDef & { partName: string })[] = [];
  readonly lines: number[] = [];
  core: Pt = { x: 0, y: 0, z: 0 };
  head: Pt = { x: 0, y: 0, z: 0 };
  readonly mouths: Pt[] = [];
  readonly drips: Pt[] = [];
  starOrder: number[] | null = null;
  /** -1 = profile facing left, 0 = frontal */
  facing = -1;
  readonly ROOT = 0;

  bone(name: string, parent: number, x: number, y: number): number {
    this.bones.push({ name, parent, px: x, py: y });
    return this.bones.length - 1;
  }

  /** one bone per segment of the polyline `pts` (flat x,y); bone i pivots at point i. */
  chain(name: string, parent: number, pts: number[]): number[] {
    const out: number[] = [];
    let par = parent;
    for (let i = 0; i < pts.length / 2 - 1; i++) {
      par = this.bone(`${name}${i}`, par, pts[i * 2], pts[i * 2 + 1]);
      out.push(par);
    }
    return out;
  }

  circle(b: number, x: number, y: number, r: number): Prim {
    return pCircle(b, x, y, r);
  }
  ell(b: number, x: number, y: number, rx: number, ry: number, angDeg = 0): Prim {
    return pEllipse(b, x, y, rx, ry, angDeg);
  }
  cap(b: number, ax: number, ay: number, bx: number, by: number, ra: number, rb = ra): Prim {
    return pCapsule(b, ax, ay, bx, by, ra, rb);
  }
  poly(b: number, pts: number[], r = 0, smooth = 0): Prim {
    return pPoly(b, pts, r, smooth);
  }
  tri(b: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number, r = 0.01): Prim {
    return pPoly(b, [ax, ay, bx, by, cx, cy], r, 0);
  }

  /**
   * Smooth tube through control points (flat x,y). `radii` = per control point radius, or [r0, r1].
   * `bones`: one bone, or one bone per control segment (e.g. from chain()).
   */
  tube(bones: number | number[], pts: number[], radii: number[], sub = 4): Prim[] {
    const n = pts.length / 2;
    const sm = catmullOpen(pts, sub);
    const m = sm.length / 2;
    const out: Prim[] = [];
    const rAt = (u: number) => {
      // u in [0, n-1]
      if (radii.length === n) {
        const i = Math.min(n - 2, Math.floor(u));
        const f = u - i;
        return radii[i] + (radii[i + 1] - radii[i]) * f;
      }
      const f = u / (n - 1);
      return radii[0] + (radii[radii.length - 1] - radii[0]) * f;
    };
    for (let i = 0; i < m - 1; i++) {
      const u0 = i / sub;
      const u1 = (i + 1) / sub;
      const seg = Math.min(n - 2, Math.floor(u0 + 1e-6));
      const b = Array.isArray(bones) ? bones[Math.min(bones.length - 1, seg)] : bones;
      out.push(pCapsule(b, sm[i * 2], sm[i * 2 + 1], sm[i * 2 + 2], sm[i * 2 + 3], rAt(u0), rAt(u1)));
    }
    return out;
  }

  part(name: string, opts: Partial<PartOpts>, ...prims: (Prim | Prim[])[]): number {
    const flat: Prim[] = [];
    for (const p of prims) {
      if (Array.isArray(p)) flat.push(...p);
      else flat.push(p);
    }
    const o: PartOpts = { ...PART_DEFAULTS, layer: this.parts.length, ...opts };
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const p of flat) {
      x0 = Math.min(x0, p.x0);
      y0 = Math.min(y0, p.y0);
      x1 = Math.max(x1, p.x1);
      y1 = Math.max(y1, p.y1);
    }
    this.parts.push({ name, prims: flat, x0, y0, x1, y1, ...o });
    return this.parts.length - 1;
  }

  /** detail filament (open polyline, flat x,y) */
  stroke(pts: number[], opts: Partial<StrokeOpts> = {}): void {
    const o: StrokeOpts = { ...STROKE_DEFAULTS, ...opts };
    const sm = o.smooth > 0 && pts.length >= 6 ? catmullOpen(pts, o.smooth) : pts.slice();
    this.strokes.push({
      pts: sm,
      w: o.w,
      bright: o.bright,
      tint: o.tint,
      density: o.density,
      part: -1,
      partName: o.part,
      z: o.z,
      taper: o.taper,
      flow: o.flow,
    });
  }

  star(name: string, x: number, y: number, mag = 1, opts: { z?: number; gold?: boolean; part?: string } = {}): number {
    this.stars.push({ name, x, y, z: opts.z ?? 0.15, mag, gold: !!opts.gold, part: -1, partName: opts.part ?? '' });
    return this.stars.length - 1;
  }

  /** connect stars by name along a path */
  link(...names: string[]): void {
    for (let i = 0; i < names.length - 1; i++) {
      const a = this.stars.findIndex((s) => s.name === names[i]);
      const b = this.stars.findIndex((s) => s.name === names[i + 1]);
      if (a < 0 || b < 0) throw new Error(`link: unknown star ${a < 0 ? names[i] : names[i + 1]}`);
      this.lines.push(a, b);
    }
  }

  /**
   * Uniformly scale (about the origin) then translate everything authored so far
   * (bones, primitives, strokes, stars, anchors). Call right before build() to fit a figure to the box.
   */
  scaleAll(s: number, dx = 0, dy = 0): void {
    const X = (x: number) => x * s + dx;
    const Y = (y: number) => y * s + dy;
    for (const b of this.bones) {
      if (b.parent < 0) continue;
      b.px = X(b.px);
      b.py = Y(b.py);
    }
    for (const part of this.parts) {
      for (const p of part.prims) {
        switch (p.kind) {
          case 0: // circle
            p.a = X(p.a);
            p.b = Y(p.b);
            p.c *= s;
            break;
          case 1: // ellipse
            p.a = X(p.a);
            p.b = Y(p.b);
            p.c *= s;
            p.d *= s;
            break;
          case 2: // capsule
            p.a = X(p.a);
            p.b = Y(p.b);
            p.c = X(p.c);
            p.d = Y(p.d);
            p.e *= s;
            p.f *= s;
            break;
          default: {
            const v = p.v!;
            for (let i = 0; i < v.length; i += 2) {
              v[i] = X(v[i]);
              v[i + 1] = Y(v[i + 1]);
            }
            p.c *= s;
          }
        }
        const x0 = X(p.x0);
        const x1 = X(p.x1);
        const y0 = Y(p.y0);
        const y1 = Y(p.y1);
        p.x0 = Math.min(x0, x1);
        p.x1 = Math.max(x0, x1);
        p.y0 = Math.min(y0, y1);
        p.y1 = Math.max(y0, y1);
      }
      const x0 = X(part.x0);
      const x1 = X(part.x1);
      const y0 = Y(part.y0);
      const y1 = Y(part.y1);
      part.x0 = Math.min(x0, x1);
      part.x1 = Math.max(x0, x1);
      part.y0 = Math.min(y0, y1);
      part.y1 = Math.max(y0, y1);
      part.k *= s;
      part.blend *= s;
      part.thick *= s;
    }
    for (const st of this.strokes) {
      for (let i = 0; i < st.pts.length; i += 2) {
        st.pts[i] = X(st.pts[i]);
        st.pts[i + 1] = Y(st.pts[i + 1]);
      }
      st.w *= s;
    }
    for (const st of this.stars) {
      st.x = X(st.x);
      st.y = Y(st.y);
    }
    for (const pt of new Set([this.core, this.head, ...this.mouths, ...this.drips])) {
      pt.x = X(pt.x);
      pt.y = Y(pt.y);
    }
  }

  build(id: CreatureId, animate: AnimateFn): CreatureDef {
    const partIdx = (n: string) => {
      if (!n) return -1;
      const i = this.parts.findIndex((p) => p.name === n);
      if (i < 0) throw new Error(`${id}: unknown part ${n}`);
      return i;
    };
    const strokes: StrokeDef[] = this.strokes.map(({ partName, ...s }) => ({ ...s, part: partIdx(partName) }));
    const stars: StarDef[] = this.stars.map(({ partName, ...s }) => ({ ...s, part: partIdx(partName) }));
    return {
      id,
      bones: this.bones,
      parts: this.parts,
      strokes,
      stars,
      lines: this.lines,
      core: this.core,
      head: this.head,
      mouths: this.mouths.length ? this.mouths : [this.head],
      drips: this.drips,
      animate,
      starOrder: this.starOrder ?? stars.map((_, i) => i),
      facing: this.facing,
    };
  }
}

/** helper: Pt */
export const P = (x: number, y: number, z = 0): Pt => ({ x, y, z });
