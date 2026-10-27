import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

const ROOT = new URL('../www/', import.meta.url).pathname;
const SHOTS = new URL('./shots/', import.meta.url).pathname;
const PORT = 8123;
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' };

fs.mkdirSync(SHOTS, { recursive: true });

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404); res.end('not found'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});
await new Promise(r => server.listen(PORT, r));

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--font-render-hinting=none'],
});

const logs = [];
const errors = [];

export async function newPage(vw = 360, vh = 640) {
  const page = await browser.newPage();
  await page.setViewport({ width: vw, height: vh, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => errors.push(String(e && e.stack || e)));
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle0' });
  return page;
}

export async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, name) });
}

export async function clickText(page, text, scope = 'body') {
  const handle = await page.evaluateHandle((sel, t) => {
    const root = document.querySelector(sel);
    const btns = [...root.querySelectorAll('button')];
    return btns.find(b => (b.innerText || b.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase().includes(t.toLowerCase())) || null;
  }, scope, text);
  const el = handle.asElement();
  if (!el) throw new Error(`button not found: ${text}`);
  await el.click();
  await handle.dispose();
}

export async function hasButton(page, text, scope = 'body') {
  return page.evaluate((sel, t) => {
    const root = document.querySelector(sel);
    if (!root) return false;
    return [...root.querySelectorAll('button')].some(b => (b.innerText || b.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase().includes(t.toLowerCase()));
  }, scope, text);
}

export async function state(page) {
  return page.evaluate(() => {
    const g = (typeof G !== 'undefined') ? G : null;
    const cards = [...document.querySelectorAll('#tr .tc .cd')].map(el => {
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        text: (el.textContent || '').trim(),
        w: +r.width.toFixed(1), h: +r.height.toFixed(1),
        bg: cs.backgroundColor, border: cs.borderTopWidth + ' ' + cs.borderTopColor,
        radius: cs.borderRadius, font: cs.fontSize,
        pos: el.parentElement.className,
      };
    });
    const rect = s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { t: +r.top.toFixed(1), b: +r.bottom.toFixed(1), h: +r.height.toFixed(1), w: +r.width.toFixed(1) }; };
    const vh = window.innerHeight;
    return {
      phase: g && g.phase, turn: g && g.turn, bb: g && g.bb, trumpMode: g && g.trumpMode,
      pendingSeventh: g && g.pendingSeventh, t: g && g.t, tt: g && g.tt,
      trumpCard: g && g.trumpCard ? `${g.trumpCard.r} of ${g.trumpCard.s}` : null,
      handSizes: g && g.h ? g.h.map(h => h.length) : null,
      trick: cards,
      dock: (() => { const d = document.querySelector('#trumpdock'); if (!d) return null; const cs = getComputedStyle(d); const r = d.getBoundingClientRect(); return { cls: d.className, hidden: d.hidden, h: +r.height.toFixed(1), text: (d.innerText || '').trim(), inner: d.innerHTML.slice(0, 220) }; })(),
      dockCard: (() => { const c = document.querySelector('#trumpdock .card'); if (!c) return null; const r = c.getBoundingClientRect(); return { w: +r.width.toFixed(1), h: +r.height.toFixed(1) }; })(),
      rects: { hd: rect('#hd'), me: rect('#me'), actionbar: rect('#actionbar'), tbl: rect('.tbl'), mid: rect('.mid'), tr: rect('#tr'), top: rect('#top'), msg: rect('#msg'), game: rect('#game') },
      vh,
      handCards: [...document.querySelectorAll('#hd .cd')].slice(0, 3).map(el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { text: (el.textContent || '').trim(), w: +r.width.toFixed(1), h: +r.height.toFixed(1), bg: cs.backgroundColor, top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1) }; }),
      handCount: document.querySelectorAll('#hd .cd').length,
      overflow: (() => {
        const hd = document.querySelector('#hd');
        const tr = document.querySelector('#tr');
        if (!hd || !tr) return null;
        const a = hd.getBoundingClientRect(), b = tr.getBoundingClientRect();
        return { hdBeyondViewport: +(a.bottom - vh).toFixed(1), trOverlapsHd: +(b.bottom - a.top).toFixed(1) };
      })(),
      modal: document.querySelector('#ov').hidden ? null : (document.querySelector('#ov').innerText || '').replace(/\s+/g, ' ').trim().slice(0, 300),
    };
  });
}

