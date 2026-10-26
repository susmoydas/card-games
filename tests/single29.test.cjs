const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../www/index.html'), 'utf8');
const src = html.match(/<script>([\s\S]*)<\/script>/)[1];

function loadGame() {
  const mkEl = (id) => ({ id, innerHTML: '', hidden: true, textContent: '', className: '', style: {}, children: [], setAttribute() {}, getAttribute() { return null; }, remove() {}, appendChild(c) { this.children.push(c); }, addEventListener() {}, querySelector(sel) { this._c = this._c || {}; return (this._c[sel] = this._c[sel] || mkEl(sel)); } });
  const els = {};
  const timers = [];
  const document = { querySelector(sel) { return (els[sel] = els[sel] || mkEl(sel)); }, createElement(tag) { return mkEl(tag); }, getElementById() { return null; }, addEventListener() {}, body: { appendChild() {} } };
  const sandbox = { console, document, timers, window: { addEventListener() {}, matchMedia: () => ({ matches: false }) }, history: { pushState() {} }, location: { href: 'x' }, setTimeout(cb, ms) { timers.push(cb); return timers.length; }, clearTimeout() {}, Math, Date };
  vm.createContext(sandbox);
  vm.runInContext(`${src}\nglobalThis.__t={RULES29,deal,endR,setG(g){G=g},getG(){return G},activeSeats29,nextSeat29,trickSize29,legal,playC,win,endT2};`, sandbox, { filename: 'index.html' });
  return { t: sandbox.__t, timers };
}

test('single 29: partner (seat 2) never plays when seat 0 is caller', () => {
  const { t } = loadGame();
  const caller = 0, sitter = 2;
  const hands = [[], [], [], []];
  for (let i = 0; i < 8; i++) {
    hands[0].push({ s: 0, r: 11 });
    hands[1].push({ s: 0, r: 7 });
    hands[3].push({ s: 0, r: 7 });
    hands[2].push({ s: 1, r: 14 });
  }
  t.setG({ g: '29', phase: 'play', single: true, caller, sitter, trumpMode: 'single', t: -2, tt: -1, h: hands, tr: [], turn: caller, ask: -1, tw: [0,0,0,0], pp: [0,0,0,0], sc: [0,0,0,0], bb: 0, cur: 16, dbl: 0, singleFailed: false, pairTeam: null, rd: 1, ld: 0, gen: 1, k: '', br: false, freshBid: -1, scorePulse: -1, lastTrickTeam: null, over: 0, bid: [], bid29: [16,'pass','pass','pass'], full: [[],[],[],[]], bidLog: [], forcedBid: false, turnLock: false });
  let partnerPlayed = false;
  for (let trick = 0; trick < 8; trick++) {
    const order = t.activeSeats29();
    t.getG().tr = [];
    let seat = caller;
    for (let k = 0; k < 3; k++) {
      const g = t.getG();
      g.turn = seat;
      const legalCards = t.legal(seat);
      assert.ok(legalCards.length > 0);
      assert.ok(t.playC(seat, legalCards[0]));
      if (seat === sitter) partnerPlayed = true;
      seat = t.nextSeat29(seat);
    }
    const g = t.getG();
    assert.strictEqual(g.tr.length, 3);
    g.tr = [];
    g.turn = caller;
  }
  assert.strictEqual(partnerPlayed, false, 'partner must never play');
});
