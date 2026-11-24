import { test } from 'node:test';
import assert from 'node:assert/strict';
import C from '../src/checker.mjs';

const V = (value) => ({ check: { type: 'value', value: String(value) } });
const texts = (xs) => xs.map((x) => x.text);

test('claimsOf: a line with an equals sign and working is a claim, ruled exactly', () => {
  const c = C.claimsOf('23 × 23 = 529\n14 × 529 = 7306\n7406 ÷ 2 = 3703 J');
  assert.deepEqual(c.map((x) => [x.line, x.left, x.right, x.ok]), [[0, '23 × 23', '529', true], [1, '14 × 529', '7306', false], [2, '7406 ÷ 2', '3703', true]]);
  assert.deepEqual(c.map((x) => x.fact), ['23 × 23 = 529', null, '7406 ÷ 2 = 3703']);
  assert.equal(c[0].canon, '*(23,23)');
  // a chain of equals signs is one claim per neighbouring pair
  assert.deepEqual(C.claimsOf('0.5 × 14 × 529 = 7 × 529 = 3703').map((x) => [x.left, x.right, x.ok, x.fact]), [['0.5 × 14 × 529', '7 × 529', true, null], ['7 × 529', '3703', true, '7 × 529 = 3703']]);
  // the number may be on the left
  assert.deepEqual(C.claimsOf('529 = 23 × 23').map((x) => [x.ok, x.canon, x.fact]), [[true, '*(23,23)', '23 × 23 = 529']]);
  assert.deepEqual(C.claimsOf('530 = 23 × 23').map((x) => [x.ok, x.fact]), [[false, null]]);
});

test('claimsOf: labels and loose words are let go, and what cannot be read is not a claim', () => {
  const ok = (line) => C.claimsOf(line).map((x) => [x.left, x.right, x.ok]);
  assert.deepEqual(ok('Step 1: 23 × 23 = 529'), [['23 × 23', '529', true]]); assert.deepEqual(ok('1. 23 × 23 = 529'), [['23 × 23', '529', true]]);
  assert.deepEqual(ok('- 23 × 23 = 529'), [['23 × 23', '529', true]]); assert.deepEqual(ok('(2) 23 × 23 = 529.'), [['23 × 23', '529', true]]);
  assert.deepEqual(ok('So 14 × 529 = 7406'), [['14 × 529', '7406', true]]); assert.deepEqual(ok('Kinetic energy: 0.5 × 14 = 7;'), [['0.5 × 14', '7', true]]);
  assert.deepEqual(ok('KE = 0.5 × 14 × 529 = 3703'), [['0.5 × 14 × 529', '3703', true]]);
  assert.deepEqual(ok('v2 = 23² = 529'), [['23^2', '529', true]], 'a name glued to a number is not arithmetic, so it is not ruled wrong');
  for (const line of ['529 = 529', 'x = 5', 'the answer is 12', '', '23 × 23', '23 × 23 ≈ 530', '5 > 3 = true', '2 + 2 ≠ 5', 'mass = 14 kg', 'v = u + at']) assert.deepEqual(C.claimsOf(line), [], line);
  assert.deepEqual(C.claimsOf('ANSWER: 2 + 2 = 5'), [], 'the answer line is ruled as the answer, not as a step');
  assert.deepEqual(C.claimsOf(null), []); assert.deepEqual(C.claimsOf(42), []);
  assert.deepEqual(ok('first 2 + 2 = 4 then'), [], 'words after the working make the side unreadable');
  assert.deepEqual(ok('so then 2 + 2 = 4'), [['2 + 2', '4', true]]);
});

