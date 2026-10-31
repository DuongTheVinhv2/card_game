import type { App } from '../App';
import type { Screen } from '../Screen';
import { h, retrigger } from '../../ui/dom';
import { icon, boonArt, scrollArt, constellationArt } from '../../ui/art';
import { tooltip } from '../../ui/tooltip';
import { audio } from '../../audio/audio';
import { popup } from '../../ui/popups';
import { attachTilt } from '../../ui/tilt';
import type { ShopState, ShopItem } from '../../logic/shop';
import { generateShop, rerollShop, buyItem, canBuy, ELIXIR_BY_ID, itemName } from '../../logic/shop';
import { BOON_BY_ID, MAX_BOONS } from '../../logic/boons';
import { SCROLL_BY_ID, MAX_CONSUMABLES } from '../../logic/scrolls';
import { HAND_INFO, handBase } from '../../logic/hands';
import { removeBoon, boonSellValue, effectiveStats } from '../../logic/run';
import { boonTooltip } from '../../ui/BattleHud';
import { MapScreen } from './MapScreen';

export class AgoraScreen implements Screen {
  readonly music = 'shop';
  private app: App;
  private shop!: ShopState;
  private root!: HTMLElement;
  private mainRow!: HTMLElement;
  private elixirRow!: HTMLElement;
  private boonRow!: HTMLElement;
  private scrollRow!: HTMLElement;
  private goldEl!: HTMLElement;
  private rerollBtn!: HTMLElement;
  private statsEl!: HTMLElement;

  constructor(app: App) {
    this.app = app;
  }

  async enter(): Promise<void> {
    const app = this.app;
    const run = app.run!;
    app.bg.setPalette(null, 1.5);
    app.fx.setMoteColor('#ffd9a0');
    this.shop = generateShop(run);

    this.goldEl = h('div', { class: 'agora-gold' });
    this.statsEl = h('div', { class: 'agora-stats' });
    this.mainRow = h('div', { class: 'shop-row' });
    this.elixirRow = h('div', { class: 'elixir-row' });
    this.boonRow = h('div', { class: 'owned-row' });
    this.scrollRow = h('div', { class: 'owned-row' });
    this.rerollBtn = h('button', { class: 'btn blue', on: { click: () => this.reroll() } });

    this.root = h('div', { class: 'screen agora' },
      h('div', { class: 'agora-head' },
        h('div', { class: 'label', text: 'Merchants of Hellas' }),
        h('div', { class: 'title-gold agora-title', text: 'The Agora' }),
        this.goldEl,
      ),
      h('div', { class: 'agora-body' },
        h('div', { class: 'panel shop-panel rise-in' },
          h('div', { class: 'shop-top' }, h('div', { class: 'label', text: 'Wares' }), this.rerollBtn),
          this.mainRow,
          h('div', { class: 'meander', style: 'margin:1.1rem 0 .9rem' }),
          h('div', { class: 'label', text: 'Elixirs · permanent blessings' }),
          this.elixirRow,
        ),
        h('div', { class: 'panel owned-panel rise-in', style: 'animation-delay:.1s' },
          h('div', { class: 'label', text: `Your Boons (max ${MAX_BOONS}) · click to sell` }),
          this.boonRow,
          h('div', { class: 'label', style: 'margin-top:1rem', text: `Your Scrolls (max ${MAX_CONSUMABLES})` }),
          this.scrollRow,
          h('div', { class: 'label', style: 'margin-top:1rem', text: 'Heracles' }),
          this.statsEl,
          h('div', { style: 'display:flex;justify-content:center;margin-top:1.3rem' },
            h('button', { class: 'btn red', html: 'Leave the Agora', on: { click: () => this.leave() } }),
          ),
        ),
      ),
    );
    app.ui.appendChild(this.root);
    this.render();
  }

