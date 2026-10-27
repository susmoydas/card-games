import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const ROOT = new URL('../www/', import.meta.url).pathname;
const PORT = 8139;
const MIME = { '.html': 'text/html', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(fs.readFileSync(file));
});
await new Promise(r => server.listen(PORT, r));
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const wait = ms => new Promise(r => setTimeout(r, ms));
await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle0' });
await page.click('.gc'); await page.waitForSelector('#g29:not([hidden])'); await wait(600);
const frame = () => page.frames().find(f => f.url().includes('/games/29/index.html'));
let f = await frame();
const clickText = async (t) => f.evaluate(t => { const b = [...document.querySelectorAll('button')].find(x => (x.textContent || '').toLowerCase().includes(t.toLowerCase())); if (b) { b.click(); return true } return false }, t);
await clickText('New Deal');
await f.waitForSelector('.modal .btn[data-v="28"]', { timeout: 8000 });
await f.click('.modal .btn[data-v="28"]'); await wait(2800);
await f.waitForFunction(() => [...document.querySelectorAll('.modal h2')].some(h => h.textContent.includes('Set trump')), { timeout: 10000 });
await f.click('.pk .cell[data-k="♠"]'); await f.click('.modal .btn.pri[data-v="go"]');
let endText = null;
const started = Date.now();
while (Date.now() - started < 100000) {
  await wait(350);
  const state = await f.evaluate(() => {
    const ov = document.querySelector('#ov');
    const open = ov && getComputedStyle(ov).display !== 'none';
    const h = open ? (document.querySelector('.modal h2')?.textContent || '') : '';
    return { open, h, ok: !!document.querySelector('#hand .ok'), cards: document.querySelectorAll('#hand .card').length, trick: document.querySelectorAll('#trick .tc').length };
  });
  if (state.open) {
    if (/win|falls short|defeated|match|New Deal/i.test(state.h)) { endText = state.h; break; }
    await f.evaluate(() => { const m = document.querySelector('.modal'); const b = m?.querySelector('[data-v="1"]') || m?.querySelector('.btn.pri'); if (b) b.click(); });
    continue;
  }
  if (state.ok) { await f.evaluate(() => document.querySelector('#hand .card.ok')?.click()); }
}
console.log('END:', endText, 'elapsed', Math.round((Date.now() - started) / 1000) + 's');
console.log('ERRORS:', errors);
await page.screenshot({ path: new URL('./shots29/29-round-end.png', import.meta.url).pathname });
await browser.close(); server.close();
process.exit(endText ? 0 : 1);
