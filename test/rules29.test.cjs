const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', 'www');
const appPath = path.join(root, 'index.html');
const gameDir = path.join(root, 'games', '29');
const gamePath = path.join(gameDir, 'index.html');
const app = fs.readFileSync(appPath, 'utf8');
const game = fs.readFileSync(gamePath, 'utf8');

test('home screen routes 29 to the isolated supplied game', () => {
  assert.match(app, /onclick="start29\(\)"/);
  assert.match(app, /id="g29"/);
  assert.match(app, /id="g29frame"/);
  assert.match(app, /games\/29\/index\.html/);
  assert.match(app, /function start29\(\)/);
});

test('old integrated 29 engine has been removed', () => {
  for (const marker of [
    'RULES29', 'bidOptions29', 'stake29', 'pairAdj29', 'handResult29',
    'gameOver29', 'activeSeats29', 'nextSeat29', 'trickSize29',
    'function bid29(', 'function pickT(', 'function startDouble(',
    'function secondDeal29(', 'function singleOffer29(', 'function playSingle29(',
    'function pairLegal(', 'function declarePair(', 'function seventhPeek29(',
    'function botTrumpChoice29(', 'function voidAsk(', 'function startPlay29(',
  ]) {
    assert.equal(app.includes(marker), false, `old 29 marker still present: ${marker}`);
  }
});

test('supplied 29 markup, card renderer, turns, and start flow are present', () => {
  assert.match(game, /<div id="app">/);
  assert.match(game, /function mk\(c\)/);
  assert.match(game, /function renderHand\(/);
  assert.match(game, /async function playTrick\(/);
  assert.match(game, /async function round\(/);
  assert.match(game, /Your bid/);
  assert.match(game, /Set trump/);
  assert.match(game, /New Deal/);
});

test('supplied 29 game uses only local, existing assets', () => {
  const refs = new Set();
  for (const match of game.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const ref = match[1];
    if (!ref.startsWith('data:') && !ref.startsWith('#')) refs.add(ref);
  }
  for (const match of game.matchAll(/url\(([^)]+)\)/g)) {
    const ref = match[1].replace(/^['"]|['"]$/g, '');
    if (!ref.startsWith('data:')) refs.add(ref);
  }
  assert.ok(refs.size >= 6, 'expected card, joker, and font references');
  for (const ref of refs) {
    assert.equal(/^(https?:)?\/\//.test(ref), false, `external dependency: ${ref}`);
    const file = path.resolve(gameDir, ref.split('?')[0]);
    assert.ok(file.startsWith(gameDir + path.sep), `asset escapes game directory: ${ref}`);
    assert.ok(fs.existsSync(file), `missing asset: ${ref}`);
  }
  for (const card of ['6c.svg', '6d.svg', '6h.svg', '6s.svg', 'card-back.svg']) {
    assert.ok(fs.existsSync(path.join(gameDir, 'assets', 'cards', card)), `missing card asset: ${card}`);
  }
});

test('29 back button returns to the app and restart stays inside the game', () => {
  assert.match(game, /postMessage\(\{type:'cardgames:29-back'\}/);
  assert.match(game, /window\.restart29=\(\)=>location\.reload\(\)/);
  assert.match(app, /addEventListener\('message'/);
  assert.match(app, /cardgames:29-back/);
  assert.match(app, /function close29\(\)/);
});

test('supplied 29 game has no external CDN or library dependency', () => {
  assert.doesNotMatch(game, /fonts\.googleapis\.com|fonts\.gstatic\.com|cdn\.jsdelivr|unpkg\.com|cdnjs/);
  assert.match(game, /@font-face\{font-family:Lexend/);
  assert.match(game, /assets\/fonts\/lexend-latin-400-normal\.woff2/);
  assert.match(game, /assets\/fonts\/lexend-latin-600-normal\.woff2/);
});
