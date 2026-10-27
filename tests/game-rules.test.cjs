const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../www/index.html'), 'utf8');
const inlineScript = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
assert.ok(inlineScript, 'expected the app inline script');

function loadGame() {
  const elements = new Map();
  const timers = [];
  const document = {
    querySelector(selector) {
      if (!elements.has(selector)) {
        elements.set(selector, {
          className: '',
          hidden: true,
          innerHTML: '',
          textContent: '',
          style: {},
          id: selector,
          addEventListener() {},
          setAttribute() {},
          getAttribute() { return null; },
          remove() {},
          querySelector() { return document.querySelector(selector + ' child'); },
          appendChild() {},
          get children() { return []; },
        });
      }
      return elements.get(selector);
    },
  };
  const context = vm.createContext({
    document,
    history: { pushState() {} },
    location: { href: 'http://localhost/' },
    timers,
    setTimeout(callback) { timers.push(callback); return timers.length; },
    window: { addEventListener() {} },
  });
  vm.runInContext(
    `${inlineScript}\ntry{globalThis.board=board; globalThis.draw = draw;}catch(e){}\nglobalThis.testApi = {setGame(g) { G = g; }, getGame() { return G; }, html(s) { return document.querySelector(s).innerHTML; }, text(s) { return document.querySelector(s).textContent; }, runNextTimer() { const callback = timers.shift(); if (callback) callback(); }, runTimers() { timers.splice(0).forEach(callback => callback()); }, deal, NM, legal, legalB, win, playC, tap, placeBidB, heartsPassDirection, heartsPassOffset, heartsPassSource, heartsPassReceiver, transferHeartsPass, bidStatus, seatInfoHTML, board, trumpHTML, startHeartsPlay, commitHeartsPass};`,
    context,
  );
  return context.testApi;
}

function game(g, overrides = {}) {
  return {
    g,
    phase: 'play',
    t: 0,
    ask: -1,
    turn: 0,
    gen: 1,
    h: [[], [], [], []],
    tr: [],
    tw: [0, 0, 0, 0],
    pp: [0, 0, 0, 0],
    bid: [1, 1, 1, 1],
    bidLog: [],
    k: '',
    sc: [0, 0, 0, 0],
    rd: 1,
    ...overrides,
  };
}

test('human and bot seats use compass directions', () => {
  const { NM } = loadGame();
  assert.deepEqual(Array.from(NM), ['South', 'West', 'North', 'East']);
});

test('Call Bridge follows suit, trumps when void, and overtrumps when able', () => {
  const api = loadGame();
  const lead = { s: 1, r: 10 };
  const spade = { s: 0, r: 14 };
  const heart = { s: 1, r: 2 };
  const bridge = game('bridge', {
    h: [[], [], [heart, spade], []],
    tr: [{ p: 0, c: lead }],
  });
  api.setGame(bridge);
  assert.deepEqual(api.legalB(2), [heart]);

  bridge.h[2] = [spade, { s: 2, r: 2 }];
  assert.deepEqual(api.legalB(2), [spade]);

  bridge.h[2] = [{ s: 0, r: 14 }, { s: 0, r: 8 }, { s: 1, r: 2 }];
  bridge.tr = [{ p: 0, c: { s: 0, r: 7 } }, { p: 1, c: { s: 0, r: 9 } }];
  assert.deepEqual(api.legalB(2), [{ s: 0, r: 14 }]);
});

test('trump wins over a higher off-suit card', () => {
  const api = loadGame();
  api.setGame(game('bridge', { t: 0 }));
  const trick = [
    { p: 0, c: { s: 1, r: 14 } },
    { p: 1, c: { s: 0, r: 2 } },
    { p: 2, c: { s: 2, r: 14 } },
  ];
  assert.equal(api.win(trick), 1);
});

test('Call Bridge rejects illegal and repeated card plays', () => {
  const api = loadGame();
  const follow = { s: 1, r: 2 };
  const invalid = { s: 0, r: 14 };
  api.setGame(game('bridge', {
    h: [[follow, invalid], [], [], []],
    tr: [{ p: 3, c: { s: 1, r: 10 } }],
  }));
  assert.equal(api.playC(0, invalid), false);
  assert.equal(api.playC(0, follow), true);
  assert.equal(api.playC(0, follow), false);
  assert.equal(api.getGame().tr.length, 2);
});