export { browser, logs, errors, SHOTS };

const wait = ms => new Promise(r => setTimeout(r, ms));

async function modalButtons(page, scope = '#ov') {
  return page.evaluate(sel => {
    const root = document.querySelector(sel);
    if (!root || root.hidden) return [];
    return [...root.querySelectorAll('button')].map(b => ({
      text: (b.innerText || b.textContent || '').replace(/\s+/g, ' ').trim(),
      disabled: b.disabled,
    }));
  }, scope);
}

async function gstate(page) {
  return page.evaluate(() => {
    if (typeof G === 'undefined' || !G) return { phase: '__none__' };
    return {
      phase: G.phase, turn: G.turn, bb: G.bb, rd: G.rd, ld: G.ld,
    trumpMode: G.trumpMode, pendingSeventh: G.pendingSeventh, t: G.t, tt: G.tt,
    single: !!G.single, caller: G.caller, sitter: G.sitter,
    trumpCard: G.trumpCard ? { r: G.trumpCard.r, s: G.trumpCard.s } : null,
    fullSeventh: G.full && G.bb >= 0 && G.full[G.bb] ? { r: G.full[G.bb][6].r, s: G.full[G.bb][6].s } : null,
    hand: G.h ? G.h.map(h => h.length) : null,
    trLen: G.tr ? G.tr.length : 0,
    trPlayers: G.tr ? G.tr.map(x => x.p) : [],
    totalInPlay: G.h && G.tr ? G.h.reduce((a, h) => a + h.length, 0) + G.tr.length + (G.trumpCard ? 1 : 0) : null,
    tw: G.tw, sc: G.sc, ask: G.ask, over: G.over,
    };
  });
}

async function layoutProbe(page) {
  return page.evaluate(() => {
    const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { t: +b.top.toFixed(1), b: +b.bottom.toFixed(1), h: +b.height.toFixed(1), w: +b.width.toFixed(1) } };
    const vh = innerHeight, vw = innerWidth;
    const boxes = { top: r('#top'), s2: r('#s2'), mid: r('.mid'), tr: r('#tr'), msg: r('#msg'), me: r('#me'), hd: r('#hd'), tbl: r('.tbl') };
    const hand = [...document.querySelectorAll('#hd .cd')].map(e => e.getBoundingClientRect());
    const trick = [...document.querySelectorAll('#tr .tc .cd')].map(e => e.getBoundingClientRect());
    const overlap = (a, b) => Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    let worstTrickVsHand = 0;
    for (const t of trick) for (const h of hand) worstTrickVsHand = Math.max(worstTrickVsHand, overlap(t, h));
    const meRect = document.querySelector('#me').getBoundingClientRect();
    let worstTrickVsMe = 0;
    for (const t of trick) worstTrickVsMe = Math.max(worstTrickVsMe, overlap(t, meRect));
    let worstTrickVsS2 = 0;
    const s2Rect = document.querySelector('#s2').getBoundingClientRect();
    for (const t of trick) worstTrickVsS2 = Math.max(worstTrickVsS2, overlap(t, s2Rect));
    const hdRect = document.querySelector('#hd').getBoundingClientRect();
    const gstate = (typeof G !== 'undefined' && G) ? { phase: G.phase, rd: G.rd, h0: G.h ? G.h[0].length : null, turn: G.turn, single: !!G.single, sitter: G.sitter, trLen: G.tr ? G.tr.length : 0 } : null;
    const rwCount = document.querySelectorAll('#hd .rw').length;
    const cdCount = document.querySelectorAll('#hd .cd').length;
    const hdInner = document.querySelector('#hd').innerHTML.slice(0, 120);
    return { vw, vh, boxes, gstate, rwCount, cdCount, hdInner,
      handRows: new Set(hand.map(b => Math.round(b.top))).size,
      handCards: hand.length,
      handSize: hand[0] ? { w: +hand[0].width.toFixed(1), h: +hand[0].height.toFixed(1) } : null,
      handBelowViewport: +(hdRect.bottom - vh).toFixed(1),
      handAboveViewport: +(-hdRect.top).toFixed(1),
      trickVsHandOverlap: +worstTrickVsHand.toFixed(1),
      trickVsMeOverlap: +worstTrickVsMe.toFixed(1),
      trickVsS2Overlap: +worstTrickVsS2.toFixed(1),
      trickCardSize: trick[0] ? { w: +trick[0].width.toFixed(1), h: +trick[0].height.toFixed(1) } : null,
    };
  });
}

