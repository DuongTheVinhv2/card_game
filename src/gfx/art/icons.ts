// DODEKATHLOS icon set: bold silhouettes in a 0..100 viewBox (nonzero fill).
// Geometry is authored in ./iconDefs.ts with the tiny vector kit in ./pathKit.ts.

import { ICON_DEFS } from './iconDefs';

export const ICON_NAMES = [
  // elements / suits
  'fire', 'water', 'wind', 'earth',
  // stats & UI
  'hp', 'def', 'atk', 'shield', 'gold', 'discard', 'deck', 'power', 'mult', 'pierce', 'heal', 'settings', 'info',
  'speed', 'sound', 'close', 'reroll', 'skull', 'laurel', 'temple', 'amphora', 'star', 'lock', 'check', 'arrowRight', 'club',
  // boss intents
  'intentStrike', 'intentHeavy', 'intentVolley', 'intentGuard', 'intentRoar', 'intentDrain', 'intentCurse',
  // boons
  'thunderbolt', 'ember', 'trident', 'aeolus', 'gaia', 'owl', 'sandals', 'nike', 'twins', 'hecate', 'amphora2', 'artemis',
  'lyre', 'mirror', 'fleece', 'achilles', 'aegis', 'asclepius', 'pandora', 'icarus', 'hades', 'ares', 'atlas', 'ariadne',
  'chiron', 'eris', 'harmonia', 'tyche', 'kronos', 'nemesis', 'persephone', 'cyclops', 'medusa', 'minotaur', 'hermes', 'olympus',
  // scrolls & patrons
  'caduceus', 'sun', 'hammer', 'chisel', 'shears', 'chalice', 'gem', 'coin', 'peacock', 'wheat', 'bident', 'dove',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

function build(): Record<IconName, string> {
  const out = {} as Record<IconName, string>;
  for (const n of ICON_NAMES) out[n] = ICON_DEFS[n]().d();
  return out;
}

/** SVG path data in a 0..100 x 0..100 viewBox, nonzero fill, bold silhouette style (multiple subpaths OK). */
export const ICON_PATHS: Record<IconName, string> = build();

export function isIconName(s: string): s is IconName {
  return (ICON_PATHS as Record<string, string>)[s] !== undefined;
}

/** inline <svg> markup for HTML UI */
export function iconSVG(
  name: IconName,
  opts: { color?: string; size?: number | string; className?: string; glow?: string } = {},
): string {
  const size = opts.size ?? '1em';
  const sz = typeof size === 'number' ? `${size}px` : size;
  const color = opts.color ?? 'currentColor';
  const cls = opts.className ? ` class="${opts.className}"` : '';
  const style = opts.glow ? ` style="filter:drop-shadow(0 0 0.12em ${opts.glow}) drop-shadow(0 0 0.04em ${opts.glow});overflow:visible"` : '';
  return (
    `<svg${cls} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${sz}" height="${sz}"${style} aria-hidden="true" focusable="false">` +
    `<path fill="${color}" d="${ICON_PATHS[name]}"/></svg>`
  );
}

const p2dCache = new Map<IconName, Path2D>();
/** cached Path2D (0..100 space) for an icon */
export function iconPath2D(name: IconName): Path2D {
  let p = p2dCache.get(name);
  if (!p) {
    p = new Path2D(ICON_PATHS[name]);
    p2dCache.set(name, p);
  }
  return p;
}

/** Icon path placed at (x,y) with box `size`, in the caller's coordinate space. */
export function iconPathAt(name: IconName, x: number, y: number, size: number): Path2D {
  const s = size / 100;
  const tp = new Path2D();
  tp.addPath(iconPath2D(name), { a: s, b: 0, c: 0, d: s, e: x, f: y });
  return tp;
}

/**
 * canvas drawing, (x,y) = top-left, size = box size.
 * Gradients are interpreted in the caller's canvas coordinates (not icon space).
 * `strokeWidth` (px) is an outline drawn outside the silhouette (behind the fill).
 */
export function drawIcon(
  ctx: CanvasRenderingContext2D,
  name: IconName,
  x: number,
  y: number,
  size: number,
  fill: string | CanvasGradient,
  opts: { stroke?: string; strokeWidth?: number; shadow?: string; shadowBlur?: number } = {},
): void {
  const p = iconPathAt(name, x, y, size);
  ctx.save();
  if (opts.shadow) {
    ctx.shadowColor = opts.shadow;
    ctx.shadowBlur = opts.shadowBlur ?? size * 0.12;
  }
  if (opts.stroke) {
    // stroke first (behind the fill) so the silhouette keeps its weight
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = opts.stroke;
    ctx.lineWidth = (opts.strokeWidth ?? 2) * 2;
    ctx.stroke(p);
    ctx.shadowColor = 'transparent';
  }
  ctx.fillStyle = fill;
  ctx.fill(p);
  ctx.restore();
}
