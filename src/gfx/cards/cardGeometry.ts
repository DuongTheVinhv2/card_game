import * as THREE from 'three';

export const CARD_W = 1;
export const CARD_H = 1.4;
export const CARD_R = 0.075;
export const CARD_T = 0;

function roundedRectPoints(w: number, h: number, r: number, seg = 10): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const hw = w / 2;
  const hh = h / 2;
  const corners: Array<[number, number, number]> = [
    [hw - r, hh - r, 0],
    [-hw + r, hh - r, Math.PI / 2],
    [-hw + r, -hh + r, Math.PI],
    [hw - r, -hh + r, (3 * Math.PI) / 2],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
  }
  return pts;
}

let cached: THREE.BufferGeometry | null = null;

/** Single rounded 2D face. CardView swaps front/back material during a flat squash. */
export function getCardGeometry(): THREE.BufferGeometry {
  if (cached) return cached;
  const flat = new THREE.Shape(roundedRectPoints(CARD_W, CARD_H, CARD_R));
  cached = new THREE.ShapeGeometry(flat, 1);
  const flatPos = cached.attributes.position;
  const flatUv = cached.attributes.uv;
  for (let i = 0; i < flatPos.count; i++) flatUv.setXY(i, flatPos.getX(i) / CARD_W + .5, flatPos.getY(i) / CARD_H + .5);
  cached.clearGroups(); cached.addGroup(0, cached.index?.count ?? flatPos.count, 0);
  return cached;
}

let shadowTex: THREE.Texture | null = null;
/** Soft blurred rounded-rect used as a fake contact shadow under cards. */
export function getShadowTexture(): THREE.Texture {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 160;
  const g = c.getContext('2d')!;
  g.filter = 'blur(12px)';
  g.fillStyle = 'rgba(0,0,0,1)';
  const pad = 26;
  const w = c.width - pad * 2;
  const h = c.height - pad * 2;
  g.beginPath();
  g.roundRect(pad, pad, w, h, 8);
  g.fill();
  shadowTex = new THREE.CanvasTexture(c);
  shadowTex.colorSpace = THREE.SRGBColorSpace;
  return shadowTex;
}