export async function runFlow(page, { mode = 'seventh', shots = true, maxSteps = 900, label = 'flow', trumpChoice = '7th Card', stopAtFirstTrick = false, bidChoice = '28' } = {}) {
  const report = { mode, steps: 0, events: [], trickSamples: [], modalLog: [], peeks: [], secondDeals: [], errors: [], checks: {} };
  await clickText(page, '29');
  if (await hasButton(page, 'Start', '#intro')) await clickText(page, 'Start', '#intro');
  await wait(600);
  // South deals first so South's bid dialog opens immediately.
  await page.evaluate(() => { G.rd = 3; deal(0); });
  await wait(500);

  const seenPeeks = new Set();
  const seenDeals = new Set();
  let bidDone = false, trumpChosen = false;
  let firstCardPlayed = null;

  const finalize = () => {
    report.checks = {
      bidMade: bidDone,
      seventhChosen: trumpChosen,
      peeksMatchDealOrder6: report.peeks.length ? report.peeks.every(p => p.matchesDealOrder || /no points/i.test(p.modal)) : null,
      peekRevealsRealCard: report.peeks.length ? report.peeks.every(p => p.trumpCard ? (/Your 7th card:/.test(p.modal) && p.matchesDealOrder) : /no points/i.test(p.modal)) : null,
      secondDealsAre32Cards: report.secondDeals.length ? report.secondDeals.every(d => d.totalInPlay === 32 && d.pendingSeventh === false) : null,
      bidderHasSevenAfterDeal: report.secondDeals.length ? report.secondDeals.every(d => d.hand[d.bb] === 7 || d.trumpCard === null) : null,
      completedHandWithoutError: report.events.some(e => e.roundEnd),
      firstTrickCardRendered: firstCardPlayed ? firstCardPlayed.cards.length > 0 && firstCardPlayed.cards.every(c => c.w > 18 && c.h > 26 && Math.abs(c.h / c.w - 1.45) < 0.1 && /rgb\(255, 255, 255\)/.test(c.bg) && /1px rgba\(0, 0, 0/.test(c.border)) : null,
    };
    report.peek = report.peeks[0] || null;
    report.bidDone = bidDone;
    report.trumpChosen = trumpChosen;
    report.final = report.final || null;
    report.consoleErrors = errors.slice();
  };

  for (let i = 0; i < maxSteps; i++) {
    report.steps = i;
    const s = await gstate(page);
    if (s.phase === '__none__') { report.events.push({ wentHome: true }); break; }
    const btns = await modalButtons(page);

    if (s.phase === 'seventh-peek' && !seenPeeks.has(s.rd + ':' + s.bb + ':' + JSON.stringify(s.trumpCard))) {
      const key = s.rd + ':' + s.bb + ':' + JSON.stringify(s.trumpCard);
      seenPeeks.add(key);
      const modal = (await page.evaluate(() => document.querySelector('#ov').innerText)).replace(/\s+/g, ' ').trim();
      report.peeks.push({ rd: s.rd, bb: s.bb, modal, trumpCard: s.trumpCard, fullSeventh: s.fullSeventh, hand: s.hand, totalInPlay: s.totalInPlay,
        matchesDealOrder: JSON.stringify(s.trumpCard) === JSON.stringify(s.fullSeventh),
        bidderHandHasTrickCard: s.trumpCard ? undefined : undefined });
      if (shots) await shot(page, `${label}-peek-${report.peeks.length}.png`);
    }
    if ((s.phase === 'single' || s.phase === 'play') && s.totalInPlay === 32 && s.bb >= 0 && !seenDeals.has(s.rd + ':' + s.bb)) {
      seenDeals.add(s.rd + ':' + s.bb);
      report.secondDeals.push({ rd: s.rd, bb: s.bb, phase: s.phase, hand: s.hand, totalInPlay: s.totalInPlay, trumpMode: s.trumpMode, pendingSeventh: s.pendingSeventh, trumpCard: s.trumpCard });
    }

    if (s.phase === 'round-end') { report.events.push({ roundEnd: s }); break; }

    if (btns.length) {
      const pick = btns.find(b => !b.disabled && b.text === bidChoice)
        || btns.find(b => !b.disabled && new RegExp(trumpChoice, 'i').test(b.text))
        || btns.find(b => !b.disabled && /No, continue/i.test(b.text))
        || btns.find(b => !b.disabled && /Show trump/i.test(b.text))
        || btns.find(b => !b.disabled && /Continue Play/i.test(b.text))
        || btns.find(b => !b.disabled);
      if (pick) {
        if (pick.text === bidChoice) bidDone = true;
        if (/7th Card/i.test(pick.text)) trumpChosen = true;
        await clickText(page, pick.text, '#ov');
      }
      await wait(320);
      continue;
    }

    if (s.phase === 'play' && s.turn === 0 && !(s.single && s.sitter === 0)) {
      const ok = await page.evaluate(() => {
        const el = [...document.querySelectorAll('#hd .cd')].find(b => b.classList.contains('ok'));
        if (!el) return null;
        const label = el.getAttribute('aria-label');
        el.click();
        return label;
      });
      if (ok) {
        await wait(60);
        const sample = await page.evaluate(l => {
          const g = typeof G !== 'undefined' ? G : null;
          const cards = [...document.querySelectorAll('#tr .tc .cd')].map(el => {
            const cs = getComputedStyle(el), r = el.getBoundingClientRect();
            return { text: (el.textContent || '').trim(), w: +r.width.toFixed(1), h: +r.height.toFixed(1), bg: cs.backgroundColor, border: cs.borderTopWidth + ' ' + cs.borderTopColor, radius: cs.borderRadius, pos: el.parentElement.className, left: +r.left.toFixed(1), top: +r.top.toFixed(1) };
          });
          return { played: l, trickLen: g.tr.length, trickPlayers: g.tr.map(x => x.p), cards, hd: (() => { const e = document.querySelector('#hd').getBoundingClientRect(); return { top: +e.top.toFixed(1), bottom: +e.bottom.toFixed(1) }; })(), tr: (() => { const e = document.querySelector('#tr').getBoundingClientRect(); return { top: +e.top.toFixed(1), bottom: +e.bottom.toFixed(1), left: +e.left.toFixed(1), right: +e.right.toFixed(1) }; })() };
        }, ok);
        if (!firstCardPlayed) {
          firstCardPlayed = sample;
          if (shots) await shot(page, `${label}-first-play.png`);
          report.events.push({ firstPlay: sample });
        }
        if (sample.trickLen === 4 && !report.layout) { await wait(500); report.layout = await layoutProbe(page); if (stopAtFirstTrick) { report.final = await gstate(page); finalize(); if (shots) await shot(page, `${label}-layout.png`); return report; } }
        if (sample.trickLen === 4) report.trickSamples.push(sample);
        await wait(420);
        continue;
      }
    }

    await wait(140);
  }

  report.final = await gstate(page);
  finalize();
  if (shots) await shot(page, `${label}-end.png`);
  return report;
}

async function run() {
  const vw = Number(process.argv[3] || 360), vh = Number(process.argv[4] || 640);
  const choice = process.argv[5] || '7th Card';
  const bid = process.argv[6] || '28';
  const page = await newPage(vw, vh);
  const full = process.argv[7] === 'full';
  const report = await runFlow(page, { label: `flow-${vw}x${vh}`, shots: true, trumpChoice: choice, bidChoice: bid, stopAtFirstTrick: !full });
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  server.close();
  process.exit(0);
}

if (process.argv[1] && process.argv[1].endsWith('check.mjs') && process.argv[2] === 'flow') await run();

if (process.argv[1] && process.argv[1].endsWith('check.mjs') && process.argv[2] === 'boot') {
  const page = await newPage();
  await clickText(page, '29');
  if (await hasButton(page, 'Start', '#intro')) await clickText(page, 'Start', '#intro');
  await new Promise(r => setTimeout(r, 1200));
  console.log(JSON.stringify(await state(page), null, 2));
  await shot(page, 'boot.png');
  console.log('ERRORS', errors);
  await browser.close();
  server.close();
  process.exit(0);
}
