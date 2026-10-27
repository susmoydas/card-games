const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appPath = path.join(__dirname, '..', 'www', 'index.html');
const app = fs.readFileSync(appPath, 'utf8');
const gamePath = path.join(__dirname, '..', 'www', 'games', '29', 'index.html');
const game = fs.readFileSync(gamePath, 'utf8');

test('opening 29 loads a fresh standalone game and leaving unloads it', () => {
  const start = app.match(/function start29\(\)\{([^}]*)\}/)?.[1] || '';
  const close = app.match(/function close29\(\)\{([^}]*)\}/)?.[1] || '';
  assert.match(start, /window\.location\.href/);
  assert.match(start, /games\/29\/index\.html/);
  assert.match(close, /g29frame/);
  assert.match(close, /about:blank/);
});

test('Android/browser back closes 29 before touching Bridge or Hearts', () => {
  const handler = app.match(/window\.cardGamesHandleBack=\(\)=>\{([^\n]*)\}/)?.[1] || '';
  assert.match(handler, /#g29/);
  assert.ok(handler.indexOf('#g29') < handler.indexOf('#game'), '29 must be handled first');
  assert.match(app, /function goBack\(\)\{if\(!\$\('#g29'\)\.hidden\)\{close29\(\);return\}/);
});

test('the supplied 29 script parses and exports its own gameplay state', () => {
  const script = game.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  assert.doesNotThrow(() => new vm.Script(script));
  for (const marker of ['let H,trump,shown,bid,bidder,target,pts,trick', 'function winnerOf(t)', 'const beats=(c,w)=>', 'async function playTrick(lead,isLast)']) {
    assert.ok(script.includes(marker), `missing 29 gameplay marker: ${marker}`);
  }
});

test('the old in-app 29 single-hand and scoring code is gone', () => {
  for (const marker of ['singleCancelCheck', 'G.single', 'G.pairTeam', 'G.sc[bt]', 'G.trumpMode', 'G.trumpCard']) {
    assert.equal(app.includes(marker), false, `stale old 29 code: ${marker}`);
  }
});
