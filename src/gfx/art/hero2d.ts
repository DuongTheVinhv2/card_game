/** Original Viking sprite variants, rendered as flat 2D artwork. */
import type { WeaponId } from '../../logic/weapons';
import { creatureArt } from './assets';
export { WEAPONS, type WeaponId } from '../../logic/weapons';
export function paintHero(weapon: WeaponId): HTMLCanvasElement {
  const source=creatureArt('heracles',weapon),cv=document.createElement('canvas');
  cv.width=1260;cv.height=840;const c=cv.getContext('2d')!;
  const scale=Math.min(1180/source.width,760/source.height),w=source.width*scale,h=source.height*scale;
  c.drawImage(source,(1260-w)/2,800-h,w,h);return cv;
}
