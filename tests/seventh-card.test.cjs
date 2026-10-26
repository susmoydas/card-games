const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync(__dirname + '/../www/index.html','utf8');
const start = html.indexOf('<script>');
const end = html.indexOf('</script>',start);
const js = html.slice(start+8,end);
const fullHtml = html;

test('seventh card helpers exist', () => {
  assert.ok(js.includes('seventhPeek29'), 'seventhPeek29 exists');
  assert.ok(js.includes('finishPeek'), 'finishPeek exists');
  assert.ok(fullHtml.includes('.gbtn'), 'gbtn styles present');
  assert.ok(fullHtml.includes('.glass'), 'glass styles present');
});

test('trump indicator uses cardEl for seventh card', () => {
  assert.ok(js.includes('cardEl(g.trumpCard'), 'cardEl used for trump card');
});
