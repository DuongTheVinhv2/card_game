import { h } from './dom';
import { icon, cardArt } from './art';
import type { App } from '../app/App';
import type { BattleState } from '../logic/battle';
import type { RunState } from '../logic/run';
import { HAND_INFO, handBase } from '../logic/hands';
import { HAND_ORDER, ELEMENTS } from '../logic/types';
import type { Card } from '../logic/types';
import { ELEMENT_INFO, BEATS } from '../logic/elements';
import { audio } from '../audio/audio';
import { tooltip } from './tooltip';
import { cardName } from '../logic/cards';

export function openModal(content: HTMLElement, opts: { onClose?: () => void; closeOnBack?: boolean } = {}): () => void {
  tooltip.hide();
  const back = h('div', { class: 'modal-back' });
  const close = () => {
    back.remove();
    opts.onClose?.();
  };
  back.addEventListener('pointerdown', (e) => {
    if (e.target === back && opts.closeOnBack !== false) {
      audio.play('buttonSoft');
      close();
    }
  });
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
      window.removeEventListener('keydown', onKey, true);
    }
  };
  window.addEventListener('keydown', onKey, true);
  back.appendChild(content);
  document.getElementById('app')!.appendChild(back);
  return () => {
    window.removeEventListener('keydown', onKey, true);
    close();
  };
}

function seg(label: string, values: Array<[string, unknown]>, current: unknown, onPick: (v: unknown) => void): HTMLElement {
  const row = h('div', { class: 'opt-row' }, h('div', { class: 'opt-label', text: label }));
  const btns = h('div', { class: 'seg' });
  for (const [txt, v] of values) {
    const b = h('button', { class: `seg-btn ${v === current ? 'on' : ''}`, text: txt });
    b.addEventListener('click', () => {
      audio.play('button');
      btns.querySelectorAll('.seg-btn').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      onPick(v);
    });
    btns.appendChild(b);
  }
  row.appendChild(btns);
  return row;
}

function slider(label: string, value: number, onInput: (v: number) => void): HTMLElement {
  const input = h('input', { attrs: { type: 'range', min: '0', max: '100', value: String(Math.round(value * 100)) }, class: 'range' }) as HTMLInputElement;
  const out = h('span', { class: 'range-v', text: `${Math.round(value * 100)}` });
  input.addEventListener('input', () => {
    out.textContent = input.value;
    onInput(Number(input.value) / 100);
  });
  return h('div', { class: 'opt-row' }, h('div', { class: 'opt-label', text: label }), h('div', { class: 'range-wrap' }, input, out));
}

export function openOptions(app: App, o: { inRun: boolean; onQuit?: () => void }): void {
  const s = app.settings;
  let close: () => void = () => undefined;
  const panel = h('div', { class: 'panel modal options' },
    h('h2', { class: 'title-gold', text: 'Options' }),
    h('div', { class: 'meander', style: 'margin:0 0 1rem' }),
    seg('Game speed', [['1×', 1], ['1.5×', 1.5], ['2×', 2], ['3×', 3]], s.speed, (v) => {
      s.speed = v as number;
      app.saveSettings();
    }),
    seg('Screen shake', [['On', true], ['Off', false]], s.shake, (v) => {
      s.shake = v as boolean;
      app.saveSettings();
    }),
    seg('Graphics', [['High', 2], ['Low', 1]], s.quality >= 2 ? 2 : 1, (v) => {
      s.quality = v as number;
      app.saveSettings();
      const note = document.querySelector('.opt-note') as HTMLElement | null;
      if (note) note.textContent = 'Graphics change applies after reloading the page.';
    }),
    h('div', { class: 'opt-note tt-dim', style: 'font-size:.75rem;text-align:right;min-height:1em' }),
    slider('Master volume', audio.getVolume('master'), (v) => audio.setVolume('master', v)),
    slider('Music', audio.getVolume('music'), (v) => audio.setVolume('music', v)),
    slider('Effects', audio.getVolume('sfx'), (v) => audio.setVolume('sfx', v)),
    h('div', { class: 'actions' },
      h('button', { class: 'btn blue small', text: 'How to play', on: { click: () => { audio.play('button'); openHowToPlay(); } } }),
      o.inRun
        ? h('button', {
            class: 'btn red small',
            text: 'Abandon run',
            on: {
              click: () => {
                audio.play('button');
                confirmBox('Abandon this run?', 'Your progress in the current run will be lost.', 'Abandon', () => {
                  close();
                  void import('../app/screens/EndScreen').then(({ EndScreen }) => app.go(new EndScreen(app, 'defeat', 'Abandoned')));
                });
              },
            },
          })
        : null,
      h('button', { class: 'btn small', text: 'Resume', on: { click: () => { audio.play('button'); close(); } } }),
    ),
  );
  close = openModal(panel);
}

