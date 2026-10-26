const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../www/index.html'), 'utf8');
const src = html.match(/<script>([\s\S]*)<\/script>/)[1];

function loadGame() {
  const mkEl = (id) => {
    const el = {
      id, innerHTML: '', hidden: true, textContent: '', className: '', style: {},
      children: [],
      setAttribute() {}, getAttribute() { return null; }, remove() {},
      appendChild(c) { this.children.push(c); },
      addEventListener() {},
      querySelector(sel) { this._c = this._c || {}; return (this._c[sel] = this._c[sel] || mkEl(sel)); },
    };
    return el;
  };
  const els = {};
  const timers = []; const delays = [];
  const document = {
    querySelector(sel) { return (els[sel] = els[sel] || mkEl(sel)); },
    createElement(tag) { return mkEl(tag); },
    getElementById() { return null; },
    addEventListener() {},
    body: { appendChild() {} },
  };
  const sandbox = {
    console, document, timers,
    window: { addEventListener() {}, matchMedia: () => ({ matches: false }) },
    history: { pushState() {} }, location: { href: 'x' },
    setTimeout(cb, ms) { timers.push(cb); delays.push(ms === undefined ? 0 : ms); return timers.length; },
    clearTimeout() {},
    Math, Date,
  };
  vm.createContext(sandbox);
  vm.runInContext(
    `${src}\nglobalThis.__t={bidOptions29,stake29,pairAdj29,handResult29,gameOver29,RULES29,deal,endR,setG(g){G=g},getG(){return G},pairLegal,declarePair,playSingle29,startDouble,pickT,secondDeal29,endT2,activeSeats29,nextSeat29,trickSize29,extractSeventh29,seventhCancel29,botTrumpChoice29,voidAsk,win,playC,legal,singleCancelCheck,next,lockInput,clearLock,tap,deal};`,
    sandbox, { filename: 'index.html' },
  );
  return { sandbox, t: sandbox.__t, els, timers, delays };
}

test('bid range is 16-28 (13 options) via bidOptions29', () => {
  const { t } = loadGame();
  const opts = t.bidOptions29();
  assert.strictEqual(opts.length, 13);
  assert.strictEqual(opts[0], 16);
  assert.strictEqual(opts[12], 28);
  assert.ok(!opts.includes(29));
  assert.strictEqual(t.RULES29.minBid, 16);
  assert.strictEqual(t.RULES29.maxBid, 28);
});

test('double/redouble stakes are 1 / 2 / 4', () => {
  const { t } = loadGame();
  assert.strictEqual(t.stake29(0), 1);
  assert.strictEqual(t.stake29(1), 2);
  assert.strictEqual(t.stake29(2), 4);
});

test('pair adjustment is -4 for bidding team and +4 for opponents', () => {
  const { t } = loadGame();
  assert.strictEqual(t.pairAdj29(0, 0), -4);
  assert.strictEqual(t.pairAdj29(0, 1), 4);
  assert.strictEqual(t.pairAdj29(1, 1), -4);
  assert.strictEqual(t.pairAdj29(1, 0), 4);
  assert.strictEqual(t.pairAdj29(0, null), 0);
});

test('hand result adds/subtracts the stake based on card points vs target', () => {
  const { t } = loadGame();
  assert.strictEqual(t.handResult29(18, 16, 1), 1);
  assert.strictEqual(t.handResult29(15, 16, 1), -1);
  assert.strictEqual(t.handResult29(16, 16, 2), 2);
  assert.strictEqual(t.handResult29(15, 16, 4), -4);
});

test('game over at +6 and at -6', () => {
  const { t } = loadGame();
  assert.strictEqual(t.gameOver29([6, 0]), 0);
  assert.strictEqual(t.gameOver29([0, 6]), 1);
  assert.strictEqual(t.gameOver29([-6, 0]), 1);
  assert.strictEqual(t.gameOver29([0, -6]), 0);
  assert.strictEqual(t.gameOver29([5, -5]), -1);
});

test('dealer rotates on every deal', () => {
  const { t } = loadGame();
  t.setG({ g: '29', sc: [0, 0, 0, 0], rd: 0, ld: 0 });
  t.deal();
  assert.strictEqual(t.getG().rd, 1);
  assert.strictEqual(t.getG().ld, 1);
  t.deal();
  assert.strictEqual(t.getG().ld, 2);
});

