import { test } from 'node:test';
import assert from 'node:assert/strict';
import X from '../src/exact.mjs';

const v = (t) => { const e = X.evaluate(t); return e === null ? null : X.show(e.value); };
const f = (n, d = 1n) => X.make(BigInt(n), BigInt(d));

test('make: lowest terms, the sign on top, null when it cannot be a number', () => {
  assert.deepEqual(X.make(6n, 4n), { n: 3n, d: 2n }); assert.deepEqual(X.make(6n, -4n), { n: -3n, d: 2n }); assert.deepEqual(X.make(-6n, -4n), { n: 3n, d: 2n });
  assert.deepEqual(X.make(0n, 7n), { n: 0n, d: 1n }); assert.deepEqual(X.make(5n), { n: 5n, d: 1n });
  assert.equal(X.make(1n, 0n), null); assert.equal(X.make(1, 2n), null); assert.equal(X.make(1n, 2), null); assert.equal(X.make('1', 1n), null);
  const big = 10n ** 60n;
  assert.deepEqual(X.make(big, 1n), { n: big, d: 1n }); assert.equal(X.make(big + 1n, 1n), null); assert.equal(X.make(-big - 1n, 1n), null);
  assert.deepEqual(X.make(1n, big), { n: 1n, d: big }); assert.equal(X.make(1n, big + 1n), null);
});

test('the four operations and powers are exact, and pass null on', () => {
  assert.deepEqual(X.add(f(1, 2), f(1, 3)), f(5, 6)); assert.deepEqual(X.sub(f(1, 2), f(1, 3)), f(1, 6)); assert.deepEqual(X.mul(f(2, 3), f(3, 4)), f(1, 2));
  assert.deepEqual(X.div(f(1, 2), f(1, 4)), f(2)); assert.equal(X.div(f(1), f(0)), null); assert.deepEqual(X.div(f(0), f(5)), f(0));
  for (const op of [X.add, X.sub, X.mul, X.div, X.pow]) { assert.equal(op(null, f(1)), null); assert.equal(op(f(1), null), null); assert.equal(op({ n: 1, d: 1 }, f(1)), null); assert.equal(op(f(1), { n: 1n }), null); }
  assert.deepEqual(X.pow(f(23), f(2)), f(529)); assert.deepEqual(X.pow(f(2), f(-2)), f(1, 4)); assert.deepEqual(X.pow(f(7), f(0)), f(1)); assert.deepEqual(X.pow(f(-2), f(3)), f(-8));
  assert.deepEqual(X.pow(f(2, 3), f(2)), f(4, 9)); assert.equal(X.pow(f(0), f(-1)), null); assert.equal(X.pow(f(2), f(1, 2)), null, 'no roots');
  assert.deepEqual(X.pow(f(1), f(64)), f(1)); assert.equal(X.pow(f(1), f(65)), null); assert.equal(X.pow(f(1), f(-65)), null); assert.deepEqual(X.pow(f(1), f(-64)), f(1));
  assert.equal(X.pow(f(10), f(61)), null, 'past the size limit');
  assert.equal(X.same(f(1, 2), f(2, 4)), true); assert.equal(X.same(f(1, 2), f(1, 3)), false); assert.equal(X.same(f(1, 2), f(3, 2)), false); assert.equal(X.same(null, null), false); assert.equal(X.same(f(1), null), false); assert.equal(X.same(null, f(1)), false);
});

test('num reads a plain number and nothing else', () => {
  for (const [t, n, d] of [['3703', 3703, 1], ['1,776', 1776, 1], ['12,345,678', 12345678, 1], ['0.5', 1, 2], ['.5', 1, 2], ['-12', -12, 1], ['+7', 7, 1], [' 42 ', 42, 1], ['1,234.50', 2469, 2], ['-0.25', -1, 4], ['007', 7, 1]]) assert.deepEqual(X.num(t), f(n, d), t);
  for (const t of ['', ' ', '12.', '1,77', '1,7767', 'abc', '1 2', '1.2.3', '--1', '.', '-', '1e3', null, undefined, 12, '9'.repeat(41)]) assert.equal(X.num(t), null, String(t));
  assert.deepEqual(X.num('9'.repeat(40)), f('9'.repeat(40)));
  assert.equal(X.num('1'.repeat(20) + '.' + '1'.repeat(21)), null, 'digits on both sides count');
});

