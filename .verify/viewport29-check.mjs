import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const ROOT = new URL('../www/', import.meta.url).pathname;
const SHOTS = new URL('./shots29/', import.meta.url).pathname;
const PORT = 8141;
const MIME = { '.html': 'text/html', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(fs.readFileSync(file));
});
await new Promise(r => server.listen(PORT, r));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const wait = ms => new Promise(r => setTimeout(r, ms));
for (const [w, h] of [[320, 568], [360, 640], [414, 896]]) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle0' });
  await page.click('.gc'); await page.waitForSelector('#g29:not([hidden])'); await wait(500);
  const f = page.frames().find(x => x.url().includes('/games/29/index.html'));
  await f.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.includes('New Deal'))?.click());
  await f.waitForSelector('#hand .card');
  const metrics = await f.evaluate(() => {
    const r = e => { const b = e.getBoundingClientRect(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1), bottom: +b.bottom.toFixed(1), right: +b.right.toFixed(1) } };
    const hand = [...document.querySelectorAll('#hand .card')].map(r);
    return { vw: innerWidth, vh: innerHeight, app: r(document.querySelector('#app')), hand, back: r(document.querySelector('#backBtn')), seats: [...document.querySelectorAll('.seat')].map(r) };
  });
  const overflow = metrics.hand.some(c => c.bottom > metrics.vh + 1 || c.x < -1 || c.right > metrics.vw + 1);
  console.log(`${w}x${h}`, 'overflow=', overflow, 'handBottom=', Math.max(...metrics.hand.map(c => c.bottom)), 'vh=', metrics.vh, 'errors=', errors);
  await page.screenshot({ path: path.join(SHOTS, `29-${w}x${h}.png`) });
  await page.close();
}
await browser.close(); server.close();