export function confirmBox(title: string, body: string, okText: string, onOk: () => void): void {
  let close: () => void = () => undefined;
  const panel = h('div', { class: 'panel modal', style: 'max-width:28rem;text-align:center' },
    h('h2', { class: 'title-gold', text: title }),
    h('p', { text: body, style: 'color:var(--muted)' }),
    h('div', { class: 'actions' },
      h('button', { class: 'btn dark small', text: 'Cancel', on: { click: () => close() } }),
      h('button', { class: 'btn red small', text: okText, on: { click: () => { close(); onOk(); } } }),
    ),
  );
  close = openModal(panel);
}

export function openDeckViewer(app: App, b: BattleState | null): void {
  const run = app.run!;
  const inDraw = new Set(b ? b.draw.map((c) => c.id) : run.deck.map((c) => c.id));
  const grid = h('div', { class: 'deck-grid' });
  for (const el of ELEMENTS) {
    const cards = run.deck.filter((c) => c.element === el).sort((a, c) => c.rank - a.rank);
    const row = h('div', { class: 'deck-row' }, h('div', { class: `deck-row-label el-${el}`, html: `${icon(el)}<span>${cards.length}</span>` }));
    const cardsEl = h('div', { class: 'deck-cards' });
    for (const c of cards) {
      const img = h('img', { class: `deck-card ${inDraw.has(c.id) ? '' : 'gone'}`, attrs: { src: cardArt(c), alt: cardName(c) } });
      tooltip.attach(img, () => `<div class="tt-title">${cardName(c as Card)}</div>${c.enh !== 'none' ? `<div class="tt-row">${c.enh}</div>` : ''}`);
      cardsEl.appendChild(img);
    }
    row.appendChild(cardsEl);
    grid.appendChild(row);
  }
  let close: () => void = () => undefined;
  const panel = h('div', { class: 'panel modal deck-modal' },
    h('h2', { class: 'title-gold', text: `Your Deck · ${run.deck.length} cards` }),
    b ? h('div', { class: 'label', style: 'text-align:center;margin-bottom:.8rem', text: `${b.draw.length} remaining in the draw pile · dimmed cards are spent this cycle` }) : null,
    grid,
    h('div', { class: 'actions' }, h('button', { class: 'btn small', text: 'Close', on: { click: () => close() } })),
  );
  close = openModal(panel);
}

export function handsTableEl(run: RunState): HTMLElement {
  const t = h('table', { class: 'hands-table' });
  t.appendChild(h('tr', null, h('th', { text: 'Hand' }), h('th', { text: 'Lv' }), h('th', { text: 'Power × Mult' }), h('th', { text: 'Played' }), h('th', { text: 'Constellation' })));
  for (const ht of HAND_ORDER.slice().reverse()) {
    const lv = run.handLevels[ht];
    const base = handBase(ht, lv);
    const tr = h('tr', null,
      h('td', { html: `<b>${HAND_INFO[ht].name}</b><div class="tt-dim" style="font-size:.75rem">${HAND_INFO[ht].desc}</div>` }),
      h('td', { html: `<span class="lv-badge">${lv}</span>` }),
      h('td', { html: `<span class="mini-box power">${base.power}</span> × <span class="mini-box mult">${base.mult}</span>` }),
      h('td', { text: String(run.handPlays[ht]) }),
      h('td', { class: 'tt-dim', text: HAND_INFO[ht].constellation }),
    );
    t.appendChild(tr);
  }
  return t;
}

export function openHandsTable(run: RunState): void {
  let close: () => void = () => undefined;
  const panel = h('div', { class: 'panel modal' },
    h('h2', { class: 'title-gold', text: 'Poker Hands' }),
    h('div', { class: 'label', style: 'text-align:center;margin-bottom:.8rem', text: 'Only scoring cards add their Power · Constellations raise a hand’s level' }),
    handsTableEl(run),
    h('div', { class: 'actions' }, h('button', { class: 'btn small', text: 'Close', on: { click: () => close() } })),
  );
  close = openModal(panel);
}