test('show writes a fraction the way people do', () => {
  for (const [n, d, s] of [[3703, 1, '3703'], [1, 2, '0.5'], [1, 4, '0.25'], [-1, 4, '-0.25'], [1, 8, '0.125'], [3, 20, '0.15'], [7, 50, '0.14'], [1, 3, '1/3'], [-2, 3, '-2/3'], [22, 7, '22/7'], [0, 1, '0'], [-5, 1, '-5'], [5, 2, '2.5'], [1, 1000, '0.001'], [12345, 100, '123.45'], [1, 6, '1/6'], [1, 40, '0.025'], [1, 250, '0.004']]) assert.equal(X.show(f(n, d)), s);
  assert.equal(X.show(null), ''); assert.equal(X.show({}), ''); assert.equal(X.show({ n: 1, d: 1 }), '');
  for (const t of ['0.5', '12.75', '-3.125', '1000', '0.004']) assert.equal(X.show(X.num(t)), t, 'show undoes num');
});

test('evaluate: the working a reply can contain, worked out exactly', () => {
  for (const [t, want] of [
    ['0.5 × 14 × 23²', '3703'], ['23 x 23', '529'], ['23 X 23', '529'], ['1,776 / 2', '888'], ['(37*48+912)*6', '16128'], ['-3^2', '-9'], ['(-3)^2', '9'], ['2^3^2', '512'],
    ['14 kg × 23 m/s', '322'], ['½ × 14 × 529 J', '3703'], ['3 - -2', '5'], ['2^-2', '0.25'], ['10 m/s^2 × 3 s', '30'], ['1/3', '1/3'], ['12 × 5 N', '60'], ['.5*4', '2'],
    ['7 − 2', '5'], ['7 – 2', '5'], ['8 ÷ 4', '2'], ['2 · 3', '6'], ['2³', '8'], ['¼ + ¾', '1'], ['100 - 20 - 30', '50'], ['100 / 5 / 2', '10'], ['2 + 3 * 4', '14'], ['(2 + 3) * 4', '20'],
    ['12 joules + 3 joules', '15'], ['6 V / 2 Ω', '3'], ['5 m/s² × 2 kg', '10'], ['4 kg·m/s + 1', '5'], ['3 metres × 2', '6'], ['9 Pa × 2 m', '18'], ['((2))', '2'], ['  42  ', '42'], ['-(4 - 6)', '2'],
  ]) assert.equal(v(t), want, t);
  for (const t of ['2(3)', '7 ÷ 0', 'v2', 'abc', '', ' ', '2 +', '* 2', '(2', '2)', '2 3', '2 ** 3', '1,77 + 1', 'x', '2 x', 'x 2', '4 apples', '2^(1/2)', '5 mx', '=', '2 = 2', null, undefined, 5, {}, '1+'.repeat(120) + '1', '('.repeat(30) + '1' + ')'.repeat(30), 'a'.repeat(500)]) assert.equal(X.evaluate(t), null, String(t).slice(0, 30));
  assert.equal(v('('.repeat(24) + '1' + ')'.repeat(24)), '1', 'brackets up to the depth limit');
  assert.equal(v('1+'.repeat(99) + '1'), '100', 'tokens up to the limit');
});

test('evaluate: one key for the same working, a count of operations, and one plain way of writing it', () => {
  const e = X.evaluate('0.5 × 14 × 23²');
  assert.deepEqual([e.canon, e.ops, e.shown], ['*(0.5,14,^(23,2))', 3, '0.5 × 14 × 23^2']);
  assert.equal(X.evaluate('23 × 14').canon, X.evaluate('14 x 23').canon); assert.equal(X.evaluate('3 + 4 + 5').canon, X.evaluate('5 + 3 + 4').canon);
  assert.notEqual(X.evaluate('7 - 2').canon, X.evaluate('2 - 7').canon); assert.notEqual(X.evaluate('8 / 4').canon, X.evaluate('4 / 8').canon);
  assert.notEqual(X.evaluate('2 + 3 * 4').canon, X.evaluate('(2 + 3) * 4').canon); assert.notEqual(X.evaluate('2 * 3').canon, X.evaluate('2 + 3').canon);
  assert.equal(X.evaluate('(2 * 3) * 4').canon, '*(2,3,4)'); assert.equal(X.evaluate('2 * (3 + 4)').canon, '*(+(3,4),2)'); assert.equal(X.evaluate('-5').canon, 'neg(5)');
  assert.deepEqual([X.evaluate('42').ops, X.evaluate('42').canon, X.evaluate('1,776').shown], [0, '42', '1776']);
  assert.equal(X.evaluate('-3 - -2').shown, '-3 - -2'); assert.equal(X.evaluate('(1,776 ÷ 2) + 0.50').shown, '(1776 ÷ 2) + 0.5'); assert.equal(X.evaluate('2*-3').shown, '2 × -3'); assert.equal(X.evaluate('2^-3').shown, '2^-3');
  assert.equal(X.evaluate('14 kg × 23 m/s').shown, '14 × 23');
});

