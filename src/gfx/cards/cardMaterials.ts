import * as THREE from 'three';
import { CARD_W, CARD_H, CARD_R } from './cardGeometry';

const vert = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const common = /* glsl */ `
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm3(vec2 p) { return vnoise(p) * 0.55 + vnoise(p * 2.1 + 7.0) * 0.3 + vnoise(p * 4.3 + 3.0) * 0.15; }
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
float sdRoundRect(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
`;

const frontFrag = /* glsl */ `
uniform sampler2D map;
uniform sampler2D uMask;
uniform float uHasMask;
uniform float uTime;
uniform float uHover;
uniform float uSelect;
uniform float uHighlight;
uniform float uFlash;
uniform float uHex;
uniform float uDim;
uniform float uDissolve;
uniform float uFoil;
uniform float uSeed;
uniform vec2 uTilt;
uniform vec3 uGlow;
uniform vec3 uCardSize;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
${common}
void main() {
  vec4 tex = texture2D(map, vUv);
  vec3 col = tex.rgb;
  vec3 N = normalize(vN);
  vec3 V = normalize(vV);
  vec3 L = normalize(vec3(-0.35, 0.55, 0.9));
  float diff = clamp(dot(N, L), 0.0, 1.0);
  col *= 0.8 + 0.26 * diff;

  // glossy coat
  vec3 H = normalize(L + V);
  float spec = pow(clamp(dot(N, H), 0.0, 1.0), 60.0);
  float stripe = vUv.x * 0.75 + vUv.y * 0.35 + uTilt.x * 1.1 - uTilt.y * 0.8 + uSeed;
  float glint = smoothstep(0.09, 0.0, abs(fract(stripe * 0.5) - 0.5));
  col += vec3(1.0, 0.96, 0.88) * (spec * 0.22 + glint * 0.06 * (0.35 + uHover));

  float lum = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
  float ang = dot(V, vec3(1.0, 0.6, 0.0)) * 2.4 + (vUv.x + vUv.y) * 2.2 + uTilt.x * 2.6 + uTilt.y * 1.9;
  // painter-supplied foil mask keeps ranks, pips and figures crisp
  float fm = uHasMask > 0.5 ? texture2D(uMask, vUv).r : smoothstep(0.25, 0.85, lum);
  if (uFoil > 0.5 && uFoil < 1.5) {
    // DIVINE — holographic foil: fine diffraction lines, cool rainbow
    float lines = 0.5 + 0.5 * sin((vUv.x * 55.0 - vUv.y * 38.0) + ang * 6.0);
    vec3 holo = hsv2rgb(vec3(fract(ang * 0.22 + 0.5 + lines * 0.06), 0.5, 1.0));
    float amt = (0.26 + 0.3 * lines) * fm;
    col = mix(col, col * 0.55 + holo * 0.75, amt);
  } else if (uFoil > 1.5 && uFoil < 2.5) {
    // OLYMPIAN — polychrome: saturated full-spectrum wash
    vec3 rainbow = hsv2rgb(vec3(fract(ang * 0.3 + vUv.y * 0.7 + uTime * 0.03), 0.7, 1.0));
    col = mix(col, col * rainbow * 1.55, 0.18 + 0.42 * fm);
    col += rainbow * 0.1 * fm;
  } else if (uFoil > 2.5) {
    // CRYSTAL — cool glassy tint with caustic sparkle
    float caus = fbm3(vUv * 6.0 + vec2(uTilt.x, uTilt.y) * 2.0 + uTime * 0.05);
    float sparkle = pow(vnoise(vUv * 120.0 + uTilt * 30.0), 18.0) * 6.0;
    col = mix(col, col * vec3(0.75, 0.95, 1.15) + vec3(0.05, 0.12, 0.18), 0.25 + 0.35 * fm);
    col += vec3(0.6, 0.9, 1.0) * (smoothstep(0.55, 0.8, caus) * 0.25 + sparkle) * (0.3 + 0.7 * fm);
  }

  // rim glow (selection / scoring highlight)
  vec2 p = (vUv - 0.5) * uCardSize.xy;
  float d = sdRoundRect(p, uCardSize.xy * 0.5, uCardSize.z);
  float rim = smoothstep(-0.07, 0.0, d);
  col += uGlow * rim * (uSelect * 0.9 + uHighlight * 2.4);
  col += uGlow * uHighlight * 0.12;

  // hex (Augean filth / curses): dark sludge with sickly veins
  if (uHex > 0.001) {
    float n = fbm3(vUv * 5.0 + vec2(0.0, uTime * 0.05));
    float veins = smoothstep(0.03, 0.0, abs(n - 0.5)) ;
    vec3 sludge = mix(vec3(0.05, 0.04, 0.03), vec3(0.16, 0.12, 0.06), n);
    vec3 hexed = mix(col * 0.25, sludge, 0.75) + vec3(0.5, 0.9, 0.2) * veins * 0.6;
    col = mix(col, hexed, uHex * 0.85);
  }

  col *= 1.0 - uDim * 0.55;
  col = mix(col, vec3(1.7, 1.6, 1.4), uFlash);

  if (uDissolve > 0.001) {
    float n = fbm3(vUv * 7.0 + uSeed * 10.0);
    if (n < uDissolve * 1.1 - 0.05) discard;
    float e = smoothstep(uDissolve * 1.1 + 0.06, uDissolve * 1.1 - 0.05, n);
    col += uGlow * e * 4.0;
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const backFrag = /* glsl */ `
uniform sampler2D map;
uniform float uTime;
uniform vec2 uTilt;
uniform float uDissolve;
uniform vec3 uGlow;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
${common}
void main() {
  vec4 tex = texture2D(map, vUv);
  vec3 col = tex.rgb;
  vec3 N = normalize(vN);
  vec3 V = normalize(vV);
  vec3 L = normalize(vec3(-0.35, 0.55, 0.9));
  col *= 0.8 + 0.26 * clamp(dot(N, L), 0.0, 1.0);
  vec3 H = normalize(L + V);
  col += vec3(1.0, 0.92, 0.75) * pow(clamp(dot(N, H), 0.0, 1.0), 50.0) * 0.25;
  // gold leaf shimmer on bright (gold) pixels
  float lum = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
  float gold = smoothstep(0.35, 0.75, tex.r - tex.b * 0.6);
  float sh = 0.5 + 0.5 * sin((vUv.x + vUv.y) * 9.0 + uTilt.x * 5.0 + uTime * 0.7);
  col += vec3(1.0, 0.8, 0.45) * gold * sh * 0.18;
  if (uDissolve > 0.001) {
    float n = fbm3(vUv * 7.0);
    if (n < uDissolve * 1.1 - 0.05) discard;
    col += uGlow * smoothstep(uDissolve * 1.1 + 0.06, uDissolve * 1.1 - 0.05, n) * 4.0;
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const edgeFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uDissolve;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
void main() {
  if (uDissolve > 0.6) discard;
  vec3 N = normalize(vN);
  float l = 0.55 + 0.45 * clamp(dot(N, normalize(vec3(-0.3, 0.6, 0.5))), 0.0, 1.0);
  gl_FragColor = vec4(uColor * l, 1.0);
}`;

export type FoilKind = 0 | 1 | 2 | 3;

export interface FrontUniforms {
  [k: string]: THREE.IUniform;
  map: THREE.IUniform<THREE.Texture | null>;
  uMask: THREE.IUniform<THREE.Texture | null>;
  uHasMask: THREE.IUniform<number>;
  uTime: THREE.IUniform<number>;
  uHover: THREE.IUniform<number>;
  uSelect: THREE.IUniform<number>;
  uHighlight: THREE.IUniform<number>;
  uFlash: THREE.IUniform<number>;
  uHex: THREE.IUniform<number>;
  uDim: THREE.IUniform<number>;
  uDissolve: THREE.IUniform<number>;
  uFoil: THREE.IUniform<number>;
  uSeed: THREE.IUniform<number>;
  uTilt: THREE.IUniform<THREE.Vector2>;
  uGlow: THREE.IUniform<THREE.Color>;
  uCardSize: THREE.IUniform<THREE.Vector3>;
}

export function createFrontMaterial(): THREE.ShaderMaterial & { uniforms: FrontUniforms } {
  const uniforms: FrontUniforms = {
    map: { value: null },
    uMask: { value: null },
    uHasMask: { value: 0 },
    uTime: { value: 0 },
    uHover: { value: 0 },
    uSelect: { value: 0 },
    uHighlight: { value: 0 },
    uFlash: { value: 0 },
    uHex: { value: 0 },
    uDim: { value: 0 },
    uDissolve: { value: 0 },
    uFoil: { value: 0 },
    uSeed: { value: Math.random() },
    uTilt: { value: new THREE.Vector2() },
    uGlow: { value: new THREE.Color(1.0, 0.8, 0.45) },
    uCardSize: { value: new THREE.Vector3(CARD_W, CARD_H, CARD_R) },
  };
  return new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frontFrag, uniforms }) as THREE.ShaderMaterial & {
    uniforms: FrontUniforms;
  };
}

export interface BackUniforms {
  [k: string]: THREE.IUniform;
  map: THREE.IUniform<THREE.Texture | null>;
  uTime: THREE.IUniform<number>;
  uTilt: THREE.IUniform<THREE.Vector2>;
  uDissolve: THREE.IUniform<number>;
  uGlow: THREE.IUniform<THREE.Color>;
}

export function createBackMaterial(tex: THREE.Texture): THREE.ShaderMaterial & { uniforms: BackUniforms } {
  const uniforms: BackUniforms = {
    map: { value: tex },
    uTime: { value: 0 },
    uTilt: { value: new THREE.Vector2() },
    uDissolve: { value: 0 },
    uGlow: { value: new THREE.Color(1.0, 0.8, 0.45) },
  };
  return new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: backFrag, uniforms }) as THREE.ShaderMaterial & {
    uniforms: BackUniforms;
  };
}

export function createEdgeMaterial(color: THREE.ColorRepresentation = '#cdb88a'): THREE.ShaderMaterial & {
  uniforms: { uColor: THREE.IUniform<THREE.Color>; uDissolve: THREE.IUniform<number> };
} {
  const uniforms = { uColor: { value: new THREE.Color(color) }, uDissolve: { value: 0 } };
  return new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: edgeFrag, uniforms }) as THREE.ShaderMaterial & {
    uniforms: { uColor: THREE.IUniform<THREE.Color>; uDissolve: THREE.IUniform<number> };
  };
}
