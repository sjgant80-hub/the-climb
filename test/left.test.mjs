import { test } from 'node:test';
import assert from 'node:assert/strict';
import LEFT from '../src/left.mjs';
import X from '../src/exact.mjs';
import P from '../src/plan.mjs';

const n = (s) => X.num(String(s));
const S = (text) => LEFT.start(text);
// say(x) → what is left, as text with its count of operations
const say = (x) => `${LEFT.left(x)} #${LEFT.ops(x)}`;
// after(text, ...lines) → what is left of a calculation after true lines "working = value", in order
const after = (text, ...lines) => lines.reduce((x, l) => { const [w, v] = l.split(' = '); const r = LEFT.cross(x, w, n(v)); assert.ok(r !== null, `${l} crosses nothing off ${LEFT.left(x)}`); return r.left; }, S(text));
const how = (text, line) => { const [w, v] = line.split(' = '); const r = LEFT.cross(S(text), w, n(v)); return r === null ? null : `${r.how}: ${LEFT.left(r.left)}`; };

test('start: a calculation is held as written, and anything else is not held', () => {
  assert.equal(say(S('15 × 15 × 37')), '15 × 15 × 37 #2'); assert.equal(say(S('21 × 3 + 0.5 × 6 × 3 × 3')), '21 × 3 + 0.5 × 6 × 3 × 3 #5');
  assert.equal(say(S('(19 + 38) × 20 ÷ 2')), '(19 + 38) × 20 ÷ 2 #3'); assert.equal(say(S('38 x 13 - 19 * 12')), '38 × 13 - 19 × 12 #3');
  assert.equal(say(S('0.5 × (19 + 38) × 16')), '0.5 × (19 + 38) × 16 #3'); assert.equal(say(S('7')), '7 #0'); assert.equal(say(S('23^2 + 1')), '23^2 + 1 #2');
  assert.equal(say(S('100 - (30 + 7)')), '100 - (30 + 7) #2'); assert.equal(say(S('100 - 30 - 7')), '100 - 30 - 7 #2'); assert.equal(say(S('12 ÷ (2 + 4)')), '12 ÷ (2 + 4) #2');
  assert.equal(say(S('(2 + 3)^2')), '(2 + 3)^2 #2'); assert.equal(say(S('(12 ÷ 4) × 5')), '(12 ÷ 4) × 5 #2'); assert.equal(say(S('12 ÷ 4 ÷ 3')), '12 ÷ 4 ÷ 3 #2');
  assert.equal(say(S('2 + (3 + 4)')), '2 + (3 + 4) #2', 'a bracket after a plus sign is held: it is to be done first'); assert.equal(say(S('(2 + 3) + 4')), '2 + 3 + 4 #2'); assert.equal(say(S('2 × (3 × 4)')), '2 × 3 × 4 #2');
  assert.equal(say(S('2 + (3 + (4 + 5))')), '2 + (3 + (4 + 5)) #3'); assert.equal(say(S('-2 + (3 + 4)')), '-2 + (3 + 4) #2', 'a bracket is not moved to the front'); assert.equal(say(S('-2 + (3 + 4) + 5')), '5 - 2 + (3 + 4) #3');
  assert.equal(say(S('-5 + 3')), '3 - 5 #1', 'written with a number that is added first'); assert.equal(say(S('3 + -5')), '3 - 5 #1'); assert.equal(say(S('-5 - 3')), '-5 - 3 #1');
  assert.equal(say(S('-(2 × 3) - 4')), '-(2 × 3) - 4 #2'); assert.equal(say(S('-(2 + 3)')), '-(2 + 3) #1'); assert.equal(say(S('4 × -3')), '4 × -3 #1'); assert.equal(say(S('(-3)^2')), '(-3)^2 #1');
  assert.equal(say(S('2 × (3 + 4) × (5 - 1)')), '2 × (3 + 4) × (5 - 1) #4'); assert.equal(say(S('6 - 2 × 3 + 4')), '6 - 2 × 3 + 4 #3');
  for (const bad of ['', 'abc', '2 +', null, undefined, 7, {}, '2(3)', '1 ÷ 0']) assert.equal(S(bad), null, String(bad));
});