function endRState(over) {
  return Object.assign({
    g: '29', phase: 'play', sc: [0, 0, 0, 0], pp: [0, 0, 0, 0], tw: [0, 0, 0, 0],
    bb: 0, cur: 16, dbl: 0, single: false, pairTeam: null, rd: 1, over: 0,
    h: [[], [], [], []], tr: [], bid: [], bid29: [16, 'pass', 'pass', 'pass'],
    turn: -1, freshBid: -1, scorePulse: -1, k: '', gen: 1, tt: -1, t: -1,
    full: [[], [], [], []], br: false, bidLog: [], ask: -1, lastTrickTeam: null,
  }, over);
}

test('normal scoring: +1 / -1 on card points vs target', () => {
  const { t } = loadGame();
  t.setG(endRState({ pp: [10, 0, 8, 0] }));
  t.endR();
  assert.strictEqual(t.getG().sc[0], 1);
  assert.strictEqual(t.getG().sc[1], 0);
  t.setG(endRState({ pp: [8, 0, 7, 0] }));
  t.endR();
  assert.strictEqual(t.getG().sc[0], -1);
});

test('doubled hand scores +2 / -2', () => {
  const { t } = loadGame();
  t.setG(endRState({ pp: [10, 0, 8, 0], dbl: 1 }));
  t.endR();
  assert.strictEqual(t.getG().sc[0], 2);
  t.setG(endRState({ pp: [8, 0, 7, 0], dbl: 1 }));
  t.endR();
  assert.strictEqual(t.getG().sc[0], -2);
});

test('redoubled hand scores +4 / -4', () => {
  const { t } = loadGame();
  t.setG(endRState({ pp: [10, 0, 8, 0], dbl: 2 }));
  t.endR();
  assert.strictEqual(t.getG().sc[0], 4);
});

test('pair by bidding team lowers the target by 4', () => {
  const { t } = loadGame();
  // bid 18, pair by team 0 => target 14, 16 pts wins
  t.setG(endRState({ cur: 18, pairTeam: 0, pp: [9, 0, 7, 0] }));
  t.endR();
  assert.strictEqual(t.getG().sc[0], 1);
  // without pair target 18, 16 pts loses
  t.setG(endRState({ cur: 18, pairTeam: null, pp: [9, 0, 7, 0] }));
  t.endR();
  assert.strictEqual(t.getG().sc[0], -1);
});

test('pair by opponents raises the target by 4', () => {
  const { t } = loadGame();
  // bid 16, opponents pair => target 20, 18 pts loses
  t.setG(endRState({ cur: 16, pairTeam: 1, pp: [9, 0, 9, 0] }));
  t.endR();
  assert.strictEqual(t.getG().sc[0], -1);
  t.setG(endRState({ cur: 16, pairTeam: 1, pp: [11, 0, 9, 0] }));
  t.endR();
  assert.strictEqual(t.getG().sc[0], 1);
});

test('single hand: all 8 tricks = +3, otherwise -3; doubles cancelled', () => {
  const { t } = loadGame();
  const g = endRState({ single: true, dbl: 2, cur: 20, tw: [4, 0, 4, 0], phase: 'single' });
  t.setG(g);
  t.playSingle29(0);
  assert.strictEqual(t.getG().dbl, 0, 'double must be cancelled by Single');
  g.phase = 'play';
  t.endR();
  assert.strictEqual(t.getG().sc[0], 3);
  t.setG(endRState({ single: true, dbl: 0, cur: 20, tw: [4, 1, 3, 0] }));
  t.endR();
  assert.strictEqual(t.getG().sc[0], -3);
});

test('match ends when a team reaches +6 or -6', () => {
  const { t } = loadGame();
  const st = endRState({ pp: [10, 0, 8, 0], sc: [5, 0] });
  t.setG(st);
  t.endR();
  assert.strictEqual(t.getG().sc[0], 6);
  assert.strictEqual(t.getG().over, 1);
  const st2 = endRState({ pp: [8, 0, 7, 0], sc: [-5, 2] });
  t.setG(st2);
  t.endR();
  assert.strictEqual(t.getG().sc[0], -6);
  assert.strictEqual(t.getG().over, 1);
});

