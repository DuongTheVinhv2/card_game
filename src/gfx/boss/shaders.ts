// GLSL for the constellation creature. All passes are additive, HDR (values > 1 bloom).

export const MAX_BONES = 64;

const COMMON = /* glsl */ `
vec3 hash3(float n) {
  return fract(sin(vec3(n, n + 1.731, n + 3.117) * vec3(127.13, 311.71, 74.73)) * 43758.5453);
}
vec3 palette3(float t, vec3 a, vec3 g, vec3 c) {
  t = clamp(t, 0.0, 2.0);
  return t < 1.0 ? mix(a, g, t) : mix(g, c, t - 1.0);
}
`;

/* ------------------------------------------------------------------ body particles */

export const BODY_VS = /* glsl */ `
#define MAX_BONES ${MAX_BONES}
uniform vec4 uBones[MAX_BONES * 2];
uniform float uTime;
uniform float uPx;
uniform float uSize;
uniform float uIntro;
uniform float uDeath;
uniform float uScatter;
uniform float uCharge;
uniform float uLow;
uniform float uGuard;
uniform float uDim;
uniform float uFlash;
uniform float uGain;
uniform float uBreath;
uniform float uMinPx;
uniform vec3 uCore;
uniform vec3 uColA;
uniform vec3 uColG;
uniform vec3 uColC;
uniform float uTypeGain[6];
attribute vec3 aSkin;
attribute vec4 aA; // size, bright, tint, seed
attribute vec4 aB; // type, reveal, flow, phase
varying vec3 vCol;
varying float vSharp;
${COMMON}
vec3 skinP(vec3 p, float bi) {
  int i = int(bi + 0.5) * 2;
  vec4 m = uBones[i];
  vec4 t = uBones[i + 1];
  return vec3(m.x * p.x + m.y * p.y + t.x, m.z * p.x + m.w * p.y + t.y, p.z + t.z);
}
void main() {
  float seed = aA.w;
  float type = aB.x;
  float ph = aB.w * 6.2831853;
  vec3 h3 = hash3(seed * 91.7 + aB.w * 13.1);
  vec3 p = position;
  float alpha = 1.0;
  // idle shimmer (types: 0 fill,1 rim,2 glow,3 halo,4 stroke,5 sparkle)
  float amp = type < 0.5 ? 0.03 : (type < 1.5 ? 0.006 : (type < 2.5 ? 0.03 : (type < 3.5 ? 0.09 : (type < 4.5 ? 0.006 : 0.02))));
  p.x += sin(uTime * (0.45 + seed * 0.8) + ph) * amp;
  p.y += cos(uTime * (0.38 + seed * 0.6) + ph * 1.3) * amp;
  float flow = aB.z;
  if (flow > 0.5) {
    if (flow < 1.5) {
      // flame licks: rise + flicker, looped
      float cyc = fract(uTime * (0.55 + seed * 0.7) + aB.w);
      float k = type < 1.5 && type > 0.5 ? 0.5 : 1.0;
      p.y += cyc * 0.34 * k;
      p.x += sin(uTime * 3.1 + ph + p.y * 3.0) * 0.05 * cyc + cyc * 0.08 * k;
      alpha *= 0.35 + 0.65 * sin(cyc * 3.14159);
    } else if (flow < 2.5) {
      float cyc = fract(uTime * (0.1 + seed * 0.12) + aB.w);
      p.y -= cyc * cyc * 0.45;
      alpha *= 1.0 - cyc * cyc;
    } else if (flow < 3.5) {
      p.x += sin(uTime * 1.6 + ph + p.y * 2.3) * 0.055;
      p.y += cos(uTime * 1.25 + ph + p.x * 2.1) * 0.04;
    } else {
      p.y += sin(uTime * 8.0 + ph) * 0.012;
      p.x += cos(uTime * 7.0 + ph) * 0.008;
    }
  }
  vec3 wp = mix(skinP(p, aSkin.x), skinP(p, aSkin.y), aSkin.z);

  vec3 rdir = normalize(h3 * 2.0 - 1.0 + vec3(1e-4));
  vec3 fc = wp - uCore;
  float dc = length(fc.xy);
  vec3 outDir = normalize(vec3(fc.xy / max(dc, 1e-3), 0.0) * 0.85 + rdir * 0.55);

  // hurt: scatter outward and spring back
  wp += outDir * uScatter * (0.25 + 0.75 * h3.x) * (0.45 + 0.55 * min(dc / 3.0, 1.0));
  // charge: converge toward the core + tremble
  wp.xy = mix(wp.xy, uCore.xy, uCharge * (0.02 + 0.09 * h3.y));
  wp += rdir * sin(uTime * 47.0 + seed * 120.0) * 0.018 * uCharge;
  // low HP: a fraction of particles drift away as debris
  if (h3.z < uLow * 0.28) {
    float cyc = fract(uTime * (0.09 + 0.08 * h3.x) + seed * 7.0);
    wp += (outDir + vec3(0.0, 0.35, 0.0)) * cyc * 1.8;
    alpha *= (1.0 - cyc) * smoothstep(0.0, 0.15, cyc) * 0.8;
  }
  // intro: unrevealed particles wait scattered, then converge
  float rv = smoothstep(aB.y, aB.y + 0.22, uIntro * 1.22);
  wp += outDir * (1.0 - rv) * (0.6 + 1.6 * h3.z);
  alpha *= rv;
  // death: explode into stardust
  if (uDeath > 0.0) {
    float d = max(0.0, uDeath - h3.x * 0.22);
    float sp = 1.6 + 5.5 * h3.y * h3.y;
    wp += outDir * sp * (1.0 - exp(-2.0 * d)) * 0.5;
    wp += rdir * d * (0.25 + 0.5 * h3.z);
    wp.y += d * d * 0.12;
    alpha *= exp(-d * (0.9 + 1.2 * h3.z)) * (1.0 + 2.5 * exp(-d * 6.0));
  }

  vec4 mv = modelViewMatrix * vec4(wp, 1.0);
  gl_Position = projectionMatrix * mv;

  int ti = int(type + 0.5);
  float b = aA.y * uTypeGain[ti] * uGain * alpha;
  float tint = aA.z;
  // twinkle sparkles
  if (type > 4.5) {
    float tw = 0.5 + 0.5 * sin(uTime * (1.5 + seed * 3.5) + ph);
    b *= 0.25 + 1.3 * tw * tw;
  }
  // guard: hardened, brighter whiter rim; a few outline stars glint
  if (type > 0.5 && type < 1.5) {
    b *= 1.0 + uGuard * 1.1;
    tint += uGuard * 0.55;
    if (seed > 0.86) {
      float g = 0.5 + 0.5 * sin(uTime * (1.7 + seed * 4.0) + ph);
      b *= 0.55 + 1.6 * g * g * g;
    }
  }
  b *= 1.0 + 0.07 * uBreath;
  // slow diagonal sheen sweeping across the figure (foil-card highlight)
  float sw = (position.x * 0.6 + position.y * 0.8) / 11.0;
  float swPh = fract(uTime * 0.11 + aSkin.x * 0.0) * 2.6 - 1.3;
  float band = exp(-pow((sw - swPh) * 9.0, 2.0));
  float sheen = (type > 0.5 && type < 1.5) || type > 3.5 ? 1.1 : 0.25;
  b *= 1.0 + sheen * band;
  tint += band * sheen * 0.35;
  // charge: the outline and filaments flare, the body stays readable
  b *= 1.0 + uCharge * ((type > 0.5 && type < 1.5) || type > 3.5 ? 0.55 : 0.12);
  tint += uCharge * 0.15;
  // low HP flicker
  float fl = fract(sin(floor(uTime * 11.0 + seed * 5.0) * 43.17 + seed * 91.0) * 917.31);
  b *= 1.0 - uLow * 0.7 * step(0.6, fl) * h3.y;
  // failing: the whole figure pulses weaker, unevenly
  b *= 1.0 - uLow * 0.22 * (0.5 + 0.5 * sin(uTime * 2.7 + p.x * 0.8));
  vec3 col = palette3(tint, uColA, uColG, uColC);
  col = mix(col, uColC * 1.6, uFlash * 0.7);
  b *= 1.0 + uFlash * 1.6;
  // ghost
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(col, vec3(lum) * vec3(0.8, 0.9, 1.2), uDim * 0.55);
  b *= mix(1.0, 0.09, uDim);

  float ps = aA.x * uSize * (1.0 + uCharge * 0.25 + abs(uScatter) * 0.4) * uPx / max(0.1, -mv.z);
  if (ps < uMinPx) {
    b *= (ps * ps) / (uMinPx * uMinPx);
    ps = uMinPx;
  }
  gl_PointSize = min(ps, 96.0);
  vSharp = (type > 0.5 && type < 1.5) || type > 3.5 ? 1.0 : 0.0;
  vCol = col * b;
}
`;