test('a true line crosses its step off: part of a product, part of a sum, a whole bracket', () => {
  assert.equal(say(after('15 × 15 × 37', '15 × 15 = 225')), '225 × 37 #1'); assert.equal(say(after('15 × 15 × 37', '15 × 37 = 555')), '555 × 15 #1');
  assert.equal(say(after('15 × 15 × 37', '15 × 15 = 225', '225 × 37 = 8325')), '8325 #0'); assert.equal(say(after('15 × 15 × 37', '37 × 15 × 15 = 8325')), '8325 #0');
  assert.equal(say(after('0.5 × 26 × 21 × 21', '21 × 21 = 441', '0.5 × 26 = 13', '13 × 441 = 5733')), '5733 #0');
  assert.equal(say(after('0.5 × 26 × 21 × 21', '26 × 21 = 546')), '0.5 × 546 × 21 #2', 'the result takes the place of the first number used');
  assert.equal(say(after('21 × 3 + 0.5 × 6 × 3 × 3', '21 × 3 = 63')), '63 + 0.5 × 6 × 3 × 3 #4'); assert.equal(say(after('21 × 3 + 0.5 × 6 × 3 × 3', '3 × 3 = 9', '0.5 × 6 = 3', '3 × 9 = 27', '21 × 3 = 63', '63 + 27 = 90')), '90 #0');
  assert.equal(say(after('13 × 12 + 19 × 8 + 26 × 4', '13 × 12 = 156', '19 × 8 = 152', '26 × 4 = 104', '156 + 104 = 260')), '260 + 152 #1', 'any two terms of a sum');
  assert.equal(say(after('(19 + 38) × 20 ÷ 2', '19 + 38 = 57')), '57 × 20 ÷ 2 #2'); assert.equal(say(after('(19 + 38) × 20 ÷ 2', '19 + 38 = 57', '57 × 20 = 1140', '1140 ÷ 2 = 570')), '570 #0');
  assert.equal(say(after('38 × 13 - 19 × 12', '38 × 13 = 494', '19 × 12 = 228', '494 - 228 = 266')), '266 #0');
  assert.equal(say(after('100 - 30 - 7', '30 + 7 = 37')), '100 - 37 #1', 'what is taken away can be added up first'); assert.equal(say(after('100 - 30 - 7', '100 - 30 = 70')), '70 - 7 #1');
  assert.equal(say(after('100 - 30 + 7', '30 - 7 = 23')), '100 - 23 #1'); assert.equal(say(after('100 - 30 + 7', '100 + 7 = 107')), '107 - 30 #1'); assert.equal(say(after('100 - 30 + 7', '7 - 30 = -23')), '100 - 23 #1');
  assert.equal(say(after('100 - (30 + 7)', '30 + 7 = 37')), '100 - 37 #1'); assert.equal(say(after('-(2 × 3) - 4', '2 × 3 = 6')), '-6 - 4 #1'); assert.equal(say(after('-(2 + 3)', '2 + 3 = 5')), '-5 #0');
  assert.equal(say(after('5 - 2 - 3', '2 + 3 = 5', '5 - 5 = 0')), '0 #0'); assert.equal(say(after('-2 - 3', '2 + 3 = 5')), '-5 #0');
  assert.equal(say(after('23^2 + 1', '23^2 = 529')), '529 + 1 #1'); assert.equal(say(after('12 ÷ (2 + 4)', '2 + 4 = 6', '12 ÷ 6 = 2')), '2 #0'); assert.equal(say(after('(2 + 3)^2', '2 + 3 = 5')), '5^2 #1');
  assert.equal(say(after('2 × (3 + 4) × (5 - 1)', '5 - 1 = 4', '3 + 4 = 7', '2 × 4 = 8')), '8 × 7 #1');
  assert.equal(how('15 × 15 × 37', '15 × 15 = 225'), 'step: 225 × 37');
});