test('answerOf: the last ANSWER line, as it was given', () => {
  assert.equal(C.answerOf('working\nANSWER: 3703').text, '3703'); assert.equal(C.answerOf('ANSWER: 1\nmore\nAnswer: 2').text, '2', 'the last one counts');
  assert.equal(C.answerOf('Final answer: 3703 J.').text, '3703 J'); assert.equal(C.answerOf('**ANSWER:** 12').text, '12'); assert.equal(C.answerOf('answer = 12').text, '12');
  assert.equal(C.answerOf('no such line'), null); assert.equal(C.answerOf(''), null); assert.equal(C.answerOf(null), null); assert.equal(C.answerOf('The answers vary'), null);
  const a = C.answerOf('ANSWER: 14 × 529 = 7406');
  assert.deepEqual([a.text, String(a.value.n)], ['14 × 529 = 7406', '7406']);
  assert.equal(C.answerOf('ANSWER: 14 × 529').value, null, 'working is not an answer: the number has to be stated');
  assert.equal(C.answerOf('ANSWER: about twelve').value, null);
  assert.deepEqual(C.answerOf('ANSWER: 101 × 113').numbers.map((f) => String(f.n)), ['101', '113']); assert.deepEqual(C.answerOf('ANSWER: 101, 113').numbers.map((f) => String(f.n)), ['101', '113']);
  assert.deepEqual(C.answerOf('ANSWER: -4').numbers.map((f) => String(f.n)), ['-4']); assert.equal(String(C.answerOf('ANSWER: 1,776').value.n), '1776');
});

test('home: three finish lines, none of them a model', () => {
  const ans = (t) => C.answerOf(`ANSWER: ${t}`);
  assert.equal(C.home(V(3703), ans('3703')), true); assert.equal(C.home(V(3703), ans('3703 J')), true); assert.equal(C.home(V(3703), ans('3,703')), true); assert.equal(C.home(V(3703), ans('x = 3703')), true);
  assert.equal(C.home(V(3703), ans('3704')), false); assert.equal(C.home(V(3703), ans('0.5 × 14 × 529')), false); assert.equal(C.home(V(3703), null), false); assert.equal(C.home(V(3703), ans('none')), false);
  assert.equal(C.home(V(-64), ans('-64')), true); assert.equal(C.home(V(-64), ans('64')), false); assert.equal(C.home(V('0.5'), ans('0.5')), true); assert.equal(C.home(V('0.5'), ans('1/2')), false, 'working is not a stated number');
  const F = { check: { type: 'factors', n: '11413' } };
  assert.equal(C.home(F, ans('101 × 113')), true); assert.equal(C.home(F, ans('113 and 101')), true); assert.equal(C.home(F, ans('1 × 11413')), false, 'one is not a prime factor');
  assert.equal(C.home(F, ans('101 × 112')), false); assert.equal(C.home(F, ans('101')), false); assert.equal(C.home(F, ans('101 × 113 × 1')), true, 'a 1 beside the two factors is ignored');
  assert.equal(C.home(F, ans('101 × 113 × 2')), false); assert.equal(C.home({ check: { type: 'factors', n: 'x' } }, ans('101 × 113')), false); assert.equal(C.home(F, ans('50.5 × 226')), false);
  const R = { check: { type: 'root', n: '1788', b: '5' } };
  assert.equal(C.home(R, ans('12')), true); assert.equal(C.home(R, ans('x = 12')), true); assert.equal(C.home(R, ans('11')), false); assert.equal(C.home(R, ans('13')), false); assert.equal(C.home(R, ans('twelve')), false);
  assert.equal(C.home({ check: { type: 'root', n: '1788' } }, ans('12')), false); assert.equal(C.home({ check: { type: 'root', b: '5' } }, ans('12')), false);
  assert.equal(C.home({ check: { type: 'root', n: '1788', b: '5.5' } }, ans('12')), false);
  for (const t of [null, {}, { check: null }, { check: { type: 'other', value: '1' } }, { check: { type: 'value' } }]) assert.equal(C.home(t, ans('1')), false);
});

test('rule: the whole ruling on a reply', () => {
  const reply = 'Step 1: 23 × 23 = 529\nSo 14 × 529 = 7306\n7406 ÷ 2 = 3703 J\n23 × 23 = 529\nv2 = 23² = 529\n14 × 529 = 7306\nANSWER: 3703 J';
  const r = C.rule(reply, V(3703));
  assert.deepEqual(texts(r.kept), ['23 × 23 = 529', '7406 ÷ 2 = 3703', '23^2 = 529']);
  assert.deepEqual(texts(r.dropped), ['14 × 529 = 7306'], 'the same claim twice is ruled once');
  assert.deepEqual(r.kept[0], { text: '23 × 23 = 529', canon: '*(23,23)', fact: '23 × 23 = 529' });
  assert.deepEqual(r.dropped[0], { text: '14 × 529 = 7306', canon: '*(14,529)' });
  assert.deepEqual([r.answer, r.home], ['3703 J', true]);
  const wrong = C.rule('2 + 2 = 4\nANSWER: 5', V(4));
  assert.deepEqual([wrong.kept.length, wrong.dropped.length, wrong.answer, wrong.home], [1, 0, '5', false]);
  const none = C.rule('I think it is twelve.', V(12));
  assert.deepEqual(none, { kept: [], dropped: [], answer: null, home: false });
  assert.deepEqual(C.rule(null, null), { kept: [], dropped: [], answer: null, home: false });
  // the same working with two different values: one kept, one dropped, both reported
  const two = C.rule('3 × 4 = 12\n3 × 4 = 13', V(12));
  assert.deepEqual([texts(two.kept), texts(two.dropped)], [['3 × 4 = 12'], ['3 × 4 = 13']]);
});