export const BODY_FS = /* glsl */ `
varying vec3 vCol;
varying float vSharp;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  float soft = exp(-r2 * 3.2) * (1.0 - r2);
  float sharp = exp(-r2 * 12.0) * 1.35 + 0.16 * (1.0 - r2);
  float a = mix(soft, sharp, vSharp);
  gl_FragColor = vec4(vCol * a, 0.0);
}
`;

/* ------------------------------------------------------------------ constellation lines (ribbons) */

export const LINE_VS = /* glsl */ `
attribute vec4 aL; // s (world dist along line), v (-1..1 across), alpha, tipDist
attribute float aE; // total segment length
varying vec4 vL;
varying float vE;
void main() {
  vL = aL;
  vE = aE;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const LINE_FS = /* glsl */ `
uniform vec3 uColG;
uniform vec3 uColC;
uniform float uTime;
uniform float uGain;
varying vec4 vL;
varying float vE;
void main() {
  float v = vL.y;
  float core = exp(-v * v * 26.0);
  float glow = exp(-v * v * 4.5) * max(0.0, 1.0 - v * v);
  float pulse = 0.82 + 0.18 * sin(vL.x * 3.0 - uTime * 2.6);
  float tip = exp(-max(vL.w, 0.0) * 9.0);
  // soft ends so the glow never stops abruptly next to a star
  float ends = smoothstep(0.0, 0.22, vL.x) * smoothstep(0.0, 0.22, vE - vL.x);
  vec3 col = mix(uColG, uColC, 0.22 + 0.4 * core) * (core * 1.05 + glow * 0.12) * pulse * (0.35 + 0.65 * ends);
  col += uColC * tip * (core * 4.0 + glow * 0.8);
  gl_FragColor = vec4(col * vL.z * uGain, 0.0);
}
`;

/* ------------------------------------------------------------------ key stars (flare billboards) */

export const STAR_VS = /* glsl */ `
attribute vec2 aCorner;
attribute vec4 aS;  // halfSize, intensity, rotation, gold
attribute vec4 aS2; // spikeLen, flash, seed, unused
varying vec2 vUv;
varying vec4 vS;
varying vec4 vS2;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float c = cos(aS.z);
  float s = sin(aS.z);
  vec2 rc = vec2(aCorner.x * c - aCorner.y * s, aCorner.x * s + aCorner.y * c);
  mv.xy += rc * aS.x;
  vUv = aCorner;
  vS = aS;
  vS2 = aS2;
  gl_Position = projectionMatrix * mv;
}
`;

export const STAR_FS = /* glsl */ `
uniform vec3 uColG;
uniform vec3 uColC;
uniform vec3 uGold;
uniform float uGain;
varying vec2 vUv;
varying vec4 vS;
varying vec4 vS2;
float spike(vec2 uv, float len, float thin) {
  float along = max(0.0, 1.0 - abs(uv.x) / len);
  return exp(-abs(uv.y) * thin) * along * along * along;
}
void main() {
  vec2 uv = vUv;
  float r2 = dot(uv, uv);
  if (r2 > 1.0) discard;
  float inten = vS.y;
  if (inten <= 0.001) discard;
  float sl = vS2.x;
  float core = exp(-r2 * 300.0) * 3.2 + exp(-r2 * 60.0) * 1.0;
  float halo = exp(-r2 * 10.0) * 0.22 * (1.0 - r2);
  vec2 d = mat2(0.7071, -0.7071, 0.7071, 0.7071) * uv;
  float sp = spike(uv, sl, 65.0) + spike(uv.yx, sl, 65.0);
  float sd = (spike(d, sl * 0.5, 80.0) + spike(d.yx, sl * 0.5, 80.0)) * 0.3;
  vec3 tintC = mix(uColC, uGold * 1.15, vS.w);
  vec3 tintG = mix(mix(uColG, uColC, 0.35), uGold, vS.w);
  vec3 col = tintC * core + tintG * (halo + (sp + sd) * 1.25);
  col *= 1.0 + vS2.y * 2.5;
  gl_FragColor = vec4(col * inten * uGain, 0.0);
}
`;

/* ------------------------------------------------------------------ fx sprites */

export const FX_VS = /* glsl */ `
uniform float uPx;
uniform float uMinPx;
attribute vec4 aF; // size, alpha, stretch, angle
attribute vec3 aC;
varying vec3 vCol;
varying vec2 vRot;
varying float vStr;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float ps = aF.x * (1.0 + aF.z) * uPx / max(0.1, -mv.z);
  float b = aF.y;
  if (ps < uMinPx) {
    b *= (ps * ps) / (uMinPx * uMinPx);
    ps = uMinPx;
  }
  gl_PointSize = min(ps, 128.0);
  vCol = aC * b;
  vRot = vec2(cos(aF.w), sin(aF.w));
  vStr = aF.z;
}
`;

export const FX_FS = /* glsl */ `
varying vec3 vCol;
varying vec2 vRot;
varying float vStr;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  c.y = -c.y;
  vec2 q = vec2(c.x * vRot.x + c.y * vRot.y, -c.x * vRot.y + c.y * vRot.x);
  q.y *= 1.0 + vStr;
  float r2 = dot(q, q);
  if (r2 > 1.0) discard;
  float a = exp(-r2 * 6.0) * 1.2 + 0.12 * (1.0 - r2);
  gl_FragColor = vec4(vCol * a, 0.0);
}
`;

/* ------------------------------------------------------------------ barrier (guard shell) */

export const QUAD_VS = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv * 2.0 - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const BARRIER_FS = /* glsl */ `
uniform float uGuard;
uniform float uTime;
uniform float uAspect;
uniform vec3 uColG;
uniform vec3 uColC;
uniform float uGain;
varying vec2 vUv;
float hexDist(vec2 p) {
  p = abs(p);
  return max(dot(p, normalize(vec2(1.0, 1.732))), p.x);
}
vec3 hexCell(vec2 uv) {
  vec2 r = vec2(1.0, 1.732);
  vec2 h = r * 0.5;
  vec2 a = mod(uv, r) - h;
  vec2 b = mod(uv - h, r) - h;
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  vec2 id = uv - g;
  return vec3(g, id.x * 3.1 + id.y * 7.7);
}
void main() {
  if (uGuard <= 0.001) discard;
  vec2 p = vUv;
  float e = length(p);
  if (e > 1.0) discard;
  float ang = atan(p.y, p.x);
  // thin bright shell edge + faint fresnel body
  float edgeBand = exp(-pow((1.0 - e) * 24.0, 2.0));
  float fres = pow(smoothstep(0.3, 1.0, e), 3.0);
  vec3 hc = hexCell(vec2(p.x * uAspect, p.y) * 6.5);
  float hd = hexDist(hc.xy);
  float lines = smoothstep(0.455, 0.497, hd);
  float sweep = pow(0.5 + 0.5 * sin(ang - uTime * 1.3 + e * 3.0), 4.0);
  float cell = 0.5 + 0.5 * sin(uTime * 2.1 + hc.z);
  float shimmer = 0.7 + 0.3 * sin(uTime * 6.0 + ang * 5.0);
  // the shell grows outward from the creature when raised
  float grow = smoothstep(0.0, 0.2, uGuard * 1.2 - e * 0.95 + 0.05);
  float inten = edgeBand * shimmer * 1.1 + fres * (0.05 + lines * (0.08 + 0.55 * sweep) * (0.45 + 0.55 * cell));
  vec3 col = mix(uColG, uColC, 0.35 + 0.45 * edgeBand) * inten * grow * uGuard * uGain;
  gl_FragColor = vec4(col, 0.0);
}
`;

export const AURA_FS = /* glsl */ `
uniform float uAmount;
uniform vec3 uColG;
uniform vec3 uColC;
varying vec2 vUv;
void main() {
  float r2 = dot(vUv, vUv);
  if (r2 > 1.0 || uAmount <= 0.001) discard;
  float a = exp(-r2 * 5.0) * (1.0 - r2) * 0.55 + exp(-r2 * 28.0) * 0.6;
  gl_FragColor = vec4(mix(uColG, uColC, exp(-r2 * 18.0)) * a * uAmount, 0.0);
}
`;

/* ------------------------------------------------------------------ backdrop nebula (faint cloud behind the figure) */

export const NEBULA_FS = /* glsl */ `
uniform vec3 uColA;
uniform vec3 uColG;
uniform float uAmount;
uniform float uTime;
uniform float uSeed;
varying vec2 vUv;
float nh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float nn(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(nh(i), nh(i + vec2(1.0, 0.0)), f.x), mix(nh(i + vec2(0.0, 1.0)), nh(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * nn(p);
    p = p * 2.03 + 7.1;
    a *= 0.5;
  }
  return s;
}
void main() {
  float e = length(vUv);
  if (e > 1.0 || uAmount <= 0.001) discard;
  float fall = smoothstep(1.0, 0.15, e);
  vec2 q = vUv * vec2(2.4, 2.0) + vec2(uSeed * 17.0, uSeed * 5.0);
  float n = fbm(q + vec2(uTime * 0.018, -uTime * 0.012));
  float n2 = fbm(q * 2.1 - n * 1.6 + vec2(-uTime * 0.01, uTime * 0.02));
  float neb = smoothstep(0.3, 0.9, n * 0.55 + n2 * 0.55);
  vec3 col = mix(uColA, uColG, n2 * 0.8) * neb * fall * fall;
  gl_FragColor = vec4(col * uAmount, 0.0);
}
`;