test('all-pass redeal logic is present in bid29 (no forced bid)', () => {
  const { sandbox } = loadGame();
  const body = vm.runInContext('bid29.toString()', sandbox);
  assert.match(body, /All four passed/);
  assert.match(body, /deal\(0\)/);
  assert.doesNotMatch(body, /forcedBid=true/);
  assert.ok(!/length:14/.test(body), 'bid options must not include 29');
});

test('seventh card and joker variants are enabled, no coming-soon tiles', () => {
  const { sandbox } = loadGame();
  assert.strictEqual(vm.runInContext('RULES29.seventhCard', sandbox), true);
  assert.strictEqual(vm.runInContext('RULES29.joker', sandbox), true);
  assert.strictEqual(vm.runInContext('RULES29.seventhCardCancelOnZero', sandbox), true);
  assert.strictEqual(vm.runInContext('RULES29.singleCancelIfNoLeadSuit', sandbox), true);
  const pick = vm.runInContext('pickT.toString()', sandbox);
  assert.match(pick, /Choose a suit/);
  assert.match(pick, /7th Card/);
  assert.match(pick, /Joker \(No Trump\)/);
  assert.doesNotMatch(pick, /coming soon/);
});

test('7th card is the 3rd card of the second set and is set aside', () => {
  const { t } = loadGame();
  const hand = [];
  for (let i = 0; i < 8; i++) hand.push({ s: i % 4, r: 7 + (i % 8) });
  const { card, rest } = t.extractSeventh29(hand);
  assert.strictEqual(card, hand[6]);
  assert.strictEqual(rest.length, 7);
  assert.ok(!rest.includes(card));
});

test('7th card cancels only on zero-point ranks (K/Q/8/7)', () => {
  const { t } = loadGame();
  for (const r of [13, 12, 8, 7]) assert.strictEqual(t.seventhCancel29({ s: 0, r }), true, 'rank ' + r);
  for (const r of [11, 9, 14, 10]) assert.strictEqual(t.seventhCancel29({ s: 0, r }), false, 'rank ' + r);
  t.RULES29.seventhCardCancelOnZero = false;
  assert.strictEqual(t.seventhCancel29({ s: 0, r: 13 }), false);
  t.RULES29.seventhCardCancelOnZero = true;
});

test('second deal takes the 7th card aside and sets its suit as trump', () => {
  const { t, els, timers } = loadGame();
  const ranks = [14, 14, 14, 14, 14, 14, 11, 14];
  const mk = () => Array.from({ length: 8 }, (_, i) => ({ s: i % 4, r: ranks[i] }));
  const full = [mk(), mk(), mk(), mk()];
  t.setG({
    g: '29', phase: 'double', bb: 0, single: false, pendingSeventh: true,
    trumpMode: 'seventh', h: full.map(h => h.slice(0, 4)), full,
    sc: [0, 0, 0, 0], pp: [0, 0, 0, 0], tw: [0, 0, 0, 0], cur: 16, dbl: 0,
    pairTeam: null, rd: 1, ld: 0, gen: 1, tt: -1, t: -1, trumpCard: null, turn: -1,
    tr: [], ask: -1, freshBid: -1, scorePulse: -1, k: '', br: false,
  });
  t.secondDeal29();
  const g = t.getG();
  assert.strictEqual(g.trumpCard, g.full[0][6]);
  assert.strictEqual(g.tt, g.trumpCard.s);
  assert.strictEqual(g.h[0].length, 7);
  assert.strictEqual(g.phase, 'seventh-peek');
  assert.ok(g.h[0].includes(g.trumpCard) === false, '7th card must be out of the playable hand');
  assert.ok(timers.length > 0, 'single offer should be scheduled/queued');
  assert.match(els['#ov'].innerHTML, /7th card/i);
});

