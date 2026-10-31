// Game-clock animation helpers: tweens and waits that respect game speed and hit-stop.

export type EaseFn = (t: number) => number;

export const Ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t: number) => t * t * t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  inQuart: (t: number) => t * t * t * t,
  outExpo: (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: (t: number) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  outSine: (t: number) => Math.sin((t * Math.PI) / 2),
  outBack: (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  inBack: (t: number) => {
    const c1 = 1.70158;
    return (c1 + 1) * t * t * t - c1 * t * t;
  },
  outElastic: (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
};

interface Job {
  t: number;
  dur: number;
  delay: number;
  fn: ((k: number) => void) | null;
  ease: EaseFn;
  resolve: () => void;
  real: boolean;
}

class Animator {
  /** user game-speed multiplier (1, 1.5, 2, 3) */
  speed = 1;
  /** remaining hit-stop (real seconds) */
  private hitstop = 0;
  private jobs: Job[] = [];
  /** scaled game time */
  time = 0;

  /** freeze the game clock briefly for impact feel */
  hitStop(seconds: number): void {
    this.hitstop = Math.max(this.hitstop, seconds);
  }

  get frozen(): boolean {
    return this.hitstop > 0;
  }

  /** returns scaled dt actually applied */
  update(dtReal: number): number {
    let dt = dtReal * this.speed;
    if (this.hitstop > 0) {
      this.hitstop -= dtReal;
      dt *= 0.04;
    }
    this.time += dt;
    const jobs = this.jobs;
    for (let i = 0; i < jobs.length; i++) {
      const j = jobs[i];
      const step = j.real ? dtReal : dt;
      if (j.delay > 0) {
        j.delay -= step;
        if (j.delay > 0) continue;
        j.t += -j.delay;
        j.delay = 0;
      } else {
        j.t += step;
      }
      const k = j.dur <= 0 ? 1 : Math.min(1, j.t / j.dur);
      if (j.fn) j.fn(j.ease(k));
      if (k >= 1) {
        jobs.splice(i, 1);
        i--;
        j.resolve();
      }
    }
    return dt;
  }

  tween(dur: number, fn: (k: number) => void, ease: EaseFn = Ease.outCubic, delay = 0): Promise<void> {
    return new Promise((resolve) => {
      fn(ease(0));
      this.jobs.push({ t: 0, dur, delay, fn, ease, resolve, real: false });
    });
  }

  /** tween on real time (UI that must not slow down with hit-stop / game speed) */
  tweenReal(dur: number, fn: (k: number) => void, ease: EaseFn = Ease.outCubic, delay = 0): Promise<void> {
    return new Promise((resolve) => {
      fn(ease(0));
      this.jobs.push({ t: 0, dur, delay, fn, ease, resolve, real: true });
    });
  }

  wait(seconds: number): Promise<void> {
    return new Promise((resolve) => {
      this.jobs.push({ t: 0, dur: seconds, delay: 0, fn: null, ease: Ease.linear, resolve, real: false });
    });
  }

  waitReal(seconds: number): Promise<void> {
    return new Promise((resolve) => {
      this.jobs.push({ t: 0, dur: seconds, delay: 0, fn: null, ease: Ease.linear, resolve, real: true });
    });
  }

  clear(): void {
    for (const j of this.jobs) j.resolve();
    this.jobs = [];
  }
}

export const anim = new Animator();

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Critically-damped spring step (frame-rate independent). */
export function springStep(x: number, v: number, target: number, omega: number, dt: number): [number, number] {
  const f = 1 + 2 * dt * omega;
  const oo = omega * omega;
  const hoo = dt * oo;
  const hhoo = dt * hoo;
  const detInv = 1 / (f + hhoo);
  const detX = f * x + dt * v + hhoo * target;
  const detV = v + hoo * (target - x);
  return [detX * detInv, detV * detInv];
}

/** Under-damped spring for bouncy wobble. zeta < 1 bounces. */
export function springStepZ(x: number, v: number, target: number, omega: number, zeta: number, dt: number): [number, number] {
  const n = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const a = -2 * zeta * omega * v - omega * omega * (x - target);
    v += a * h;
    x += v * h;
  }
  return [x, v];
}

export function formatNum(n: number): string {
  if (!isFinite(n)) return '∞';
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
  if (a >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
  if (a >= 1e5) return Math.round(n).toLocaleString('en-US');
  if (Number.isInteger(n)) return n.toLocaleString('en-US');
  return (Math.round(n * 10) / 10).toLocaleString('en-US');
}

export function formatMult(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}