test('a held bracket is done first: the split of a carry cannot be undone', () => {
  const x = S('270 + (4 + 8)');
  assert.equal(LEFT.cross(x, '270 + 4', n(274)), null, 'the 4 belongs to the bracket'); assert.equal(LEFT.cross(x, '270 + 8', n(278)), null);
  assert.equal(say(after('270 + (4 + 8)', '4 + 8 = 12')), '270 + 12 #1'); assert.equal(say(after('270 + (4 + 8)', '4 + 8 = 12', '270 + 12 = 282')), '282 #0');
  assert.equal(say(after('2 + (3 + 4 + 5)', '3 + 4 = 7')), '2 + (7 + 5) #2', 'a bracket that is still a sum is still held'); assert.equal(LEFT.cross(after('2 + (3 + 4 + 5)', '3 + 4 = 7'), '2 + 7', n(9)), null);
  assert.equal(say(after('2 + (3 + 4 + 5)', '6 + 6 = 12')), '2 + 12 #1', 'by value, the bracket as a whole'); assert.equal(say(after('2 + (3 + (4 + 5))', '6 + 3 = 9')), '2 + (3 + 9) #2', 'by value, inside a held bracket: it stays held');
  assert.equal(LEFT.cross(after('2 + (3 + (4 + 5))', '6 + 3 = 9'), '2 + 3', n(5)), null); assert.equal(say(after('8000 + (4 + 2) × 100 + 70', '4 + 2 = 6', '6 × 100 = 600', '8000 + 70 = 8070')), '8070 + 600 #1');
  assert.deepEqual(LEFT.atoms(x).map((a) => a.text), ['4 + 8']); assert.equal(LEFT.key(x), '+(+(4,8),270)');
});

test('a step that is asked for more than once is crossed off everywhere', () => {
  assert.equal(say(after('19 × 16 - 4 × (19 × 16 - 12 × 12)', '19 × 16 = 304')), '304 - 4 × (304 - 12 × 12) #4');
  assert.equal(say(after('21 × 21 + 21 × 21', '21 × 21 = 441')), '441 + 441 #1'); assert.equal(say(after('3 × 3 × 3 × 3', '3 × 3 = 9')), '9 × 9 #1');
  assert.equal(say(after('2 + 3 + 2 + 3', '2 + 3 = 5')), '5 + 5 #1');
});

test('the model splits a step its own way: a part of a known split is taken, and the split with it', () => {
  assert.equal(how('225 × 37', '225 × 30 = 6750'), 'split: 6750 + 225 × 7'); assert.equal(how('225 × 37', '200 × 37 = 7400'), 'split: 7400 + 20 × 37 + 5 × 37');
  assert.equal(how('225 × 37', '200 × 30 = 6000'), 'split: 6000 + 200 × 7 + 20 × 30 + 20 × 7 + 5 × 30 + 5 × 7'); assert.equal(how('15 × 15 × 37', '15 × 30 = 450'), 'split: (450 + 15 × 7) × 15');
  assert.equal(how('0.5 × 546', '546 ÷ 2 = 273'), 'split: 273'); assert.equal(how('0.5 × 26 × 441', '26 ÷ 2 = 13'), 'split: 13 × 441');
  assert.equal(how('6750 + 1575', '6750 + 1000 = 7750'), 'split: 7750 + 500 + 70 + 5'); assert.equal(how('6750 + 1575', '700 + 500 = 1200'), null, 'not a part of any split this file knows');
  assert.equal(how('8400 + 200', '4 + 2 = 6'), 'split: 8000 + 6 × 100'); assert.equal(how('274 + 8 + 1', '4 + 8 = 12'), 'split: 270 + 12 + 1'); assert.equal(how('400 + 200', '4 + 2 = 6'), 'split: 6 × 100');
  assert.equal(how('494 - 228', '494 - 200 = 294'), 'split: 294 - 20 - 8'); assert.equal(how('40 × 300', '4 × 3 = 12'), 'split: 12 × 1000'); assert.equal(how('23^2', '23 × 23 = 529'), 'split: 529');
  assert.equal(how('100 - 494 - 228', '494 + 200 = 694'), 'split: 100 - (694 + 20 + 8)', 'two numbers taken away, added up place by place');
  assert.equal(how('7406 ÷ 2', '7000 ÷ 2 = 3500'), 'split: 3500 + 400 ÷ 2 + 6 ÷ 2');
});