export function elementCycleSVG(size = 15): string {
  // Water ▶ Fire ▶ Wind ▶ Earth ▶ Water arranged in a diamond
  const pos: Record<string, [number, number]> = { water: [50, 10], fire: [90, 50], wind: [50, 90], earth: [10, 50] };
  const order = ['water', 'fire', 'wind', 'earth'];
  let arrows = '';
  for (let i = 0; i < 4; i++) {
    const a = pos[order[i]];
    const b = pos[order[(i + 1) % 4]];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    const x1 = a[0] + ux * 15;
    const y1 = a[1] + uy * 15;
    const x2 = b[0] - ux * 15;
    const y2 = b[1] - uy * 15;
    arrows += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#e8c27a" stroke-width="1.6" marker-end="url(#ah)" opacity=".85"/>`;
  }
  const icons = order
    .map((el) => {
      const [x, y] = pos[el];
      return `<div class="cyc-ico el-${el}" style="left:${x}%;top:${y}%">${icon(el)}<span>${ELEMENT_INFO[el as keyof typeof ELEMENT_INFO].name}</span></div>`;
    })
    .join('');
  return `<div class="cycle" style="width:${size}rem;height:${size}rem"><svg viewBox="0 0 100 100"><defs><marker id="ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#e8c27a"/></marker></defs>${arrows}</svg>${icons}</div>`;
}

export function openHowToPlay(onDone?: () => void): void {
  let close: () => void = () => undefined;
  const sigs = ELEMENTS.map(
    (el) =>
      `<div class="sig-row"><span class="chip-mini el-${el}">${icon(el)}${ELEMENT_INFO[el].name}</span><b>${ELEMENT_INFO[el].signature}</b> — ${ELEMENT_INFO[el].sigDesc} <span class="tt-dim">(${ELEMENT_INFO[el].verbBeats})</span></div>`,
  ).join('');
  const panel = h('div', { class: 'panel modal howto' },
    h('h2', { class: 'title-gold', text: 'The Labors of Heracles' }),
    h('div', { class: 'meander', style: 'margin:0 0 1rem' }),
    h('div', {
      class: 'howto-grid',
      html: `
      <section>
        <h3>The Goal</h3>
        <p>Defeat <b>three Labors</b> — monsters drawn from the Twelve Labors of Heracles. Each foe has <b>HP</b>, <b>DEF</b> and <b>ATK</b>. So do you. Whoever falls to 0 HP first loses.</p>
        <h3>Your Turn</h3>
        <p>Select up to <b>5 cards</b> and <b>Play</b> them as a poker hand, or <b>Discard</b> them to draw new ones (discards don't end your turn; +1 regenerates each turn). After every hand you play, the foe acts — its <b>intent</b> is shown beside its health bar.</p>
        <h3>Damage</h3>
        <p>Your hand's <span class="c-power">Power</span> (hand base + your ATK + each <i>scoring</i> card's Power) × its <span class="c-mult">Mult</span>, minus the foe's <b>DEF</b>. Cards rank 2 → A carry Power 2 → 14. Stronger hands have bigger multipliers — from ×1 High Card to ×16 Royal Flush.</p>
      </section>
      <section>
        <h3>The Four Elements</h3>
        <div class="howto-cycle">${elementCycleSVG(11)}<p class="tt-dim" style="max-width:15rem">Each element beats the next. A foe is <b class="c-good">weak</b> to the element that beats it (×2) and <b class="c-bad">resists</b> one or two elements (×½). Elements are re-rolled every run.</p></div>
        ${sigs}
      </section>
      <section>
        <h3>Boons, Scrolls & Stars</h3>
        <p><b>Boons</b> are relics of the gods that change the rules (like Jokers). <b>Scrolls</b> transmute or enhance cards in your hand. <b>Constellations</b> raise a poker hand's level. Buy them in the <b>Agora</b> with drachmae.</p>
        <h3>Controls</h3>
        <p>Click cards to select · drag to reorder · <b>Enter</b> play · <b>X</b> discard · <b>R</b>/<b>E</b> sort · <b>1-9</b> select by position · <b>Esc</b> options.</p>
      </section>`,
    }),
    h('div', { class: 'actions' }, h('button', { class: 'btn', text: 'To the Labors!', on: { click: () => { audio.play('button'); close(); } } })),
  );
  close = openModal(panel, { onClose: onDone });
  void BEATS;
}
