/** Balatro-style 3D tilt + glare on hover for DOM cards. Expects an optional `.glare` child. */
export function attachTilt(el: HTMLElement, max = 16): void {
  const glare = el.querySelector('.glare') as HTMLElement | null;
  let raf = 0;
  let tx = 0;
  let ty = 0;
  let cx = 0;
  let cy = 0;
  let hover = false;
  const tick = () => {
    cx += (tx - cx) * 0.18;
    cy += (ty - cy) * 0.18;
    el.style.transform = `perspective(700px) rotateX(${cy}deg) rotateY(${cx}deg) ${hover ? 'scale(1.06)' : ''}`;
    if (glare) {
      glare.style.opacity = hover ? '1' : '0';
      glare.style.background = `radial-gradient(circle at ${50 + cx * 3}% ${50 - cy * 3}%, rgba(255,255,255,.35), rgba(255,255,255,0) 55%)`;
    }
    if (Math.abs(tx - cx) > 0.01 || Math.abs(ty - cy) > 0.01 || hover) raf = requestAnimationFrame(tick);
    else raf = 0;
  };
  const kick = () => {
    if (!raf) raf = requestAnimationFrame(tick);
  };
  el.addEventListener('mousemove', (e) => {
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    tx = px * max * 2;
    ty = -py * max * 2;
    hover = true;
    kick();
  });
  el.addEventListener('mouseleave', () => {
    tx = 0;
    ty = 0;
    hover = false;
    kick();
  });
}
