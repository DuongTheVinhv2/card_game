export interface PopupOpts {
  dur?: number;
  rise?: string;
  rot?: number;
  scale?: number;
  delay?: number;
  color?: string;
  html?: boolean;
}

let layer: HTMLElement | null = null;
function getLayer(): HTMLElement {
  if (!layer) layer = document.getElementById('fx-layer')!;
  return layer;
}

/** Floating combat text at a screen position (css px). */
export function popup(x: number, y: number, text: string, cls: string, opts: PopupOpts = {}): HTMLElement {
  const el = document.createElement('div');
  el.className = `pop ${cls}`;
  if (opts.html) el.innerHTML = text;
  else el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  if (opts.dur) el.style.setProperty('--dur', `${opts.dur}s`);
  if (opts.rise) el.style.setProperty('--rise', opts.rise);
  if (opts.rot) el.style.setProperty('--rot', `${opts.rot}deg`);
  if (opts.color) el.style.setProperty('--elc', opts.color);
  if (opts.scale) el.style.setProperty('--s', String(opts.scale));
  if (opts.delay) el.style.animationDelay = `${opts.delay}s`;
  const remove = () => el.remove();
  el.addEventListener('animationend', remove);
  setTimeout(remove, ((opts.dur ?? 1.6) + (opts.delay ?? 0)) * 1000 + 600);
  getLayer().appendChild(el);
  return el;
}

/** Brief red (or custom) vignette flash over the whole screen. */
export function screenFlash(color = 'rgba(255, 30, 60, 0.55)', dur = 0.45): void {
  const f = document.getElementById('flash');
  if (!f) return;
  f.style.background = `radial-gradient(ellipse at center, rgba(0,0,0,0) 30%, ${color} 100%)`;
  f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur * 1000, easing: 'ease-out' });
}

export function centerFlash(color = 'rgba(255, 255, 255, 0.5)', dur = 0.25): void {
  const f = document.getElementById('flash');
  if (!f) return;
  f.style.background = color;
  f.animate([{ opacity: 1 }, { opacity: 0 }], { duration: dur * 1000, easing: 'ease-out' });
}
