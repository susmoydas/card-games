import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

const ROOT = new URL('../www/', import.meta.url).pathname;
const SHOTS = new URL('./shots29/', import.meta.url).pathname;
const PORT = 8137;
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };
fs.mkdirSync(SHOTS, { recursive: true });

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});
await new Promise(r => server.listen(PORT, r));

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--font-render-hinting=none', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const consoleErrors = [], pageErrors = [], failedRequests = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => pageErrors.push(String(e?.stack || e)));
page.on('requestfailed', r => failedRequests.push(`${r.url()} :: ${r.failure()?.errorText}`));
page.on('response', r => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url()); });

const wait = ms => new Promise(r => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
async function frame29() { return page.frames().find(f => f.url().includes('/games/29/index.html')); }
async function clickIn(frame, selector) { await frame.waitForSelector(selector, { timeout: 5000 }); await frame.click(selector); }
async function clickText(frame, text) {
  const found = await frame.evaluate(t => {
    const b = [...document.querySelectorAll('button')].find(x => (x.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase().includes(t.toLowerCase()));
    if (b) { b.click(); return true; }
    return false;
  }, text);
  if (!found) throw new Error(`button not found: ${text}`);
}

await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle0' });
check('home screen loads with three playable games', await page.$$eval('.gc:not(.lock)', els => els.length) === 3);

// --- 29 ---
await page.click('.gc');
await page.waitForSelector('#g29:not([hidden])');
await wait(600);
let f = await frame29();
check('29 opens inside the app', !!f && await page.$eval('#g29', e => !e.hidden));
check('29 intro renders', await f.$eval('.modal h2', e => e.textContent.trim()) === '29');
await page.screenshot({ path: path.join(SHOTS, '29-intro.png') });

await clickText(f, 'New Deal');
await wait(300);
check('29 deals four cards for auction', await f.$$eval('#hand .card', els => els.length) === 4);
check('29 seats render', await f.$$eval('.seat .av', els => els.length) === 4);
await f.waitForSelector('.modal .grid .btn[data-v="28"]');
check('29 bidding asks the player', (await f.$eval('.modal h2', e => e.textContent)).includes('Your bid'));
await f.click('.modal .btn[data-v="28"]');
await wait(2800);
await f.waitForFunction(() => [...document.querySelectorAll('.modal h2')].some(h => h.textContent.includes('Set trump')), { timeout: 8000 });
check('29 reaches trump selection after bids', true);
await f.click('.pk .cell[data-k="♠"]');
await f.click('.modal .btn.pri[data-v="go"]');
for (let i = 0; i < 8; i++) {
  await wait(400);
  if (!(await f.$('#ov')) || await f.$eval('#ov', e => getComputedStyle(e).display === 'none')) break;
  const h = await f.$eval('.modal h2', e => e.textContent).catch(() => '');
  console.log('   modal:', h.replace(/\s+/g, ' '));
  await f.evaluate(() => {
    const m = document.querySelector('.modal');
    const b = m?.querySelector('[data-v="0"]') || m?.querySelector('[data-v="1"]') || m?.querySelector('.btn.pri');
    if (b) b.click();
  });
}
await wait(1200);
check('29 second deal gives each player eight cards', await f.$$eval('#hand .card', els => els.length) === 8);
await f.waitForSelector('#hand .card.ok', { timeout: 8000 });
check('29 exposes playable cards', await f.$$eval('#hand .ok', els => els.length) > 0);
await page.screenshot({ path: path.join(SHOTS, '29-play.png') });

const before = await f.$$eval('#trick .tc', els => els.length);
await f.click('#hand .card.ok');
await wait(1200);
const after = await f.$$eval('#trick .tc', els => els.length);
check('tapping a card plays it into the trick', after > before, `${before} -> ${after}`);

// restart inside 29
await f.click('#again');
await wait(900);
const f2 = await frame29();
check('restart reloads 29 to a fresh deal', !!f2 && !!(await f2.$('.modal h2')) && (await f2.$eval('.modal h2', e => e.textContent)).trim() === '29');

// back to home
await f2.click('#backBtn');
await page.waitForFunction(() => !document.querySelector('#home').hidden && document.querySelector('#g29').hidden, { timeout: 4000 });
check('29 Back returns to the home screen', true);

// --- Bridge ---
await clickText(page, 'Call Bridge');
await page.waitForSelector('#game:not([hidden])');
await wait(300);
check('Call Bridge still opens', (await page.$eval('#gt', e => e.textContent)) === 'Call Bridge');
const bridgeIntro = await page.$('#intro');
check('Call Bridge intro renders', !!bridgeIntro);
await page.click('#intro #gg');
await page.waitForSelector('#ov:not([hidden])');
check('Call Bridge bidding works', (await page.$eval('#ov', e => e.textContent)).includes('choose a bid'));
await page.click('#ov .gbtn');
await wait(2500);
check('Call Bridge deals 13 cards', await page.$$eval('#hd .cd', els => els.length) === 13);
await page.screenshot({ path: path.join(SHOTS, 'bridge.png') });
await page.click('#game header .ic');
await wait(200);
if (await page.$('#ov .gbtn')) await page.click('#ov .gbtn');
await wait(300);

// --- Hearts ---
await clickText(page, 'Hearts');
await page.waitForSelector('#game:not([hidden])');
await wait(300);
check('Hearts still opens', (await page.$eval('#gt', e => e.textContent)) === 'Hearts');
if (await page.$('#intro #gg')) await page.click('#intro #gg');
await wait(500);
check('Hearts pass flow renders', await page.$$eval('#hd .cd', els => els.length) === 13);
for (let i = 0; i < 3; i++) { await page.evaluate(i => document.querySelectorAll('#hd .cd')[i].click(), i); await wait(120); }
await page.click('#actionbar button');
await wait(3600);
check('Hearts play starts after passing', await page.$$eval('#hd .cd', els => els.length) === 13);
await page.screenshot({ path: path.join(SHOTS, 'hearts.png') });

check('no page JavaScript errors', pageErrors.length === 0, pageErrors.join(' | '));
check('no console errors', consoleErrors.length === 0, consoleErrors.join(' | '));
check('no failed asset requests', failedRequests.length === 0, failedRequests.join(' | '));

console.log('\nSUMMARY', JSON.stringify({ passed: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, pageErrors, consoleErrors, failedRequests }, null, 2));
await browser.close();
server.close();
process.exit(results.some(r => !r.ok) ? 1 : 0);