test('some other working that comes to exactly the value of an unfinished part crosses that part off', () => {
  assert.equal(how('225 × 37', '8000 + 325 = 8325'), 'value: 8325'); assert.equal(how('2 × (30 + 7) + 1', '40 - 3 = 37'), 'value: 2 × 37 + 1');
  assert.equal(how('2 × (30 + 7) + 1', '70 + 5 = 75'), 'value: 75', 'the outermost part of that value');
  assert.equal(how('12 ÷ (2 + 4)', '2 × 3 = 6'), 'value: 12 ÷ 6'); assert.equal(how('(2 + 3)^2', '1 + 4 = 5'), 'value: 5^2'); assert.equal(how('(2 + 3)^2', '5 × 5 = 25'), 'value: 25');
  assert.equal(how('2 × 3 + 4 × 5', '10 + 10 = 20'), 'value: 2 × 3 + 20'); assert.equal(how('7 - (2 + 3) × 4', '10 + 10 = 20'), 'value: 7 - 20');
});

test('a line crosses nothing off when it is false, is not working, or has nothing to do with what is left', () => {
  const x = S('15 × 15 × 37');
  assert.equal(LEFT.cross(x, '15 × 15', n(226)), null, 'a false line'); assert.equal(LEFT.cross(x, '19 + 20', n(39)), null); assert.equal(LEFT.cross(x, '225', n(225)), null, 'a bare number');
  assert.equal(LEFT.cross(x, 'abc', n(1)), null); assert.equal(LEFT.cross(x, '15 × 15', null), null); assert.equal(LEFT.cross(x, null, n(225)), null); assert.equal(LEFT.cross(null, '15 × 15', n(225)), null);
  assert.equal(LEFT.cross('x', '15 × 15', n(225)), null); assert.equal(LEFT.cross(S('8325'), '15 × 15', n(225)), null, 'nothing left to cross off');
  assert.equal(LEFT.cross(x, '15 × 15', '225'), null, 'the value is a number, not text'); assert.equal(LEFT.cross(x, '15 + 15', n(30)), null, 'a sum is not a part of a product');
  assert.equal(LEFT.cross(S('15 + 15 + 37'), '15 × 15', n(225)), null); assert.equal(LEFT.cross(S('100 - 30 - 7'), '100 + 30', n(130)), null, 'the signs must be the sum\'s own, or all the other way');
  assert.equal(LEFT.cross(S('100 - 30 + 7'), '30 + 7', n(37)), null); assert.equal(LEFT.cross(x, '15 × 15 × 15', n(3375)), null, 'more of a number than is there');
});

test('rewrite: a true line with working on both sides puts the second in place of the first', () => {
  const r = (text, a, b) => { const got = LEFT.rewrite(S(text), a, b); return got === null ? null : `${got.how}: ${say(got.left)}`; };
  assert.equal(r('21 × 3 + 0.5 × 6 × 3 × 3', '0.5 × 6 × 3 × 3', '0.5 × 54'), 'step: 21 × 3 + 0.5 × 54 #3'); assert.equal(r('15 × 15 × 37', '15 × 15 × 37', '225 × 37'), 'step: 225 × 37 #1');
  assert.equal(r('225 × 37', '225 × 37', '225 × 30 + 225 × 7'), 'step: 225 × 30 + 225 × 7 #3'); assert.equal(r('2 × 225 × 37', '225 × 37', '225 × 30 + 225 × 7'), 'step: 2 × (225 × 30 + 225 × 7) #4');
  assert.equal(r('15 × 15 × 37', '15 × 15', '226 - 0'), null, 'a false line'); assert.equal(r('15 × 15 × 37', '16 × 16', '256 + 0'), null, 'not a part of what is left');
  assert.equal(r('15 × 15 × 37', '225', '15 × 15'), null, 'the first side must be working'); assert.equal(r('15 × 15 × 37', 'x', '15 × 15'), null); assert.equal(r('15 × 15 × 37', '15 × 15', 'x'), null);
  assert.equal(LEFT.rewrite(null, '15 × 15', '225 + 0'), null); assert.equal(LEFT.rewrite('x', '15 × 15', '225 + 0'), null); assert.equal(LEFT.rewrite(S('15 × 15'), null, undefined), null);
  assert.equal(r('15 × 15 × 37', '15 × 15', '225'), 'step: 225 × 37 #1', 'a plain number on the second side works as well');
});