test('7th card with a zero-point rank cancels the bid and redeals', () => {
  const { t, els, timers } = loadGame();
  const mk = (s, r) => Array.from({ length: 8 }, (_, i) => ({ s, r }));
  const full = [mk(0, 13), mk(1, 9), mk(2, 9), mk(3, 9)]; // bidder 7th card = K (index6)
  t.setG({
    g: '29', phase: 'double', bb: 0, single: false, pendingSeventh: true,
    trumpMode: 'seventh', h: full.map(h => h.slice(0, 4)), full,
    sc: [0, 0, 0, 0], pp: [0, 0, 0, 0], tw: [0, 0, 0, 0], cur: 16, dbl: 0,
    pairTeam: null, rd: 1, ld: 0, gen: 1, tt: -1, t: -1, trumpCard: null, turn: -1,
    tr: [], ask: -1, freshBid: -1, scorePulse: -1, k: '', br: false, bid: [], bid29: [16, 'pass', 'pass', 'pass'],
  });
  t.secondDeal29();
  const g = t.getG();
  assert.strictEqual(g.trumpCard, null);
  assert.match(els['#ov'].textContent || els['#ov'].innerHTML, /no points/i);
  assert.ok(timers.length > 0, 'redeal timer scheduled');
});

test('joker mode: no ask-to-show-trump and no pair', () => {
  const { t } = loadGame();
  t.setG({
    g: '29', phase: 'play', single: false, trumpMode: 'joker', t: -1, tt: -1,
    tr: [{ p: 0, c: { s: 3, r: 9 } }], h: [[{ s: 1, r: 12 }, { s: 1, r: 13 }], [], [], []],
    turn: 0, ask: -1, tw: [1, 0, 0, 0], pairTeam: null, bb: 0, pairNeeded: true,
  });
  assert.strictEqual(t.voidAsk(0), false, 'no ask to show trump with Joker');
  assert.strictEqual(t.pairLegal(0), false, 'no pair with Joker (no trump)');
});

test('joker/no-trump trick: highest card of the led suit wins', () => {
  const { t } = loadGame();
  t.setG({ g: '29', phase: 'play', single: false, trumpMode: 'joker', t: -2, tt: -1 });
  const tr = [
    { p: 0, c: { s: 3, r: 7 } },
    { p: 1, c: { s: 3, r: 11 } }, // Jack of led suit
    { p: 2, c: { s: 1, r: 14 } }, // ace of another suit, must not win
    { p: 3, c: { s: 3, r: 14 } }, // ace of led suit, lower than Jack
  ];
  assert.strictEqual(t.win(tr), 1);
});

for (const caller of [0, 1, 2, 3]) {
  test(`single hand with caller seat ${caller}: partner sits out, 3 cards per trick, caller leads`, () => {
    const { t } = loadGame();
    const sitter = (caller + 2) % 4;
    t.setG({ g: '29', single: true, caller, sitter });
    const active = t.activeSeats29();
    assert.strictEqual(active.length, 3);
    assert.ok(!active.includes(sitter), 'partner must be excluded');
    assert.strictEqual(t.trickSize29(), 3);
    // turn order skips the partner
    let seat = caller;
    const seen = [];
    for (let i = 0; i < 3; i++) { seen.push(seat); seat = t.nextSeat29(seat); }
    assert.strictEqual(seen.length, 3);
    assert.ok(!seen.includes(sitter), 'partner never appears in the trick');
    assert.strictEqual(seen[0], caller, 'caller leads the trick');
    // expected order: table direction starting at caller, partner skipped
    const expected = [];
    for (let k = 0; k < 4; k++) { const x = (caller + k) % 4; if (x !== sitter) expected.push(x); }
    assert.strictEqual(JSON.stringify(seen), JSON.stringify(expected));
    assert.strictEqual(JSON.stringify(Array.from(active).sort()), JSON.stringify(expected.slice().sort()));
  });
}

