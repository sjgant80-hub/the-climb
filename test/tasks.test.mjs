import { test } from 'node:test';
import assert from 'node:assert/strict';
import T from '../src/tasks.mjs';
import X from '../src/exact.mjs';
import C from '../src/checker.mjs';
import LEFT from '../src/left.mjs';

const val = (text) => X.show(X.evaluate(text).value);

test('the same seed gives the same sheets, and a different seed different ones', () => {
  assert.deepEqual(T.set(7, 3), T.set(7, 3)); assert.notDeepEqual(T.set(7, 3), T.set(8, 3));
  assert.deepEqual(T.sheet(7, 2).tasks, T.set(7, 3).slice(16, 24));
  assert.deepEqual(T.set(7, 0), []); assert.deepEqual(T.set(7, -1), []); assert.deepEqual(T.set(7, 1.5), []); assert.deepEqual(T.set(7, 201), []); assert.equal(T.set(7, 200).length, 1600);
  assert.equal(T.set(7, 'x').length, 0);
});

test('a sheet is eight questions on shared numbers: two easy, four to climb, two walls', () => {
  const s = T.sheet(20261101, 0);
  assert.deepEqual(s.tasks.map((t) => t.tier), ['easy', 'easy', 'climb', 'climb', 'climb', 'climb', 'wall', 'wall']);
  assert.equal(new Set(s.tasks.map((t) => t.id)).size, 8);
  for (const t of s.tasks) { assert.equal(t.sheet, 0); assert.equal(t.tier, T.FAMILIES[t.family].tier); assert.equal(t.id, `${t.family}:20261101-0`); assert.ok(t.statement.length > 20); assert.deepEqual(Object.keys(t), ['id', 'sheet', 'family', 'tier', 'statement', 'ask', 'check']); }
  const q = s.numbers;
  assert.ok(q.m % 2 === 0 && q.m >= 12 && q.m <= 38 && q.a % 2 === 0 && q.a >= 2 && q.a <= 8 && q.v >= 11 && q.v <= 29 && q.t >= 3 && q.t <= 9 && q.p1 < q.p2);
  // the same numbers show up in more than one question
  const withV = s.tasks.filter((t) => new RegExp(`\\b${q.v}\\b`).test(t.statement));
  assert.ok(withV.length >= 2);
});

test('across a set every family comes up equally often, and the families of a sheet go together', () => {
  const all = T.set(20261101, 12), by = {};
  for (const t of all) by[t.family] = (by[t.family] || 0) + 1;
  assert.equal(all.length, 96); assert.equal(Object.keys(by).length, 16);
  for (const [f, n] of Object.entries(by)) assert.equal(n, 6, f);
  assert.equal(new Set(all.map((t) => t.id)).size, 96);
  assert.deepEqual(T.TIERS, ['easy', 'climb', 'wall']);
  assert.deepEqual(Object.values(T.FAMILIES).reduce((a, f) => { a[f.tier] = (a[f.tier] || 0) + 1; return a; }, {}), { easy: 4, climb: 8, wall: 4 });
  assert.deepEqual(T.sheet(1, 0).tasks.map((t) => t.family), ['force', 'distance', 'energy', 'squares', 'tank', 'dot', 'factor', 'root']);
  assert.deepEqual(T.sheet(1, 1).tasks.map((t) => t.family), ['volts', 'weight', 'power', 'series', 'momentum', 'trapezium', 'product', 'grid']);
  assert.deepEqual(T.sheet(1, 2).tasks.map((t) => t.family), T.sheet(1, 0).tasks.map((t) => t.family));
});

test('every finish line is right, worked out again a different way in plain whole numbers', () => {
  for (let i = 0; i < 40; i++) {
    const s = T.sheet(31337, i), q = s.numbers;
    const again = {
      force: q.s1 * q.s2, distance: q.s3 * q.t, volts: q.s2 * q.s4, weight: q.m * 10,
      energy: (q.m / 2) * q.v * q.v, squares: q.v ** 2 + q.d ** 2 + q.m2 ** 2, tank: q.v * q.d * q.m2, dot: q.v * q.d + q.i * q.m2 + q.r * q.s4,
      power: q.i * q.i * q.r, series: Array.from({ length: q.r - q.i + 1 }, (_, k) => q.i + k).reduce((a, b) => a + b, 0), momentum: q.m * q.v + q.m2 * q.d + q.i * q.r, trapezium: ((q.i + q.r) * q.m) / 2,
      product: q.m * q.v * q.d * q.r, grid: q.v * (q.d * q.r - q.i * q.m) - q.m2 * (q.i * q.r - q.d * q.v) + q.s4 * (q.i * q.m - q.d * q.d),
    };
    for (const t of s.tasks) {
      if (t.check.type === 'value') {
        assert.equal(t.check.value, String(again[t.family]), t.id);
        assert.match(t.check.value, /^-?\d+$/, `${t.id}: a whole number`);
        assert.equal(C.home(t, C.answerOf(`ANSWER: ${t.check.value}`)), true); assert.equal(C.home(t, C.answerOf(`ANSWER: ${BigInt(t.check.value) + 1n}`)), false);
      } else if (t.check.type === 'factors') {
        assert.equal(t.ask, null); assert.equal(t.check.n, String(q.p1 * q.p2)); assert.equal(C.home(t, C.answerOf(`ANSWER: ${q.p1} × ${q.p2}`)), true); assert.equal(C.home(t, C.answerOf(`ANSWER: ${q.p1} × ${q.p2 + 2}`)), false);
      } else {
        assert.equal(t.ask, null); assert.equal(t.check.type, 'root'); assert.equal(C.home(t, C.answerOf(`ANSWER: ${q.v}`)), true); assert.equal(C.home(t, C.answerOf(`ANSWER: ${q.v + 1}`)), false);
        assert.equal(t.check.n, val(`${q.v} × ${q.v} × ${q.v} + ${q.s2} × ${q.v}`)); assert.equal(t.check.b, String(q.s2));
      }
    }
  }
});

