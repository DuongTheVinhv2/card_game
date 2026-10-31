type Content = string | (() => string);

interface Bound extends HTMLElement {
  __tt?: Content;
  __ttBound?: boolean;
}

class Tooltip {
  private el: HTMLElement | null = null;
  private visible = false;
  private owner: unknown = null;

  private get node(): HTMLElement {
    if (!this.el) this.el = document.getElementById('tooltip')!;
    return this.el;
  }

  show(html: string, x: number, y: number, owner: unknown = null): void {
    const n = this.node;
    if (n.innerHTML !== html) n.innerHTML = html;
    this.owner = owner;
    this.visible = true;
    n.classList.add('show');
    this.move(x, y);
  }

  move(x: number, y: number): void {
    if (!this.visible) return;
    const n = this.node;
    const w = n.offsetWidth;
    const h = n.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x + 18;
    let top = y + 18;
    if (left + w > vw - 8) left = x - w - 18;
    if (top + h > vh - 8) top = y - h - 18;
    n.style.left = `${Math.max(8, left)}px`;
    n.style.top = `${Math.max(8, top)}px`;
  }

  hide(owner: unknown = null): void {
    if (owner !== null && owner !== this.owner) return;
    this.visible = false;
    this.owner = null;
    this.node.classList.remove('show');
  }

  get current(): unknown {
    return this.owner;
  }

  /** attach to a DOM element (idempotent; later calls just replace the content) */
  attach(el: HTMLElement, content: Content): void {
    const b = el as Bound;
    b.__tt = content;
    if (b.__ttBound) return;
    b.__ttBound = true;
    const resolve = () => {
      const c = b.__tt;
      return typeof c === 'function' ? c() : (c ?? '');
    };
    el.addEventListener('mouseenter', (e) => this.show(resolve(), e.clientX, e.clientY, el));
    el.addEventListener('mousemove', (e) => {
      if (this.owner === el) this.move(e.clientX, e.clientY);
    });
    el.addEventListener('mouseleave', () => this.hide(el));
  }
}

export const tooltip = new Tooltip();
