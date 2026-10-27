const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');

const game = fs.readFileSync(__dirname + '/../www/games/29/index.html', 'utf8');
const script = game.match(/<script>([\s\S]*?)<\/script>/)?.[1] || '';
const app = fs.readFileSync(__dirname + '/../www/index.html', 'utf8');

test('the supplied 29 game provides the 7th-card trump mode', () => {
  assert.ok(script.includes("type='7th'"), '7th-card choice exists');
  assert.ok(script.includes('trumpCard'), 'trump card state exists');
  assert.ok(script.includes('rest[bidder].splice(2,1)'), '7th card comes from the second deal');
  assert.match(script, /7th card is/);
  assert.doesNotThrow(() => new vm.Script(script));
});

test('the integrated app no longer renders 29 trump/second-deal state itself', () => {
  assert.equal(app.includes('seventhPeek29'), false);
  assert.equal(app.includes('finishPeek'), false);
  assert.equal(app.includes('cardEl(g.trumpCard'), false);
  assert.equal(app.includes('trumpMode'), false);
});

test('shared glass styling remains available to Bridge and Hearts', () => {
  assert.ok(app.includes('.gbtn'));
  assert.ok(app.includes('.glass'));
});