test('nothing throws, whatever it is handed', () => {
  for (const j of [null, undefined, 0, {}, [], '\u0000=\u0000', '=', '====', 'ANSWER:', 'ANSWER: =', '= = =\n= 1', '1 = 1 = 1 = 2', 'a'.repeat(5000)]) {
    assert.doesNotThrow(() => C.claimsOf(j)); assert.doesNotThrow(() => C.answerOf(j)); assert.doesNotThrow(() => C.rule(j, j)); assert.doesNotThrow(() => C.home(j, j)); assert.doesNotThrow(() => C.home({ check: { type: 'value', value: j } }, { value: j, numbers: j }));
  }
});

test('claimsOf: working rewritten line under line with no equals sign is a claim only when the two lines agree', () => {
  const c = (text) => C.claimsOf(text).map((x) => [x.line, x.left, x.right, x.ok, x.canon, x.fact]);
  assert.deepEqual(c('0.5 × (19 + 38) × 16\n0.5 × 57 × 16\n0.5 × 912\n456\nANSWER: 456'), [
    [1, '0.5 × (19 + 38) × 16', '0.5 × 57 × 16', true, '*(+(19,38),0.5,16)', null], [2, '0.5 × 57 × 16', '0.5 × 912', true, '*(0.5,16,57)', null], [3, '0.5 × 912', '456', true, '*(0.5,912)', '0.5 × 912 = 456']]);
  assert.deepEqual(c('0.5 × 57 × 16\n0.5 × 894\nANSWER: 447'), [], 'lines that do not agree claim nothing, so nothing is dropped');
  assert.deepEqual(c('57\n19 + 38'), [[1, '57', '19 + 38', true, '+(19,38)', '19 + 38 = 57']], 'the number may come first');
  assert.deepEqual(c('57\n57'), [], 'two bare numbers are not working'); assert.deepEqual(c('19 + 38\n38 + 19'), [], 'the same working again is not a step');
  assert.deepEqual(c('19 + 38\nso\n57'), [], 'a line of words between them breaks the chain'); assert.deepEqual(c('19 + 38\nANSWER: 57\n57'), []);
  assert.deepEqual(c('19 + 38\n2 + 2 = 4\n57'), [[1, '2 + 2', '4', true, '+(2,2)', '2 + 2 = 4']], 'a line with an equals sign is its own claim and breaks the chain');
  assert.deepEqual(c('19 + 38\n2 + 2 ≈ 4\n57'), []); assert.deepEqual(c('Step 1: 19 + 38\n- 57'), [[1, '19 + 38', '57', true, '+(19,38)', '19 + 38 = 57']], 'labels are let go here too');
  assert.deepEqual(c('19 + 38\n57\n50 + 7\n57'), [[1, '19 + 38', '57', true, '+(19,38)', '19 + 38 = 57'], [2, '57', '50 + 7', true, '+(50,7)', '50 + 7 = 57'], [3, '50 + 7', '57', true, '+(50,7)', '50 + 7 = 57']]);
  const r = C.rule('0.5 × (19 + 38) × 16\n0.5 × 57 × 16\n0.5 × 912\n456\nANSWER: 456', V(456));
  assert.deepEqual([texts(r.kept), r.dropped, r.home], [['0.5 × (19 + 38) × 16 = 0.5 × 57 × 16', '0.5 × 57 × 16 = 0.5 × 912', '0.5 × 912 = 456'], [], true]);
});