test('evaluate agrees with whole-number arithmetic done directly, on generated working', () => {
  let s = 12345;
  const r = (n) => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s % n; };
  for (let i = 0; i < 400; i++) {
    const a = BigInt(r(90) + 10), b = BigInt(r(90) + 10), c = BigInt(r(9) + 1), d = BigInt(r(90) + 10);
    assert.equal(v(`${a} × ${b} + ${c} × ${d}`), String(a * b + c * d));
    assert.equal(v(`(${a} - ${b}) * ${c} - ${d}`), String((a - b) * c - d));
    assert.equal(v(`${a} × ${a} × ${b} / 2`), X.show(X.make(a * a * b, 2n)));
    assert.equal(v(`${a}^2 - ${b}^2`), String(a * a - b * b));
  }
});

test('nothing throws, whatever it is handed', () => {
  const junk = [null, undefined, 0, 1n, NaN, {}, [], () => 1, Symbol('x'), '\u0000', '÷÷÷', '((((', '1/0/0', '9'.repeat(300), '2^99999', '-'.repeat(300), '1,,2', '½½', 'm/s', '²', '^', '1 2 3 x x x'];
  for (const j of junk) { for (const fn of [X.evaluate, X.num, X.show, X.tokens]) assert.doesNotThrow(() => fn(j)); for (const op of [X.add, X.mul, X.div, X.pow, X.same, X.make]) assert.doesNotThrow(() => op(j, j)); }
  assert.equal(X.evaluate('2^99999'), null); assert.equal(X.evaluate('9'.repeat(300)), null);
  assert.equal(X.tokens('x'.repeat(401)), null); assert.deepEqual(X.tokens('1 + 2'), ['1', '+', '2']); assert.deepEqual(X.tokens('  '), []);
});

test('the edges the gate asked about: size limits, a minus that is not a step, a bracket that must close', () => {
  // exactly 400 characters is read, one more is not
  const long = (n) => `1 +${' '.repeat(n - 4)}1`;
  assert.equal(long(400).length, 400); assert.equal(v(long(400)), '2'); assert.equal(v(long(401)), null);
  // exactly 200 tokens is read, one more is not
  const many = `-1${'+1'.repeat(99)}`, more = `1${'+1'.repeat(100)}`;
  assert.equal(X.tokens(many).length, 200); assert.equal(v(many), '98'); assert.equal(more.length, 201); assert.equal(X.tokens(more), null); assert.equal(v(more), null);
  // a minus in front of a plain number is part of the number; in front of working, or twice, it is an operation
  assert.equal(X.evaluate('-5').ops, 0); assert.equal(X.evaluate('2 × -3').ops, 1); assert.equal(X.evaluate('-(2 + 3)').ops, 2); assert.equal(X.evaluate('--5').ops, 1);
  assert.equal(X.evaluate('-5 + 3').ops, 1); assert.equal(X.evaluate('5').ops, 0); assert.equal(X.evaluate('-(5)').ops, 0);
  // an open bracket has to be closed by a bracket, whatever stands where it should be
  for (const bad of ['(2 + 3 4', '(2 + 3 (', '(2 + 3 4)', '(2 + 3', '(2 + 3 + ', '()', '(', ')']) assert.equal(v(bad), null, bad);
  assert.equal(v('(2 + 3)'), '5'); assert.equal(v('((2 + 3))'), '5');
  // show writes any fraction it is handed as it stands, without a sign for nothing
  assert.equal(X.show({ n: 0n, d: 2n }), '0.0'); assert.equal(X.show({ n: 0n, d: 1n }), '0'); assert.equal(X.show({ n: -1n, d: 2n }), '-0.5');
});