test('wrong: a false line about a step that is left has the step split; about anything else it changes nothing', () => {
  const w = (text, working) => { const r = LEFT.wrong(S(text), working); return r === null ? null : `${r.on ? 'on' : 'off'} | ${r.split} | ${LEFT.left(r.left)}`; };
  assert.equal(w('225 × 37', '225 × 37'), 'on | 225 × 37 = 225 × 30 + 225 × 7 | 225 × 30 + 225 × 7'); assert.equal(w('15 × 15 × 37', '15 × 37'), 'on | 15 × 37 = 15 × 30 + 15 × 7 | (15 × 30 + 15 × 7) × 15');
  assert.equal(w('63 + 27', '63 + 27'), 'on | 63 + 27 = 63 + 20 + 7 | 63 + 20 + 7'); assert.equal(w('8400 + 200 + 70', '8400 + 200'), 'on | 8400 + 200 = 8000 + (4 + 2) × 100 | 8000 + (4 + 2) × 100 + 70');
  assert.equal(w('1 + 274 + 8', '274 + 8'), 'on | 274 + 8 = 270 + (4 + 8) | 1 + 270 + (4 + 8)'); assert.equal(w('8000 + 600', '8000 + 600'), 'on | null | 8000 + 600', 'no digit in that place: nothing smaller'); assert.equal(w('494 - 228', '494 - 228'), 'on | 494 - 228 = 494 - 200 - 20 - 8 | 494 - 200 - 20 - 8');
  assert.equal(w('0.5 × 26 × 21 × 21', '0.5 × 26 × 21'), 'on | null | 0.5 × 26 × 21 × 21', 'more than one operation: left as it is');
  assert.equal(w('7 × 8 + 1', '7 × 8'), 'on | null | 7 × 8 + 1', 'nothing smaller to offer'); assert.equal(w('15 × 15 × 37', '19 + 20'), 'off | null | 15 × 15 × 37');
  assert.equal(w('15 × 15 × 37', '16 × 16'), 'off | null | 15 × 15 × 37'); assert.equal(w('0.5 × 546', '0.5 × 546'), 'on | 0.5 × 546 = 546 ÷ 2 | 546 ÷ 2');
  // a wrong part of a split the model made its own way: the split is taken, and the wrong part is split again
  assert.equal(w('225 × 37', '225 × 7'), 'on | 225 × 7 = 200 × 7 + 20 × 7 + 5 × 7 | 225 × 30 + 200 × 7 + 20 × 7 + 5 × 7');
  assert.equal(w('225 × 37', '200 × 30'), 'on | 200 × 30 = 2 × 3 × 1000 | 2 × 3 × 1000 + 200 × 7 + 20 × 30 + 20 × 7 + 5 × 30 + 5 × 7');
  assert.equal(w('40 × 300', '4 × 3'), 'on | null | 4 × 3 × 1000', 'the split is taken even when its wrong part has nothing smaller');
  assert.equal(w('100 - 30 - 7', '30 + 7'), 'on | null | 100 - 30 - 7'); assert.equal(w('100 - 300 - 70', '300 + 70'), 'on | null | 100 - 300 - 70', 'one part each: nothing smaller');
  assert.equal(w('100 - 345 - 78', '345 + 78'), 'on | 345 + 78 = 345 + 70 + 8 | 100 - (345 + 70 + 8)');
  for (const bad of [null, undefined, '', 'abc', '225', 7]) assert.equal(LEFT.wrong(S('225 × 37'), bad), null, String(bad));
  assert.equal(LEFT.wrong(null, '225 × 37'), null); assert.equal(LEFT.wrong('x', '225 × 37'), null);
});