test('Call Bridge accepts one valid bid per seat and rejects invalid or duplicate bids', () => {
  const api = loadGame();
  api.setGame(game('bridge', {
    phase: 'bidding',
    bid: [null, null, null, null],
    bidOrder: [0, 1, 2, 3],
    bidAt: 0,
  }));
  assert.equal(api.placeBidB(0, 14), undefined);
  assert.equal(api.getGame().bid[0], null);
  assert.equal(api.placeBidB(0, 3), undefined);
  assert.equal(api.getGame().bid[0], 3);
  assert.equal(api.getGame().bidAt, 1);
  assert.equal(api.placeBidB(0, 4), undefined);
  assert.equal(api.getGame().bid[0], 3);
});

test('Hearts pass direction cycles left, right, opposite, then hold', () => {
  const { heartsPassDirection } = loadGame();
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6, 7, 8].map(heartsPassDirection),
    ['left', 'right', 'opposite', 'hold', 'left', 'right', 'opposite', 'hold'],
  );
});

test('Hearts passes left, right and across to the correct seat and identifies the source', () => {
  const { heartsPassOffset, heartsPassSource, heartsPassReceiver, transferHeartsPass, NM } = loadGame();
  const hands = Array.from({ length: 4 }, (_, p) =>
    Array.from({ length: 13 }, (_, i) => ({ s: p, r: i + 2 })),
  );
  for (const [direction, offset, source, receiver] of [
    ['left', 1, 3, 1],
    ['right', 3, 1, 3],
    ['opposite', 2, 2, 2],
  ]) {
    const selected = hands.map(hand => hand.slice(0, 3));
    const passed = transferHeartsPass(hands, selected, direction);
    assert.equal(heartsPassOffset(direction), offset);
    assert.equal(heartsPassSource(0, direction), source, 'South receives from the correct seat');
    assert.equal(heartsPassReceiver(0, direction), receiver, 'South passes to the correct seat');
    assert.equal(NM[heartsPassSource(0, direction)], ['East', 'West', 'North'][['left', 'right', 'opposite'].indexOf(direction)]);
    assert.deepEqual(Array.from(passed, hand => hand.length), [13, 13, 13, 13]);
    for (let p = 0; p < 4; p++) {
      for (const card of selected[p]) {
        assert.equal(passed[p].includes(card), false);
        assert.equal(passed[(p + offset) % 4].includes(card), true);
      }
    }
    assert.equal(new Set(passed.flat()).size, 52);
  }
});

test('Hearts hold leaves hands unchanged and invalid selections are rejected', () => {
  const { transferHeartsPass, heartsPassDirection } = loadGame();
  const hands = Array.from({ length: 4 }, (_, p) =>
    Array.from({ length: 13 }, (_, i) => ({ s: p, r: i + 2 })),
  );
  const held = transferHeartsPass(hands, [[], [], [], []], 'hold');
  for (let p = 0; p < 4; p++) assert.equal(held[p][0], hands[p][0]);
  assert.equal(heartsPassDirection(4), 'hold');

  const invalid = hands.map(hand => hand.slice(0, 2));
  assert.throws(() => transferHeartsPass(hands, invalid, 'left'), /pass three cards/);
  assert.throws(() => transferHeartsPass(hands, hands.map(hand => [hand[0], hand[0], hand[1]]), 'left'), /pass three cards/);
});

test('Call Bridge seat badges show all confirmed bids and separate trick counts from scores', () => {
  const api = loadGame();
  const bridge = game('bridge', {
    phase: 'play',
    bid: [3, 1, 4, 2],
    tw: [2, 0, 3, 1],
    sc: [5, -1, 8, 2],
    turn: 2,
  });
  api.setGame(bridge);
  api.board(bridge);
  const seats = [0, 1, 2, 3].map(p => api.seatInfoHTML(bridge, p));
  for (const [p, bid, tricks] of [[0, 3, 2], [1, 1, 0], [2, 4, 3], [3, 2, 1]]) {
    assert.match(seats[p], new RegExp(`aria-label="South bid ${bid}|bid ${bid}"`));
    assert.match(seats[p], new RegExp(`aria-label="\\S+ ${tricks} tricks taken"`));
  }
  assert.match(api.html('#sc'), /<b>5<\/b>/);
  assert.doesNotMatch(api.html('#sc'), /TRICKS|BID/);

  bridge.phase = 'bidding';
  bridge.turn = 1;
  bridge.bid = [3, null, null, null];
  assert.match(api.seatInfoHTML(bridge, 1), /Thinking/);
  assert.match(api.seatInfoHTML(bridge, 2), /Waiting/);
  assert.match(api.seatInfoHTML(bridge, 1), /current/);
});