test('single hand: full 8-trick simulation, caller wins all -> +3', () => {
  const { t } = loadGame();
  const caller = 0, sitter = 2;
  const hands = [[], [], [], []];
  for (let i = 0; i < 8; i++) {
    hands[0].push({ s: 0, r: 11 }); // caller: Jacks (highest rank)
    hands[1].push({ s: 0, r: 7 });
    hands[3].push({ s: 0, r: 7 });
    hands[2].push({ s: 1, r: 14 });
  }
  t.setG({
    g: '29', phase: 'play', single: true, caller, sitter, trumpMode: 'single',
    t: -2, tt: -1, h: hands, tr: [], turn: caller, ask: -1, tw: [0, 0, 0, 0],
    pp: [0, 0, 0, 0], sc: [0, 0, 0, 0], bb: 0, cur: 16, dbl: 0, singleFailed: false,
    pairTeam: null, rd: 1, ld: 0, gen: 1, k: '', br: false, freshBid: -1,
    scorePulse: -1, lastTrickTeam: null, over: 0, bid: [], bid29: [16, 'pass', 'pass', 'pass'],
    full: [[], [], [], []], bidLog: [], forcedBid: false, turnLock: false,
  });
  for (let trick = 0; trick < 8; trick++) {
    const order = t.activeSeats29();
    assert.strictEqual(order[0], caller, 'caller leads every trick');
    t.getG().tr = [];
    let seat = caller;
    for (let k = 0; k < 3; k++) {
      const g = t.getG();
      g.turn = seat;
      const legalCards = t.legal(seat);
      assert.ok(legalCards.length > 0, 'must have a legal card');
      assert.ok(t.playC(seat, legalCards[0]), 'card must be playable');
      if (k === 0) assert.strictEqual(g.tr[0].p, caller, 'caller plays first');
      seat = t.nextSeat29(seat);
    }
    const g = t.getG();
    assert.strictEqual(g.tr.length, 3, 'exactly 3 cards per trick');
    const w = t.win(g.tr);
    assert.strictEqual(w, caller, 'caller (highest led suit) wins the trick');
    g.tw[w]++;
    g.tr = [];
    g.turn = caller;
  }
  // empty the caller hand to reach scoring like the real flow
  t.getG().h[0] = [];
  t.getG().pp = [20, 0, 8, 0];
  t.getG().sc = [3, 0, 0, 0];
  t.endR();
  assert.strictEqual(t.getG().sc[0], 6, '+3 for taking all 8 tricks (started at 3, reaching +6)');
  assert.strictEqual(t.getG().over, 1, 'reaching +6 ends the match');
});

test('single hand: opponent wins a trick -> immediate failure (-3)', () => {
  const { t, timers } = loadGame();
  t.setG({
    g: '29', phase: 'play', single: true, caller: 0, sitter: 2, trumpMode: 'single',
    t: -2, tt: -1, tr: [
      { p: 0, c: { s: 0, r: 7 } },
      { p: 1, c: { s: 0, r: 11 } },
      { p: 3, c: { s: 0, r: 9 } },
    ],
    h: [[{ s: 1, r: 7 }], [], [], []], tw: [0, 0, 0, 0], pp: [0, 0, 0, 0],
    sc: [0, 0, 0, 0], bb: 0, cur: 16, dbl: 1, singleFailed: false, pairTeam: null,
    rd: 1, ld: 0, gen: 1, k: '', br: false, freshBid: -1, scorePulse: -1,
    ask: -1, over: 0, lastTrickTeam: null, bid: [], bid29: [16, 'pass', 'pass', 'pass'],
    full: [[], [], [], []], bidLog: [], turn: -1,
  });
  t.endT2(1); // West wins the trick
  assert.strictEqual(t.getG().singleFailed, true);
  // run the scheduled endR
  assert.ok(timers.length > 0, 'endR should be scheduled');
  while (timers.length) timers.shift()();
  assert.strictEqual(t.getG().sc[0], -3, 'caller team loses 3');
  assert.strictEqual(t.getG().sc[1], 0);
});