test('atoms: every single step that could be done next, each once', () => {
  const a = (text) => LEFT.atoms(S(text)).map((x) => x.text);
  assert.deepEqual(a('15 × 15 × 37'), ['15 × 15', '15 × 37']); assert.deepEqual(a('0.5 × 26 × 21 × 21'), ['0.5 × 26', '0.5 × 21', '26 × 21', '21 × 21']);
  assert.deepEqual(a('21 × 3 + 0.5 × 6 × 3 × 3'), ['21 × 3', '0.5 × 6', '0.5 × 3', '6 × 3', '3 × 3']); assert.deepEqual(a('(19 + 38) × 20 ÷ 2'), ['19 + 38']);
  assert.deepEqual(a('100 - 30 - 7'), ['100 - 30', '100 - 7', '30 + 7']); assert.deepEqual(a('100 - 30 + 7'), ['100 - 30', '100 + 7', '7 - 30']); assert.deepEqual(a('-30 + 100'), ['100 - 30']);
  assert.deepEqual(a('1140 ÷ 2'), ['1140 ÷ 2']); assert.deepEqual(a('23^2 + 1'), ['23^2']); assert.deepEqual(a('8325'), []); assert.deepEqual(a('2 × (3 + 4)'), ['3 + 4']);
  assert.deepEqual(a('63 + 27 + 5'), ['63 + 27', '63 + 5', '27 + 5']); assert.deepEqual(a('12 ÷ (2 + 4)'), ['2 + 4']); assert.deepEqual(a('(2 + 3)^2'), ['2 + 3']);
  assert.deepEqual(LEFT.atoms(S('15 × 15 × 37')), [{ text: '15 × 15', canon: '*(15,15)' }, { text: '15 × 37', canon: '*(15,37)' }], 'the key is the checker\'s own key for that working');
  assert.deepEqual(LEFT.atoms(S('100 - 30')), [{ text: '100 - 30', canon: X.evaluate('100 - 30').canon }]); assert.deepEqual(a('4 × -3'), ['4 × -3']);
});

test('key: one spelling for every order of a product or a sum, and a different one for anything else', () => {
  const k = (t) => LEFT.key(S(t));
  assert.equal(k('15 × 37 × 15'), k('37 × 15 × 15')); assert.equal(k('1 + 2 - 3'), k('2 - 3 + 1')); assert.notEqual(k('1 + 2 - 3'), k('1 - 2 + 3')); assert.notEqual(k('12 ÷ 4'), k('4 ÷ 12'));
  assert.notEqual(k('2^3'), k('3^2')); assert.equal(k('2 × (3 + 4)'), k('(4 + 3) × 2')); assert.notEqual(k('2 × 3 + 4'), k('2 × (3 + 4)')); assert.equal(k('7'), '7');
  assert.equal(k('15 × 15 × 37'), '*(15,15,37)'); assert.equal(k('100 - 30 + 7'), '+(-30,100,7)'); assert.equal(k('12 ÷ (2 + 4)'), '/(12,+(2,4))'); assert.equal(k('(2 + 3)^2'), '^(+(2,3),2)');
});

test('the law: whatever is crossed off, split or rewritten, what is left has the value it started with, and reads back as itself', () => {
  let s = 7;
  const r = (lo, hi) => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return lo + (s >>> 8) % (hi - lo + 1); };
  const num = () => (r(0, 9) === 0 ? '0.5' : String(r(2, r(0, 1) ? 99 : 999)));
  const expr = (d) => { if (d === 0 || r(0, 3) === 0) return num(); const a = expr(d - 1), b = expr(d - 1), op = ['×', '+', '-', '×', '+'][r(0, 4)]; return r(0, 4) === 0 ? `(${a} ${op} ${b})` : `${a} ${op} ${b}`; };
  let crossed = 0, splits = 0, finished = 0;
  for (let i = 0; i < 250; i++) {
    const text = expr(3), value = X.evaluate(text).value;
    let x = S(text);
    assert.ok(x !== null, text);
    for (let step = 0; step < 60 && LEFT.ops(x) > 0; step++) {
      // it reads back as itself
      assert.equal(LEFT.key(S(LEFT.left(x))), LEFT.key(x), `${text} → ${LEFT.left(x)}`);
      assert.equal(LEFT.ops(S(LEFT.left(x))), LEFT.ops(x));
      const atoms = LEFT.atoms(x);
      assert.ok(atoms.length > 0, `something is left of ${LEFT.left(x)} but no step can be done`);
      const a = atoms[r(0, atoms.length - 1)], roll = r(0, 5);
      if (roll === 0) {
        // a false line about a step that is left
        const w = LEFT.wrong(x, a.text);
        assert.equal(w.on, true, `${a.text} in ${LEFT.left(x)}`);
        assert.ok(X.same(w.left.value, value));
        assert.equal(w.split === null, P.split(a.text) === null);
        if (w.split !== null) { splits++; assert.equal(P.holds(w.split), true); assert.ok(LEFT.ops(w.left) >= LEFT.ops(x)); assert.notEqual(LEFT.key(w.left), LEFT.key(x)); }
        x = w.left;
      } else {
        const got = LEFT.cross(x, a.text, X.evaluate(a.text).value);
        assert.ok(got !== null, `${a.text} crosses nothing off ${LEFT.left(x)}`);
        assert.equal(got.how, 'step'); assert.ok(X.same(got.left.value, value)); assert.ok(LEFT.ops(got.left) < LEFT.ops(x));
        // a false value for the same step crosses nothing off
        assert.equal(LEFT.cross(x, a.text, X.add(X.evaluate(a.text).value, n(1))), null);
        x = got.left; crossed++;
      }
    }
    if (LEFT.ops(x) === 0) { finished++; assert.ok(X.same(x.value, value)); assert.equal(LEFT.left(x), X.show(value)); assert.deepEqual(LEFT.atoms(x), []); }
  }
  assert.ok(crossed > 1000 && splits > 100, `${crossed} ${splits}`); assert.equal(finished, 250, "every calculation is finished by doing its steps");
});

