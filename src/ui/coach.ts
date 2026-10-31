import { h } from './dom';
import { audio } from '../audio/audio';

export interface CoachStep {
  title: string;
  text: string;
  /** target rect provider (css px) */
  target: () => DOMRect;
  side: 'top' | 'bottom' | 'left' | 'right';
}

/** Sequential guided callouts. Resolves when the player has dismissed every step (or skipped). */
export function runCoach(steps: CoachStep[]): Promise<void> {
  return new Promise((resolve) => {
    const layer = h('div', { class: 'coach-layer' });
    const ring = h('div', { class: 'coach-ring' });
    const bubble = h('div', { class: 'coach-bubble panel no-gems' });
    layer.append(ring, bubble);
    document.getElementById('app')!.appendChild(layer);
    let i = 0;
    const finish = () => {
      window.removeEventListener('resize', place);
      layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 250, fill: 'both' }).onfinish = () => layer.remove();
      resolve();
    };
    const place = () => {
      const s = steps[i];
      const r = s.target();
      const pad = 10;
      ring.style.left = `${r.left - pad}px`;
      ring.style.top = `${r.top - pad}px`;
      ring.style.width = `${r.width + pad * 2}px`;
      ring.style.height = `${r.height + pad * 2}px`;
      const bw = bubble.offsetWidth;
      const bh = bubble.offsetHeight;
      let x = r.left + r.width / 2 - bw / 2;
      let y = r.top + r.height / 2 - bh / 2;
      if (s.side === 'top') y = r.top - bh - 26;
      if (s.side === 'bottom') y = r.bottom + 26;
      if (s.side === 'left') x = r.left - bw - 26;
      if (s.side === 'right') x = r.right + 26;
      x = Math.max(12, Math.min(window.innerWidth - bw - 12, x));
      y = Math.max(12, Math.min(window.innerHeight - bh - 12, y));
      bubble.style.left = `${x}px`;
      bubble.style.top = `${y}px`;
      bubble.dataset.side = s.side;
    };
    const show = () => {
      const s = steps[i];
      bubble.innerHTML = '';
      bubble.append(
        h('div', { class: 'label', text: `Guidance · ${i + 1} / ${steps.length}` }),
        h('div', { class: 'title-gold coach-title', text: s.title }),
        h('div', { class: 'coach-text', html: s.text }),
        h('div', { class: 'coach-actions' },
          h('button', { class: 'btn dark small', text: 'Skip', on: { click: () => { audio.play('buttonSoft'); finish(); } } }),
          h('button', {
            class: 'btn small',
            text: i === steps.length - 1 ? 'Begin!' : 'Next',
            on: {
              click: () => {
                audio.play('button');
                i++;
                if (i >= steps.length) finish();
                else show();
              },
            },
          }),
        ),
      );
      requestAnimationFrame(place);
      bubble.animate([{ opacity: 0, transform: 'translateY(0.6rem)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'ease-out' });
    };
    window.addEventListener('resize', place);
    show();
  });
}
