import { test } from 'node:test';
import assert from 'node:assert/strict';
import P from '../src/plan.mjs';
import X from '../src/exact.mjs';

test('places: a whole number as its place-value parts', () => {
  assert.deepEqual(P.places(345n).map(String), ['300', '40', '5']); assert.deepEqual(P.places(4005n).map(String), ['4000', '5']);
  assert.deepEqual(P.places(40n).map(String), ['40']); assert.deepEqual(P.places(7n).map(String), ['7']); assert.deepEqual(P.places(1000n).map(String), ['1000']);
});

test('a product is split by place value: the number with fewer parts first, then the other, then both', () => {
  assert.deepEqual(P.ways('144 × 45'), ['144 × 40 + 144 × 5', '100 × 45 + 40 × 45 + 4 × 45', '100 × 40 + 100 × 5 + 40 × 40 + 40 × 5 + 4 × 40 + 4 × 5']);
  assert.deepEqual(P.ways('45 × 144'), ['40 × 144 + 5 × 144', '45 × 100 + 45 × 40 + 45 × 4', '40 × 100 + 40 × 40 + 40 × 4 + 5 × 100 + 5 × 40 + 5 × 4'], 'the two-part number is split first wherever it stands');
  assert.deepEqual(P.ways('23 × 45').slice(0, 2), ['23 × 40 + 23 × 5', '20 × 45 + 3 × 45'], 'equal parts: the second is split first');
  assert.deepEqual(P.ways('144 × 40'), ['100 × 40 + 40 × 40 + 4 × 40'], 'only one number has parts: one way');
  assert.deepEqual(P.ways('9 × 225'), ['9 × 200 + 9 × 20 + 9 × 5']);
  assert.equal(P.split('144 × 45'), '144 × 45 = 144 × 40 + 144 × 5'); assert.equal(P.split('1,440 x 5'), '1440 × 5 = 1000 × 5 + 400 × 5 + 40 × 5');
  assert.equal(P.split('225 × 37'), '225 × 37 = 225 × 30 + 225 × 7');
});

test('one digit each: the noughts are set aside, and a times-table fact has nothing smaller', () => {
  assert.deepEqual(P.ways('40 × 40'), ['4 × 4 × 100']); assert.deepEqual(P.ways('4 × 40'), ['4 × 4 × 10']);
  assert.deepEqual(P.ways('300 × 7'), ['3 × 7 × 100']); assert.deepEqual(P.ways('100 × 40'), ['1 × 4 × 1000']); assert.deepEqual(P.ways('200 × 30'), ['2 × 3 × 1000']);
  assert.deepEqual(P.ways('7 × 8'), []); assert.deepEqual(P.ways('1 × 9'), []); assert.equal(P.split('7 × 8'), null);
});

test('sums and differences by place, halves, divisions, powers', () => {
  assert.deepEqual(P.ways('5760 + 720'), ['5760 + 700 + 20']); assert.deepEqual(P.ways('63 + 27'), ['63 + 20 + 7']); assert.deepEqual(P.ways('5 + 27'), ['5 + 20 + 7']);
  // one place to add: the two digits in that place are added on their own, so a carry is its own step
  assert.deepEqual(P.ways('6750 + 500'), ['6050 + (7 + 5) × 100']); assert.deepEqual(P.ways('8400 + 200'), ['8000 + (4 + 2) × 100']); assert.deepEqual(P.ways('13630 + 80'), ['13600 + (3 + 8) × 10']);
  assert.deepEqual(P.ways('274 + 8'), ['270 + (4 + 8)'], 'in the units there is nothing to multiply back'); assert.deepEqual(P.ways('400 + 200'), ['(4 + 2) × 100'], 'nothing else in the first number');
  assert.deepEqual(P.ways('8000 + 600'), [], 'no digit in that place: nothing to carry, nothing smaller'); assert.deepEqual(P.ways('60 + 5'), []); assert.deepEqual(P.ways('4 + 8'), [], 'two digits: a fact, not a step to split');
  assert.deepEqual(P.ways('99 + 1'), ['90 + (9 + 1)']); assert.deepEqual(P.ways('1090 + 10'), ['1000 + (9 + 1) × 10']); assert.deepEqual(P.ways('905 + 100'), ['5 + (9 + 1) × 100']); assert.deepEqual(P.ways('40 + 8'), []);
  assert.deepEqual(P.ways('1000 - 437'), ['1000 - 400 - 30 - 7']); assert.deepEqual(P.ways('494 - 228'), ['494 - 200 - 20 - 8'], 'a difference is never laid out place by place');
  assert.deepEqual(P.ways('63 + 5'), ['60 + (3 + 5)']); assert.deepEqual(P.ways('63 - 20'), [], 'one part to take: nothing smaller'); assert.deepEqual(P.ways('7 + 8'), []); assert.deepEqual(P.ways('8400 - 200'), [], 'only a sum has the same-place way');
  assert.deepEqual(P.ways('0.5 × 26'), ['26 ÷ 2']); assert.deepEqual(P.ways('26 × 0.5'), ['26 ÷ 2']); assert.deepEqual(P.ways('0.5 × 0.5'), [], 'half of a half has no whole number to halve');
  assert.deepEqual(P.ways('0.5 × 2.5'), []);
  // a decimal times a whole number: the whole part and the decimal part, each times it
  assert.deepEqual(P.ways('28.5 × 16'), ['28 × 16 + 0.5 × 16']); assert.deepEqual(P.ways('16 × 28.5'), ['28 × 16 + 0.5 × 16']); assert.deepEqual(P.ways('1.5 × 20'), ['1 × 20 + 0.5 × 20']);
  assert.deepEqual(P.ways('12.25 × 8'), ['12 × 8 + 0.25 × 8']); assert.deepEqual(P.ways('0.25 × 16'), [], 'no whole part to take out'); assert.deepEqual(P.ways('2.5 × 1.5'), []);
  assert.deepEqual(P.ways('-1.5 × 20'), []); assert.deepEqual(P.ways('1.5 × -20'), []); assert.deepEqual(P.ways('0.75 × 4'), []); assert.deepEqual(P.ways('½ × 26'), [], 'written as a fraction it is more than one operation');
  assert.deepEqual(P.ways('7406 ÷ 2'), ['7000 ÷ 2 + 400 ÷ 2 + 6 ÷ 2']); assert.deepEqual(P.ways('7 ÷ 2'), []); assert.deepEqual(P.ways('7506 ÷ 4'), [], 'a part that does not divide exactly is not offered');
  assert.deepEqual(P.ways('7000 ÷ 2'), [], 'one part: nothing smaller'); assert.deepEqual(P.ways('7.5 ÷ 5'), []); assert.deepEqual(P.ways('75 ÷ 2.5'), []);
  assert.deepEqual(P.ways('23^2'), ['23 × 23']); assert.deepEqual(P.ways('5³'), ['5 × 5 × 5']); assert.deepEqual(P.ways('3^4'), ['3 × 3 × 3 × 3']);
  assert.deepEqual(P.ways('3^5'), []); assert.deepEqual(P.ways('3^1'), []); assert.deepEqual(P.ways('0.5^2'), []); assert.deepEqual(P.ways('3^0.5'), []); assert.deepEqual(P.ways('3^-2'), []);
  assert.equal(P.split('23^2'), '23^2 = 23 × 23'); assert.equal(P.split('0.5 × 26'), '0.5 × 26 = 26 ÷ 2');
});

