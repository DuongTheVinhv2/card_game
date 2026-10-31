// Dev page for the constellation creatures.
//   ?id=lion&el=fire     single creature, full detail (el: fire|water|wind|earth|none|hero)
//   ?grid=1              all 13, preview detail, palettes per element (&cycle=1 to cycle palettes)
//   ?debug2d=1[&id=..]   2D SDF silhouettes (+bones, stars, strokes)
//   ?sheet=1&id=hydra    pose sheet: 6 instances frozen at key moments (idle, strike, heavy wind-up, volley, roar, drain)
import * as THREE from 'three';
import { loadGameArt } from '../src/gfx/art/assets';
await loadGameArt();
import { createStage } from '../src/gfx/stage';
import { ELEMENT_PALETTE, HERO_PALETTE, type ElementPalette } from '../src/gfx/palette';
import { ELEMENTS, type CreatureId, type Element } from '../src/logic/types';
import { CREATURE_IDS, CREATURE_NAMES, ConstellationCreature, type CreatureAttack } from '../src/gfx/boss/ConstellationCreature';
import { getCreatureDef } from '../src/gfx/boss/creatures';
import { drawCreature2D } from '../src/gfx/boss/debug2d';

const params = new URLSearchParams(location.search);
const W = window as unknown as Record<string, unknown>;

function paletteFor(el: string | null, id: CreatureId): { pal: ElementPalette; el: Element | null } {
  if (el === 'hero' || (!el && id === 'heracles')) return { pal: HERO_PALETTE, el: null };
  if (el && (ELEMENTS as string[]).includes(el)) return { pal: ELEMENT_PALETTE[el as Element], el: el as Element };
  if (el === 'none') return { pal: HERO_PALETTE, el: null };
  return { pal: ELEMENT_PALETTE.fire, el: 'fire' };
}

