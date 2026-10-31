// Scripted playtest: drives the real game in headless Chrome and captures screenshots.
// Usage: node tools/playtest.mjs <scenario> [--port 5173] [--w 1600] [--h 900]
import { chromium } from 'playwright';
import fs from 'node:fs';

const argv = process.argv.slice(2);
const scenario = argv[0] || 'battle';
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`);
  return i >= 0 ? argv[i + 1] : d;
};
const port = opt('port', '5173');
const W = Number(opt('w', 1600));
const H = Number(opt('h', 900));
const query = opt('q', '');
const outDir = `shots/play/${scenario}`;
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required'],
  ignoreDefaultArgs: ['--mute-audio'],
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
if (argv.includes('--lowq')) {
  await page.addInitScript(() => {
    const k = 'dodek.settings.v1';
    const cur = JSON.parse(localStorage.getItem(k) || '{}');
    localStorage.setItem(k, JSON.stringify({ ...cur, quality: 1 }));
  });
}
if (!argv.includes('--coach')) {
  await page.addInitScript(() => {
    const k = 'dodek.settings.v1';
    const cur = JSON.parse(localStorage.getItem(k) || '{}');
    localStorage.setItem(k, JSON.stringify({ ...cur, coachSeen: true, tutorialSeen: true }));
  });
}
const logs = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`);
});
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}`));

const shot = async (name) => {
  await page.screenshot({ path: `${outDir}/${name}.png` });
  console.log('shot', name);
};
const wait = (ms) => page.waitForTimeout(ms);
const ev = (js) => page.evaluate(js).catch((e) => logs.push(`[eval] ${e.message}`));
const dbg = (js) => ev(`(() => { const d = window.__app.screen.debug(); ${js} })()`);
const waitReady = async (timeout = 25000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const ok = await page.evaluate(`(() => { const s = window.__app && window.__app.screen; if (!s || !s.debug) return false; const d = s.debug(); return !d.busy() && d.battle.hand.length > 0; })()`).catch(() => false);
    if (ok) return true;
    await wait(250);
  }
  console.log('waitReady timeout');
  return false;
};

const scenarios = {
  async battle() {
    await page.goto(`http://127.0.0.1:${port}/?dev=battle${query}`, { waitUntil: 'load' });
    await wait(1500);
    await shot('01_intro');
    await waitReady();
    console.log('fps', await ev('window.__app.currentFps.toFixed(1)'));
    await shot('02_turn1');
    await dbg(`d.selectIds(d.bestPlayIds());`);
    await wait(700);
    await shot('03_selected');
    await dbg(`d.play();`);
    for (let i = 0; i < 12; i++) {
      await wait(600);
      await shot(`04_play_${String(i).padStart(2, '0')}`);
    }
    await wait(800);
    await shot('07_boss_turn');
    await waitReady();
    await shot('08_next_turn');
  },
  async mechanics() {
    await page.goto(`http://127.0.0.1:${port}/?dev=battle&labor=lion&el=water&scrolls=pyre,apollo${query}`, { waitUntil: 'load' });
    await waitReady();
    // 1) discard the three lowest cards
    const before = await page.evaluate(`window.__app.screen.debug().battle.discards`);
    await dbg(`const b = d.battle; const ids = b.hand.slice().sort((x, y) => x.rank - y.rank).slice(0, 3).map(c => c.id); d.selectIds(ids); d.discard();`);
    await wait(1500);
    const after = await page.evaluate(`(() => { const b = window.__app.screen.debug().battle; return { discards: b.discards, hand: b.hand.length, pile: b.pile.length }; })()`);
    console.log('discard: before', before, 'after', JSON.stringify(after));
    await shot('m1_after_discard');
    // 2) scroll of pyre on two cards
    await dbg(`const b = d.battle; d.selectIds(b.hand.slice(0, 2).map(c => c.id));`);
    await wait(300);
    await ev(`document.querySelectorAll('.slot-group .slots')[1].querySelector('.mini-card').click()`);
    await wait(500);
    await shot('m2_scroll_selected');
    await ev(`document.querySelector('.use-btn').click()`);
    await wait(1800);
    const els = await page.evaluate(`window.__app.screen.debug().battle.hand.slice(0, 2).map(c => c.element).join(',')`);
    console.log('after pyre, first two elements:', els, 'scrolls left:', await page.evaluate(`window.__app.run.consumables.join(',')`));
    await shot('m3_after_scroll');
    // 3) drag the first card to the far right with a real mouse drag
    const order0 = await page.evaluate(`window.__app.screen.debug().battle.hand.map(c => c.id).join(',')`);
    const first = await page.evaluate(`(() => { const s = window.__app.screen; const v = s.views.get(s.order[0]); const p = window.__app.rig.worldToScreen(v.group.position, window.__app.w, window.__app.h); return { x: p.x, y: p.y, last: window.__app.rig.worldToScreen(s.views.get(s.order[s.order.length - 1]).group.position, window.__app.w, window.__app.h).x }; })()`);
    await page.mouse.move(first.x, first.y);
    await wait(150);
    await page.mouse.down();
    for (let i = 1; i <= 12; i++) {
      await page.mouse.move(first.x + ((first.last + 40 - first.x) * i) / 12, first.y - 30);
      await wait(30);
    }
    await shot('m4_dragging');
    await page.mouse.up();
    await wait(600);
    const order1 = await page.evaluate(`window.__app.screen.order.join(',')`);
    console.log('drag moved first card to end:', order0.split(',')[0] === order1.split(',').slice(-1)[0]);
    // 4) modals
    await ev(`[...document.querySelectorAll('.left-foot .btn')].find(b => b.textContent === 'Deck').click()`);
    await wait(900);
    await shot('m5_deck');
    await page.keyboard.press('Escape');
    await wait(400);
    await ev(`[...document.querySelectorAll('.left-foot .btn')].find(b => b.textContent === 'Hands').click()`);
    await wait(700);
    await shot('m6_hands');
    await page.keyboard.press('Escape');
    await wait(400);
    await ev(`[...document.querySelectorAll('.left-foot .btn')].find(b => b.textContent === 'Options').click()`);
    await wait(700);
    await shot('m7_options');
  },
  async win() {
    await page.goto(`http://127.0.0.1:${port}/?dev=battle${query}`, { waitUntil: 'load' });
    await waitReady();
    await dbg(`d.battle.boss.hp = 40; d.selectIds(d.bestPlayIds()); d.play();`);
    for (let i = 0; i < 14; i++) {
      await wait(500);
      await shot(`w_${String(i).padStart(2, '0')}`);
    }
  },
  async gallery() {
    const ids = (opt('ids', 'lion,hydra,hind,boar,stables,birds,bull,mares,hippolyta,geryon,ladon,cerberus')).split(',');
    const els = ['fire', 'water', 'wind', 'earth'];
    for (const [i, id] of ids.entries()) {
      await page.goto(`http://127.0.0.1:${port}/?dev=battle&labor=${id}&el=${els[i % 4]}&stage=${i % 3}`, { waitUntil: 'load' });
      await waitReady();
      await wait(800);
      await shot(`g_${String(i).padStart(2, '0')}_${id}`);
    }
  },
  async perf() {
    await page.goto(`http://127.0.0.1:${port}/?dev=battle${query}`, { waitUntil: 'load' });
    await waitReady();
    await wait(1500);
    const r = await page.evaluate(() => new Promise((res) => {
      const ts = [];
      const f = (t) => { ts.push(t); if (ts.length < 181) requestAnimationFrame(f); else {
        const d = ts.slice(1).map((v, i) => v - ts[i]).sort((a, b) => a - b);
        res({ avg: (ts[180] - ts[0]) / 180, p50: d[90], p95: d[171], max: d[179] });
      } };
      requestAnimationFrame(f);
    }));
    console.log('frame ms', JSON.stringify(r));
    const info = await page.evaluate(() => { const i = window.__app.stage.renderer.info; return { calls: i.render.calls, tris: i.render.triangles, points: i.render.points, geos: i.memory.geometries, tex: i.memory.textures }; });
    console.log('renderer', JSON.stringify(info));
  },
  async audio() {
    await page.goto(`http://127.0.0.1:${port}/?dev=battle${query}`, { waitUntil: 'load' });
    await wait(1200);
    await page.mouse.click(W * 0.5, H * 0.5);
    await waitReady();
    console.log('after intro', JSON.stringify(await ev('window.__audio.getStats()')), 'music', await ev('window.__audio.music'));
    await dbg(`d.selectIds(d.bestPlayIds()); d.play();`);
    await wait(9000);
    console.log('after play', JSON.stringify(await ev('window.__audio.getStats()')));
  },
  async title() {
    await page.goto(`http://127.0.0.1:${port}/${query ? '?' + query.slice(1) : ''}`, { waitUntil: 'load' });
    await wait(2500);
    await shot('01_title');
    await wait(3000);
    await shot('02_title_late');
  },
  async fullrun() {
    await page.addInitScript(() => {
      const k = 'dodek.settings.v1';
      const cur = JSON.parse(localStorage.getItem(k) || '{}');
      localStorage.setItem(k, JSON.stringify({ ...cur, speed: 3 }));
    });
    await page.goto(`http://127.0.0.1:${port}/?dev=map${query}`, { waitUntil: 'load' });
    await wait(4000);
    let last = '';
    let shots = 0;
    for (let step = 0; step < 400; step++) {
      const name = await page.evaluate(() => (window.__app && window.__app.screen ? window.__app.screen.constructor.name : 'none')).catch(() => 'nav');
      if (name !== last) {
        console.log(`[${step}] screen: ${name}`);
        last = name;
        await wait(900);
        await shot(`fr_${String(shots++).padStart(2, '0')}_${name}`);
      }
      if (name === 'EndScreen') break;
      if (name === 'MapScreen') {
        await ev(`document.querySelector('.map-go .btn')?.click()`);
        await wait(1500);
      } else if (name === 'BattleScreen') {
        const ready = await page.evaluate(`(() => { const d = window.__app.screen.debug(); return !d.busy() && d.battle.hand.length > 0 && !d.battle.over; })()`).catch(() => false);
        if (ready) {
          const info = await page.evaluate(`(() => { const d = window.__app.screen.debug(); const b = d.battle; return { hp: b.run.hp, boss: b.boss.hp, turn: b.turn }; })()`).catch(() => null);
          if (info) console.log(`   turn ${info.turn}: hero ${info.hp} boss ${info.boss}`);
          await dbg(`d.selectIds(d.bestPlayIds()); d.play();`);
          await wait(1200);
        } else await wait(400);
      } else if (name === 'SpoilsScreen') {
        await wait(2500);
        await ev(`document.querySelector('.gift-row .offer-card')?.click()`);
        await wait(800);
        await ev(`document.querySelector('.modal .offer-card')?.click()`);
        await wait(1500);
      } else if (name === 'AgoraScreen') {
        for (let i = 0; i < 4; i++) {
          await ev(`document.querySelector('.offer-card .btn.green')?.click()`);
          await wait(300);
          await ev(`document.querySelector('.elixir .btn.green')?.click()`);
          await wait(300);
        }
        await shot(`fr_${String(shots++).padStart(2, '0')}_agora_bought`);
        await ev(`[...document.querySelectorAll('.btn')].find(b => b.textContent.includes('Leave'))?.click()`);
        await wait(1500);
      } else if (name === 'SanctuaryScreen') {
        await ev(`document.querySelectorAll('.sanct-tile')[1]?.click()`);
        await wait(2000);
      } else await wait(500);
    }
    await wait(2500);
    await shot(`fr_${String(shots++).padStart(2, '0')}_final`);
  },
  async screens() {
    for (const s of ['map', 'agora', 'spoils', 'sanctuary', 'patron', 'victory', 'defeat']) {
      await page.goto(`http://127.0.0.1:${port}/?dev=${s}${query}`, { waitUntil: 'load' });
      await wait(s === 'spoils' ? 4500 : 3000);
      await shot(s);
    }
  },
};

try {
  await (scenarios[scenario] ?? scenarios.battle)();
} catch (e) {
  logs.push(`[runner] ${e.message}`);
}
console.log(logs.slice(-40).join('\n') || '(no errors)');
await browser.close();