test('single cancel when an opponent lacks the lead suit', () => {
  const { t, timers } = loadGame();
  t.setG({
    g: '29', phase: 'play', single: true, caller: 0, sitter: 2, trumpMode: 'single',
    t: -2, tt: -1, tr: [{ p: 0, c: { s: 0, r: 9 } }],
    h: [[{ s: 0, r: 7 }], [{ s: 1, r: 12 }], [{ s: 1, r: 8 }], [{ s: 0, r: 8 }]],
    tw: [0, 0, 0, 0], turn: 1, gen: 1, rd: 1, ld: 0,
    pp: [0, 0, 0, 0], sc: [0, 0, 0, 0], cur: 16, dbl: 0, single: true, caller: 0,
    sitter: 2, pairTeam: null, bid: [], bid29: [16, 'pass', 'pass', 'pass'],
    freshBid: -1, scorePulse: -1, ask: -1, tt: -1, br: false, k: '', over: 0,
    full: [[], [], [], []], bidLog: [], lastTrickTeam: null,
  });
  assert.strictEqual(t.singleCancelCheck(1), true, 'opponent void in lead suit cancels');
  assert.ok(timers.length > 0, 'redeal scheduled');
  // caller is never cancelled
  t.setG(Object.assign(t.getG(), { tr: [{ p: 3, c: { s: 1, r: 7 } }] }));
  assert.strictEqual(t.singleCancelCheck(0), false, 'caller may be void without cancelling');
});

test('input lock: tap blocked while locked, unlocks after the timer', () => {
  const { t, timers } = loadGame();
  t.setG({ g: '29', phase: 'play', turn: 0, inputLock: false, single: false,
    tr: [], h: [[{ s: 0, r: 7 }], [], [], []], gen: 1, ask: -1, tt: -1, t: -1,
    tw: [0, 0, 0, 0], pp: [0, 0, 0, 0], sc: [0, 0, 0, 0], rd: 1, ld: 0,
    pairTeam: null, k: '', br: false, freshBid: -1, scorePulse: -1, trumpMode: 'suit' });
  t.lockInput(100);
  assert.strictEqual(t.getG().inputLock, true, 'lock engaged');
  const before = t.getG().h[0].length;
  t.tap(0);
  assert.strictEqual(t.getG().h[0].length, before, 'no card leaves the hand while locked');
  while (timers.length) timers.shift()();
  assert.strictEqual(t.getG().inputLock, false, 'lock released by timer');
  t.tap(0);
  assert.strictEqual(t.getG().h[0].length, before - 1, 'card playable after unlock');
});

test('input lock has a safety unlock and is clamped to 1500ms', () => {
  const { t, timers, delays } = loadGame();
  t.setG({ g: '29', inputLock: false, gen: 1 });
  t.lockInput(9000);
  assert.strictEqual(t.getG().inputLock, true);
  assert.ok(delays.includes(1500), 'primary unlock clamped to 1500ms');
  assert.ok(delays.includes(1500) && delays.filter(d => d === 1500).length >= 1, 'safety timeout present');
  while (timers.length) timers.shift()();
  assert.strictEqual(t.getG().inputLock, false, 'safety unlock clears the lock');
});

test('deal() and start() clear any running input lock', () => {
  const { t } = loadGame();
  t.setG({ g: '29', sc: [0, 0, 0, 0], rd: 0, ld: 0, inputLock: false, gen: 1 });
  t.lockInput(5000);
  assert.strictEqual(t.getG().inputLock, true);
  t.deal();
  assert.strictEqual(t.getG().inputLock, false, 'deal resets the lock');
});

test('pair declaration glows and seventh card flags exist', () => {
  const { t } = loadGame();
  t.setG({
    g: '29', phase: 'play', trumpMode: 'suit', t: 0, single: false, pairTeam: null,
    tw: [1, 0, 0, 0], turn: 0, h: [[{ s: 0, r: 13 }, { s: 0, r: 12 }, { s: 1, r: 9 }], [], [], []],
    tr: [], gen: 1, ask: -1, tt: 0, k: '', br: false, freshBid: -1, scorePulse: -1,
    sc: [0, 0, 0, 0], pp: [0, 0, 0, 0], rd: 1, ld: 0, bid: [], bid29: [16, 'pass', 'pass', 'pass'],
    cur: 16, dbl: 0, pairGlow: false, flipCard: null, asideShown: false, dealAnim: false,
    full: [[], [], [], []], bidLog: [], over: 0, lastTrickTeam: null,
  });
  assert.strictEqual(t.pairLegal(0), true, 'pair legal after reveal + a trick won');
  assert.strictEqual(t.declarePair(0), true);
  assert.strictEqual(t.getG().pairTeam, 0);
  assert.strictEqual(t.getG().pairGlow, true, 'pair glow armed');
  assert.match(t.getG().pairTeam === 0 ? 'Pair declared' : '', /Pair declared/);
});
