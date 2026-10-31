// Headless screenshot + console capture helper.
// Usage: node tools/shot.mjs --url <url> --out <png> [--wait ms] [--w 1600] [--h 900] [--eval "js"] [--evalWait ms]
import { chromium } from 'playwright';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
    return acc;
  }, []),
);
const url = args.url || 'http://127.0.0.1:5173/';
const out = args.out || 'shots/shot.png';
const wait = Number(args.wait || 2500);
const w = Number(args.w || 1600);
const h = Number(args.h || 900);

const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=d3d11', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack || ''}`));
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(wait);
const evals = [];
for (const k of Object.keys(args)) if (k.startsWith('eval')) evals.push(k);
evals.sort();
for (const k of evals) {
  if (k.endsWith('Wait')) continue;
  try {
    const r = await page.evaluate(args[k]);
    if (r !== undefined) logs.push(`[eval ${k}] ${typeof r === 'string' ? r : JSON.stringify(r)}`);
  } catch (e) {
    logs.push(`[eval error ${k}] ${e.message}`);
  }
  await page.waitForTimeout(Number(args[k + 'Wait'] || 1500));
}
await page.screenshot({ path: out });
console.log(logs.slice(-60).join('\n'));
console.log('saved', out);
await browser.close();