/** dim cosmic backdrop roughly matching the game */
function addBackdrop(scene: THREE.Scene): void {
  const mat = new THREE.ShaderMaterial({
    depthWrite: false,
    uniforms: {},
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.999, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
        return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++){ s += a * n(p); p *= 2.03; a *= .5; } return s; }
      void main(){
        vec2 p = vUv * vec2(1.78, 1.0);
        vec3 c = mix(vec3(0.0012, 0.0014, 0.0035), vec3(0.006, 0.004, 0.018), smoothstep(1.2, 0.0, length(vUv - vec2(0.5, 0.55)) * 1.4));
        float neb = fbm(p * 2.2 + 3.0);
        c += vec3(0.009, 0.004, 0.02) * smoothstep(0.45, 0.9, neb);
        c += vec3(0.0, 0.004, 0.01) * smoothstep(0.55, 0.95, fbm(p * 3.1 - 7.0));
        vec2 g = floor(vUv * vec2(900.0, 500.0));
        float s = h(g);
        c += vec3(0.5, 0.55, 0.7) * step(0.9985, s) * h(g + 3.0) * 0.6;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  m.frustumCulled = false;
  m.renderOrder = -10;
  scene.add(m);
}

function debug2d(): void {
  document.getElementById('app')!.remove();
  const id = params.get('id') as CreatureId | null;
  const cv = document.createElement('canvas');
  cv.className = 'dbg';
  cv.width = window.innerWidth;
  cv.height = window.innerHeight;
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#05060c';
  ctx.fillRect(0, 0, cv.width, cv.height);
  if (id) {
    drawCreature2D(ctx, getCreatureDef(id), 0, 0, cv.width, cv.height, { labels: params.get('labels') !== '0', res: 40 });
  } else {
    const cols = 5;
    const rows = 3;
    const cw = cv.width / cols;
    const chh = cv.height / rows;
    CREATURE_IDS.forEach((cid, i) => {
      const x = (i % cols) * cw;
      const y = Math.floor(i / cols) * chh;
      drawCreature2D(ctx, getCreatureDef(cid), x, y, cw, chh, { bones: params.get('bones') === '1', strokes: true, res: 22 });
    });
  }
  W.__ready = true;
}

function three(): void {
  const stage = createStage({ parent: document.getElementById('app')! });
  addBackdrop(stage.scene);
  const timer = new THREE.Timer();
  timer.connect(document);
  const hud = document.getElementById('hud')!;
  const labels = document.getElementById('labels')!;
  const creatures: ConstellationCreature[] = [];
  const lblEls: { el: HTMLDivElement; c: ConstellationCreature }[] = [];
  const grid = params.get('grid') === '1';
  const sheet = params.get('sheet') === '1';
  /** per-instance freeze time (seconds since load) for the pose sheet */
  const freezeAt = new Map<ConstellationCreature, number>();

  if (sheet) {
    const id = (params.get('id') as CreatureId) || 'lion';
    const { pal, el } = paletteFor(params.get('el'), id);
    const shots: { label: string; act: (c: ConstellationCreature) => void; t: number }[] = [
      { label: 'idle', act: () => {}, t: 1.0 },
      { label: 'strike @impact', act: (c) => void c.playAttack('strike'), t: 0.4 },
      { label: 'heavy wind-up', act: (c) => void c.playAttack('heavy'), t: 0.85 },
      { label: 'volley', act: (c) => void c.playAttack('volley'), t: 0.5 },
      { label: 'roar', act: (c) => void c.playAttack('roar'), t: 0.75 },
      { label: 'drain', act: (c) => void c.playAttack('drain'), t: 1.0 },
    ];
    const s = Number(params.get('scale') || 0.62);
    shots.forEach((sh, i) => {
      const c = new ConstellationCreature(id, pal, el, { detail: params.get('detail') === 'preview' ? 'preview' : 'full' });
      c.position.set(((i % 3) - 1) * 9.0, i < 3 ? 3.9 : -4.1, 0);
      c.scale.setScalar(s);
      stage.scene.add(c);
      creatures.push(c);
      const d = document.createElement('div');
      d.className = 'lbl';
      d.textContent = sh.label;
      labels.appendChild(d);
      lblEls.push({ el: d, c });
      setTimeout(() => {
        sh.act(c);
        freezeAt.set(c, performance.now() / 1000 + sh.t);
      }, 600);
    });
    document.getElementById('title')!.textContent = CREATURE_NAMES[id].toUpperCase();
    W.__creatures = creatures;
  } else if (grid) {
    const cols = 5;
    const s = 0.40;
    CREATURE_IDS.forEach((id, i) => {
      const el = id === 'heracles' ? null : ELEMENTS[i % 4];
      const pal = el ? ELEMENT_PALETTE[el] : HERO_PALETTE;
      const c = new ConstellationCreature(id, pal, el, { detail: 'preview' });
      const col = i % cols;
      const row = Math.floor(i / cols);
      c.position.set((col - 2) * 4.8, (1 - row) * 4.45 + 0.35, 0);
      c.scale.setScalar(s);
      stage.scene.add(c);
      creatures.push(c);
      const d = document.createElement('div');
      d.className = 'lbl';
      d.textContent = CREATURE_NAMES[id];
      labels.appendChild(d);
      lblEls.push({ el: d, c });
    });
    if (params.get('cycle') === '1') {
      let k = 0;
      setInterval(() => {
        k++;
        creatures.forEach((c, i) => {
          if (c.creatureId === 'heracles') return;
          const el = ELEMENTS[(i + k) % 4];
          c.setPalette(ELEMENT_PALETTE[el], el, 1.2);
        });
      }, 4000);
    }
    W.__creatures = creatures;
  } else {
    const id = (params.get('id') as CreatureId) || 'lion';
    const { pal, el } = paletteFor(params.get('el'), id);
    const c = new ConstellationCreature(id, pal, el, { detail: params.get('detail') === 'preview' ? 'preview' : 'full' });
    if (params.has('scale')) {
      // inspection layout: centred at z=0
      c.scale.setScalar(Number(params.get('scale')));
      c.position.set(Number(params.get('x') || 0), Number(params.get('y') || 0.4), 0);
    } else {
      // replicate BattleScreen: boss at z=-7, 7 units tall == 31% of the screen height, centred at 26.5% from the top
      const bossZ = -7;
      const dist = stage.camera.position.z - bossZ;
      const visH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(stage.camera.fov / 2));
      const visW = visH * stage.camera.aspect;
      const bossScale = Math.min((0.31 * visH) / 7, (0.58 * visW) / 10);
      c.scale.setScalar(bossScale);
      c.position.set(0, visH / 2 - 0.265 * visH, bossZ);
    }
    stage.scene.add(c);
    creatures.push(c);
    W.__creature = c;
    document.getElementById('title')!.textContent = CREATURE_NAMES[id].toUpperCase();
    if (params.get('intro') === '1') void c.playIntro();
    if (params.get('guard') === '1') c.playGuard(true);
    if (params.get('low')) c.setLowHp(Number(params.get('low')));
    if (params.get('dim')) c.setDim(Number(params.get('dim')));
    buildUI(c);
  }
  W.__stage = stage;
  W.THREE = THREE;
  W.__palettes = { ...ELEMENT_PALETTE, hero: HERO_PALETTE };

  let frames = 0;
  let acc = 0;
  let fps = 0;
  let worst = 0;
  const v = new THREE.Vector3();
  const loop = (ts: number) => {
    timer.update(ts);
    const dt = timer.getDelta();
    const t = timer.getElapsed();
    const now = performance.now() / 1000;
    for (const c of creatures) {
      const fz = freezeAt.get(c);
      if (fz !== undefined && now >= fz) continue;
      c.update(dt, t);
    }
    stage.render(dt);
    frames++;
    acc += dt;
    worst = Math.max(worst, dt);
    if (acc > 0.5) {
      fps = frames / acc;
      hud.textContent = `${fps.toFixed(0)} fps  worst ${(worst * 1000).toFixed(1)}ms  particles ${creatures.reduce((a, c) => a + c.particleCount, 0)}`;
      W.__fps = fps;
      frames = 0;
      acc = 0;
      worst = 0;
    }
    for (const { el, c } of lblEls) {
      v.set(0, sheet ? -3.9 : -2.15, 0).applyMatrix4(c.matrixWorld).project(stage.camera);
      el.style.left = `${(v.x * 0.5 + 0.5) * stage.size.w}px`;
      el.style.top = `${(-v.y * 0.5 + 0.5) * stage.size.h}px`;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  W.__ready = true;
}

function buildUI(c: ConstellationCreature): void {
  const ui = document.getElementById('ui')!;
  const btn = (label: string, fn: () => void) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.onclick = fn;
    ui.appendChild(b);
  };
  const log = (s: string) => console.log(`[creature] ${s} @${performance.now().toFixed(0)}`);
  btn('intro', () => void c.playIntro().then(() => log('intro done')));
  (['strike', 'heavy', 'volley', 'roar', 'drain'] as CreatureAttack[]).forEach((k) =>
    btn(k, () => {
      log(`${k} start`);
      void c.playAttack(k).then(() => log(`${k} impact`));
    }),
  );
  btn('hurt', () => c.playHurt(1));
  btn('hurt .3', () => c.playHurt(0.3));
  let g = false;
  btn('guard', () => c.playGuard((g = !g)));
  btn('death', () => void c.playDeath().then(() => log('death done')));
  const slider = (label: string, fn: (v: number) => void) => {
    const l = document.createElement('label');
    l.textContent = label;
    const r = document.createElement('input');
    r.type = 'range';
    r.min = '0';
    r.max = '1';
    r.step = '0.01';
    r.value = '0';
    r.oninput = () => fn(Number(r.value));
    l.appendChild(r);
    ui.appendChild(l);
  };
  slider('charge', (v) => c.setCharge(v));
  slider('lowHp', (v) => c.setLowHp(v));
  slider('dim', (v) => c.setDim(v));
  const sel = document.createElement('select');
  ['fire', 'water', 'wind', 'earth', 'none', 'hero'].forEach((e) => {
    const o = document.createElement('option');
    o.value = e;
    o.textContent = e;
    sel.appendChild(o);
  });
  sel.value = params.get('el') || 'fire';
  sel.onchange = () => {
    const { pal, el } = paletteFor(sel.value, c.creatureId);
    c.setPalette(pal, el, 1);
  };
  ui.appendChild(sel);
  const idSel = document.createElement('select');
  CREATURE_IDS.forEach((id) => {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = id;
    idSel.appendChild(o);
  });
  idSel.value = c.creatureId;
  idSel.onchange = () => {
    params.set('id', idSel.value);
    location.search = params.toString();
  };
  ui.appendChild(idSel);
}

if (params.get('debug2d') === '1') debug2d();
else three();