test('Hearts locks repeated pass confirmation and records the actual incoming source', () => {
  const api = loadGame();
  const hands = Array.from({ length: 4 }, (_, p) =>
    Array.from({ length: 13 }, (_, i) => ({ s: p, r: i + 2 })),
  );
  const selected = hands.map(hand => hand.slice(0, 3));
  const state = game('hearts', {
    phase: 'passing',
    passDir: 'right',
    passSelected: selected[0],
    passCards: selected,
    h: hands,
    passNotice: null,
    incomingNotice: null,
    incomingHighlight: false,
  });
  api.setGame(state);
  api.commitHeartsPass();
  assert.equal(state.phase, 'receiving');
  assert.equal(state.passNotice.source, 1);
  assert.equal(state.passNotice.receiver, 3);
  assert.equal(state.incomingNotice.length, 3);
  assert.deepEqual(Array.from(state.h, hand => hand.length), [13, 13, 13, 13]);
  assert.match(api.html('#passnotice'), /Sending 3 cards to East/);
  api.runNextTimer();
  assert.equal(state.phase, 'receiving', 'trick play waits until the incoming cards are shown');
  assert.match(api.html('#passnotice'), /Received 3 cards from West/);
  api.commitHeartsPass();
  assert.equal(state.phase, 'receiving');
  assert.deepEqual(Array.from(state.h, hand => hand.length), [13, 13, 13, 13]);
});

test('Hearts selection is capped at three, can be corrected, and interrupted receive timers cannot start an old game', () => {
  const api = loadGame();
  const hands = Array.from({ length: 4 }, (_, p) =>
    Array.from({ length: 13 }, (_, i) => ({ s: p, r: i + 2 })),
  );
  const state = game('hearts', {
    phase: 'passing',
    passDir: 'left',
    passSelected: [],
    passCards: [null, ...hands.slice(1).map(hand => hand.slice(0, 3))],
    h: hands,
  });
  api.setGame(state);
  for (let i = 0; i < 4; i++) api.tap(i);
  assert.equal(state.passSelected.length, 3);
  assert.match(api.html('#actionbar'), /3\/3 selected/);
  assert.doesNotMatch(api.html('#actionbar'), /disabled/);

  api.tap(1);
  assert.equal(state.passSelected.length, 2);
  assert.match(api.html('#actionbar'), /2\/3 selected/);
  assert.match(api.html('#actionbar'), /disabled/);
  api.tap(1);
  assert.equal(state.passSelected.length, 3);

  api.commitHeartsPass();
  const replacement = game('bridge');
  api.setGame(replacement);
  api.runTimers();
  assert.equal(state.phase, 'receiving');
  assert.equal(replacement.phase, 'play');
});

test('Hearts hold shows no-exchange status and starts play without an incoming animation', () => {
  const api = loadGame();
  const hands = Array.from({ length: 4 }, (_, p) =>
    Array.from({ length: 13 }, (_, i) => ({ s: p, r: i + 3 })),
  );
  hands[3][0] = { s: 3, r: 2 };
  const state = game('hearts', {
    phase: 'hold',
    passDir: 'hold',
    passNotice: { kind: 'hold' },
    h: hands,
  });
  api.setGame(state);
  api.startHeartsPlay();
  assert.equal(state.phase, 'play');
  assert.match(api.text('#msg'), /Hold — no cards exchanged/);
  assert.match(api.html('#passnotice'), /Hold — no cards exchanged/);
  assert.doesNotMatch(api.html('#passnotice'), /Received|pass-cards/);
});