  private render(): void {
    const run = this.app.run!;
    this.goldEl.innerHTML = `${icon('gold', '', '#ffd25a')}<span>${run.gold}</span>`;
    this.rerollBtn.innerHTML = `Reroll <span class="sub">${this.shop.rerollCost} drachmae</span>`;
    this.rerollBtn.classList.toggle('disabled', run.gold < this.shop.rerollCost);

    this.mainRow.innerHTML = '';
    this.shop.items.forEach((it, i) => this.mainRow.appendChild(this.offerCard(it, i)));
    this.elixirRow.innerHTML = '';
    this.shop.elixirs.forEach((it) => this.elixirRow.appendChild(this.elixirTile(it)));

    this.boonRow.innerHTML = '';
    for (const inst of run.boons) {
      const d = BOON_BY_ID[inst.id];
      const el = h('div', { class: 'owned-card' }, h('img', { attrs: { src: boonArt(inst.id), alt: d.name } }), h('div', { class: 'sell', html: `Sell ${boonSellValue(inst)}` }));
      tooltip.attach(el, () => boonTooltip(inst.id, inst.counter, true));
      el.addEventListener('click', () => {
        removeBoon(run, inst.uid);
        run.gold += boonSellValue(inst);
        audio.play('sell');
        tooltip.hide();
        const r = el.getBoundingClientRect();
        popup(r.left + r.width / 2, r.top, `+${boonSellValue(inst)}`, 'gold');
        this.render();
      });
      this.boonRow.appendChild(el);
    }
    for (let i = run.boons.length; i < MAX_BOONS; i++) this.boonRow.appendChild(h('div', { class: 'empty-slot' }));
    this.scrollRow.innerHTML = '';
    for (const id of run.consumables) {
      const d = SCROLL_BY_ID[id];
      const el = h('div', { class: 'owned-card' }, h('img', { attrs: { src: scrollArt(id), alt: d.name } }));
      tooltip.attach(el, () => `<div class="tt-title">${d.name}</div><div class="tt-row">${d.desc}</div><div class="tt-row tt-dim">Use it during a Labor.</div>`);
      this.scrollRow.appendChild(el);
    }
    for (let i = run.consumables.length; i < MAX_CONSUMABLES; i++) this.scrollRow.appendChild(h('div', { class: 'empty-slot' }));
    const st = effectiveStats(run);
    this.statsEl.innerHTML =
      `<span class="bchip">${icon('hp', '', '#ff6b7f')}<span class="k">HP</span>${run.hp}/${st.maxHp}</span>` +
      `<span class="bchip atk">${icon('atk')}<span class="k">ATK</span>${st.atk}</span>` +
      `<span class="bchip def">${icon('def')}<span class="k">DEF</span>${st.def}</span>` +
      `<span class="bchip">${icon('discard', '', '#ff8da0')}<span class="k">DISC</span>${st.discards}</span>`;
  }

  private art(it: ShopItem): string {
    switch (it.kind) {
      case 'boon':
        return boonArt(it.id);
      case 'scroll':
        return scrollArt(it.id);
      case 'constellation':
        return constellationArt(it.hand);
      default:
        return '';
    }
  }

  private describe(it: ShopItem): { kind: string; desc: string; rarity?: string } {
    const run = this.app.run!;
    switch (it.kind) {
      case 'boon': {
        const d = BOON_BY_ID[it.id];
        return { kind: `${d.rarity} boon`, desc: d.desc(), rarity: d.rarity };
      }
      case 'scroll':
        return { kind: 'scroll', desc: SCROLL_BY_ID[it.id].desc };
      case 'constellation': {
        const lv = run.handLevels[it.hand];
        const a = handBase(it.hand, lv);
        const b = handBase(it.hand, lv + 1);
        return {
          kind: 'constellation',
          desc: `Level up <b>${HAND_INFO[it.hand].name}</b> to Lv.${lv + 1}: <span class="c-power">${a.power}→${b.power}</span> × <span class="c-mult">${a.mult}→${b.mult}</span>`,
        };
      }
      case 'elixir':
        return { kind: 'elixir', desc: ELIXIR_BY_ID[it.id].desc };
    }
  }