test('nothing throws on anything', () => {
  const two = S('2 × 3'), six = S('6');
  for (const bad of [null, undefined, 7, 'x', {}, [], { op: 'n' }, { op: 'n', value: 6 }, { op: '*', items: 5, value: six.value }, { op: '*', items: [six], value: six.value }, { op: '*', items: [six, null], value: six.value }, { op: '+', terms: [], value: six.value }, { op: '+', terms: [{ node: six }], value: six.value }, { op: '+', terms: [{ neg: false, node: {} }], value: six.value }, { op: '+', terms: [null], value: six.value }, { op: '/', args: [six], value: six.value }, { op: '/', args: [six, six, six], value: six.value }, { op: '?', args: [six, six], value: six.value }, { ...two, value: null }, { ...two, value: { n: 6, d: 1 } }]) {
    assert.equal(LEFT.cross(bad, '2 × 3', n(6)), null); assert.equal(LEFT.wrong(bad, '2 × 3'), null); assert.equal(LEFT.rewrite(bad, '2 × 3', '3 + 3'), null);
    assert.equal(LEFT.start(bad), null); assert.equal(LEFT.left(bad), ''); assert.equal(LEFT.ops(bad), 0); assert.equal(LEFT.key(bad), ''); assert.deepEqual(LEFT.atoms(bad), []);
  }
});

test('the edges the gate asked about: nought, a power or a bracket in front of a division, a search that finds nothing', () => {
  assert.equal(say(S('0 ÷ 5')), '0 ÷ 5 #1'); assert.equal(say(S('2^0')), '2^0 #1'); assert.equal(say(S('0^2')), '0^2 #1'); assert.equal(say(S('2^3 ÷ 4')), '2^3 ÷ 4 #2');
  assert.equal(say(S('(2 + 3) ÷ 5')), '(2 + 3) ÷ 5 #2'); assert.equal(say(S('2 × 3 ÷ 4')), '2 × 3 ÷ 4 #2'); assert.equal(say(S('12 ÷ 4 ÷ 3')), '12 ÷ 4 ÷ 3 #2'); assert.equal(say(S('(-6) ÷ 2')), '(-6) ÷ 2 #1');
  // a search by value that finds nothing, through a division and a power, finds nothing and does not fall over
  assert.equal(LEFT.cross(S('12 ÷ 4 + 5'), '1 + 1', n(2)), null); assert.equal(LEFT.cross(S('2^3 + 5'), '1 + 1', n(2)), null); assert.equal(LEFT.cross(S('(12 ÷ 4)^2'), '1 + 1', n(2)), null);
  // a number that cannot be written as a decimal makes no step: nothing is offered that is more than one operation
  const third = LEFT.cross(S('(1 ÷ 3) × 6'), '1 ÷ 3', X.make(1n, 3n)).left;
  assert.equal(say(third), '1/3 × 6 #1'); assert.deepEqual(LEFT.atoms(third), []);
  assert.deepEqual(LEFT.atoms(S('2 × 3 × 4')).map((a) => a.text), ['2 × 3', '2 × 4', '3 × 4']); assert.deepEqual(LEFT.atoms(S('2 + 3 - 4')).map((a) => a.text), ['2 + 3', '2 - 4', '3 - 4']);
  assert.deepEqual(LEFT.atoms(S('5 × 5 × 5')).map((a) => a.text), ['5 × 5'], 'a pair is offered once'); assert.deepEqual(LEFT.atoms(S('7 × 2')).map((a) => a.text), ['7 × 2']);
});