test('a problem with one right value carries the calculation it asks for, in the numbers of its own statement', () => {
  const steps = { easy: [1, 1], climb: [2, 5], wall: [3, 14] };
  for (let i = 0; i < 12; i++) for (const t of T.sheet(5, i).tasks) {
    if (t.check.type !== 'value') continue;
    const x = LEFT.start(t.ask);
    assert.ok(x !== null, t.id); assert.equal(X.show(x.value), t.check.value, t.id); assert.equal(LEFT.left(x), t.ask, 'held as written');
    assert.ok(LEFT.ops(x) >= steps[t.tier][0] && LEFT.ops(x) <= steps[t.tier][1], `${t.id}: ${LEFT.ops(x)} steps`);
    // every number of the calculation is in the statement (a half, and the 2 and 10 of a formula, are in its words)
    for (const num of t.ask.match(/\d+(?:\.\d+)?/g)) assert.ok(new RegExp(`(^|[^\\d.])${num.replace('.', '\\.')}($|[^\\d])`).test(t.statement), `${t.id}: ${num} is not in "${t.statement}"`);
    // a statement that writes its working out in full writes exactly what is asked
    const m = t.statement.match(/(?:=|Work out) ([-0-9 ×+().]+?)\.(?: |$)/);
    if (['momentum', 'dot', 'product', 'grid'].includes(t.family)) { assert.ok(m, t.statement); assert.equal(m[1], t.ask, t.id); } else assert.equal(m, null, t.statement);
  }
});

test('own: a visitor\'s calculation becomes a task with an exact finish line', () => {
  assert.deepEqual(T.own('(37 x 48 + 912) * 6'), { id: 'own', sheet: -1, family: 'own', tier: 'own', statement: 'Work out (37 × 48 + 912) × 6.', ask: '(37 × 48 + 912) × 6', check: { type: 'value', value: '16128' } });
  assert.equal(T.own('1/3 + 1/6').check.value, '0.5'); assert.equal(LEFT.left(LEFT.start(T.own('1/3 + 1/6').ask)), '1 ÷ 3 + 1 ÷ 6');
  for (const bad of ['42', 'hello', '', '7 ÷ 0', null, 5]) assert.equal(T.own(bad), null, String(bad));
});

test('the numbers of a sheet are these: the seed, the sheet and the ranges all count', () => {
  assert.deepEqual(T.sheet(20261101, 0).numbers, { m: 26, v: 21, m2: 26, a: 6, t: 3, d: 18, i: 15, r: 37, s1: 5, s2: 6, s3: 7, s4: 2, p1: 101, p2: 181 });
  assert.deepEqual(T.sheet(20261101, 1).numbers, { m: 16, v: 13, m2: 26, a: 2, t: 5, d: 12, i: 19, r: 38, s1: 8, s2: 4, s3: 4, s4: 4, p1: 103, p2: 181 });
  assert.deepEqual(T.sheet(7, 3).numbers, { m: 28, v: 22, m2: 27, a: 2, t: 5, d: 16, i: 14, r: 33, s1: 5, s2: 4, s3: 3, s4: 7, p1: 197, p2: 199 });
  // every number stays inside its range, both ends of every range are reached, and the two primes are never one prime
  const seen = {};
  for (let i = 0; i < 400; i++) { const q = T.sheet(99, i).numbers; assert.ok(q.p1 < q.p2, `sheet ${i}`); for (const [k, v] of Object.entries(q)) { seen[k] = seen[k] || [v, v]; seen[k] = [Math.min(seen[k][0], v), Math.max(seen[k][1], v)]; } }
  assert.deepEqual(seen, { m: [12, 38], v: [11, 29], m2: [11, 29], a: [2, 8], t: [3, 9], d: [11, 29], i: [11, 19], r: [21, 48], s1: [2, 9], s2: [2, 9], s3: [2, 9], s4: [2, 9], p1: [101, 197], p2: [103, 199] });
});