test('nothing to split, nothing offered: more than one operation, a bare number, or not arithmetic', () => {
  for (const w of ['12', '-5', 'abc', '', '0.5 × 6 × 3', '12 × 12 × 45', '(12 + 3) × 4', '2.5 × 1.5', '-3 × 20', '2 × -30', '12.5 + 20', '20 + 12.5', '12.5 - 2', '20 - 2.5', '--5', '-(5)', null, undefined, 7, {}]) {
    assert.deepEqual(P.ways(w), [], String(w)); assert.equal(P.split(w), null, String(w));
  }
});

test('every way is a true statement of the step, is working, and never states the result', () => {
  let s = 99;
  const r = (lo, hi) => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return lo + (s >>> 8) % (hi - lo + 1); };
  let made = 0;
  for (let i = 0; i < 900; i++) {
    const a = r(2, 9999), b = r(2, 999), op = ['×', '+', '-', '÷', '^', '×'][i % 6];
    const w = op === '^' ? `${r(2, 99)}^${r(2, 4)}` : i % 12 === 5 ? `0.5 × ${a}` : i % 12 === 11 ? `${r(1, 99)}.${r(1, 99)} × ${b}` : `${a} ${op} ${b}`;
    const whole = X.evaluate(w);
    for (const way of P.ways(w)) {
      made++;
      const e = X.evaluate(way);
      assert.ok(e !== null && e.ops >= 1, `${w}: ${way} is working`);
      assert.ok(X.same(e.value, whole.value), `${w} = ${way}`);
      assert.notEqual(way, X.show(whole.value));
      assert.equal(P.holds(`${whole.shown} = ${way}`), true);
    }
    const line = P.split(w);
    assert.equal(line, P.ways(w).length ? `${whole.shown} = ${P.ways(w)[0]}` : null);
  }
  assert.ok(made > 700);
});

test('holds: a split line is two sides that are the same number', () => {
  assert.equal(P.holds('2 × 3 = 6'), true); assert.equal(P.holds('2 × 3 = 7'), false); assert.equal(P.holds('a = b'), false); assert.equal(P.holds('6'), false);
  assert.equal(P.holds('2 × 3 = 6 = 6'), false, 'one equals sign, two sides'); assert.equal(P.holds('2 × 3 = x'), false); assert.equal(P.holds('x = 6'), false);
  assert.equal(P.holds(null), false); assert.equal(P.holds(undefined), false); assert.equal(P.holds({}), false);
  assert.equal(P.holds('144 × 45 = 144 × 40 + 144 × 5'), true); assert.equal(P.holds('144 × 45 = 144 × 40 + 144 × 6'), false);
});

test('nothing and halves of the edges: nought is not split, and two places are enough to share a division out', () => {
  assert.deepEqual(P.ways('0 × 45'), []); assert.deepEqual(P.ways('45 × 0'), []); assert.deepEqual(P.ways('0 + 45'), []); assert.deepEqual(P.ways('45 + 0'), []); assert.deepEqual(P.ways('0 - 45'), []);
  assert.deepEqual(P.ways('46 ÷ 2'), ['40 ÷ 2 + 6 ÷ 2']); assert.deepEqual(P.ways('40 ÷ 2'), []); assert.deepEqual(P.ways('0 ÷ 2'), []);
  assert.deepEqual(P.ways('1.5 × 20'), ['1 × 20 + 0.5 × 20']); assert.deepEqual(P.ways('1.25 × 8'), ['1 × 8 + 0.25 × 8']);
});