  private offerCard(it: ShopItem, i: number): HTMLElement {
    const run = this.app.run!;
    const info = this.describe(it);
    const can = canBuy(run, it);
    const card = h('div', { class: `offer-card ${it.sold ? 'sold' : ''}`, style: `--i:${i}` },
      h('div', { class: 'tilt' }, h('img', { attrs: { src: this.art(it), alt: itemName(it) } }), h('div', { class: 'glare' })),
      h('div', { class: `offer-name ${info.rarity ? `rarity-${info.rarity}` : ''}`, text: itemName(it) }),
      h('div', { class: 'offer-kind', text: info.kind }),
      h('div', { class: 'offer-desc', html: info.desc }),
      it.sold
        ? h('div', { class: 'price sold', text: 'Sold' })
        : h('button', { class: `btn small ${can.ok ? 'green' : 'dark disabled'} price-btn`, html: `Buy · ${it.price} ${icon('gold', '', '#ffd25a')}` }),
    );
    if (!it.sold) {
      attachTilt(card.querySelector('.tilt') as HTMLElement);
      const btn = card.querySelector('.price-btn') as HTMLElement;
      btn.addEventListener('click', () => this.buy(it, card));
      if (!can.ok && can.reason) tooltip.attach(btn, can.reason);
    }
    return card;
  }

  private elixirTile(it: ShopItem): HTMLElement {
    const run = this.app.run!;
    if (it.kind !== 'elixir') return h('div');
    const d = ELIXIR_BY_ID[it.id];
    const can = canBuy(run, it);
    const tile = h('div', { class: `elixir ${it.sold ? 'sold' : ''}` },
      h('div', { class: 'elixir-ico', html: icon(d.icon) }),
      h('div', { class: 'elixir-body' }, h('div', { class: 'offer-name', text: d.name }), h('div', { class: 'offer-desc', text: d.desc })),
      it.sold ? h('div', { class: 'price sold', text: 'Sold' }) : h('button', { class: `btn small ${can.ok ? 'green' : 'dark disabled'}`, html: `${it.price} ${icon('gold', '', '#ffd25a')}` }),
    );
    const btn = tile.querySelector('button');
    if (btn) btn.addEventListener('click', () => this.buy(it, tile));
    return tile;
  }

  private buy(it: ShopItem, el: HTMLElement): void {
    const run = this.app.run!;
    const can = canBuy(run, it);
    if (!can.ok) {
      audio.play('error');
      retrigger(el, 'shake-x');
      const r = el.getBoundingClientRect();
      if (can.reason) popup(r.left + r.width / 2, r.top + 20, can.reason, 'note');
      return;
    }
    const before = it.kind === 'constellation' ? run.handLevels[it.hand] : 0;
    buyItem(run, it);
    audio.play('buy');
    const r = el.getBoundingClientRect();
    popup(r.left + r.width / 2, r.top + 10, `-${it.price}`, 'gold');
    if (it.kind === 'constellation') {
      audio.play('levelUp');
      popup(r.left + r.width / 2, r.top + r.height / 2, `${HAND_INFO[it.hand].name} Lv.${before} → ${before + 1}`, 'banner', { scale: 0.6 });
    }
    if (it.kind === 'elixir') audio.play('heal');
    tooltip.hide();
    this.render();
    this.app.persist();
  }

  private reroll(): void {
    const run = this.app.run!;
    if (!rerollShop(run, this.shop)) {
      audio.play('error');
      return;
    }
    audio.play('reroll');
    this.render();
    this.mainRow.querySelectorAll('.offer-card').forEach((c, i) => {
      (c as HTMLElement).animate([{ transform: 'rotateY(90deg)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, delay: i * 70, easing: 'cubic-bezier(.2,.9,.25,1)', fill: 'both' });
    });
  }

  private leave(): void {
    const run = this.app.run!;
    audio.play('button');
    run.nodeIndex++;
    this.app.persist();
    void this.app.go(new MapScreen(this.app));
  }

  exit(): void {
    tooltip.hide();
    this.root.remove();
  }

  update(): void {}
}
