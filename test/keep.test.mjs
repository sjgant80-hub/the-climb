import { test } from 'node:test';
import assert from 'node:assert/strict';
import MEM from '../src/keep.mjs';

const K = (canon, fact) => ({ canon, fact });
const fill = (facts) => { const M = MEM.create(); for (const [c, f] of facts) MEM.fold(M, K(c, f), 't'); return M; };
const SHEET = [['*(19,19)', '19 × 19 = 361'], ['*(0.5,38)', '0.5 × 38 = 19'], ['*(19,361)', '19 × 361 = 6859'], ['*(19,38)', '38 × 19 = 722'], ['*(24,4)', '24 × 4 = 96'], ['+(722,96)', '722 + 96 = 818'], ['*(7,7)', '7 × 7 = 49'], ['^(23,2)', '23^2 = 529']];

test('spell: working as words, so the map can place it', () => {
  assert.equal(MEM.spell('19 × 19 = 361'), '19 times 19 equals 361'); assert.equal(MEM.spell('7406 ÷ 2'), '7406 over 2'); assert.equal(MEM.spell('722 + 96'), '722 plus 96');
  assert.equal(MEM.spell('100 - 37'), '100 minus 37'); assert.equal(MEM.spell('23^2'), '23 to the 2'); assert.equal(MEM.spell('  a   b '), 'a b'); assert.equal(MEM.spell(null), '');
  assert.equal(MEM.spell('1 × 2 × 3 + 4 + 5 ÷ 6 ÷ 7 = 8 = 9'), '1 times 2 times 3 plus 4 plus 5 over 6 over 7 equals 8 equals 9', 'every sign, every time');
  assert.equal(MEM.spell('2^3^2 - 1 - 1'), '2 to the 3 to the 2 minus 1 minus 1'); assert.equal(MEM.spell('-5 + 3'), '-5 plus 3', 'a leading minus is part of the number');
});

test('fold: a kept fact is written once; anything else is not written', () => {
  const M = MEM.create();
  assert.equal(MEM.fold(M, K('*(19,19)', '19 × 19 = 361'), 'energy:1'), true); assert.equal(MEM.fold(M, K('*(19,19)', '19 × 19 = 361'), 'other'), false, 'the same working twice');
  assert.equal(M.floor.size, 1); assert.equal(M.kernel.size, 1);
  assert.deepEqual(M.floor.get('*(19,19)'), { canon: '*(19,19)', fact: '19 × 19 = 361', from: 'energy:1' });
  for (const bad of [null, undefined, {}, K('', '1 + 1 = 2'), K('+(1,1)', ''), K('+(1,1)', null), K(null, '1 + 1 = 2'), K(7, '1 + 1 = 2')]) assert.equal(MEM.fold(M, bad, 't'), false);
  assert.equal(M.floor.size, 1); assert.equal(M.kernel.size, 1);
  MEM.fold(M, K('*(0.5,38)', '0.5 × 38 = 19'));
  assert.equal(M.floor.get('*(0.5,38)').from, ''); assert.equal(M.kernel.size, 2);
  // a fact the map cannot place (nothing in it to place it by) is not written, and is not called written
  assert.equal(MEM.fold(M, K('c1', '!!!'), 't'), false); assert.equal(M.floor.has('c1'), false); assert.equal(M.floor.size, 2); assert.equal(M.kernel.size, 2);
});

test('near and lookup: the map hands back what is alike, and a step is found only by its own key', () => {
  const M = fill(SHEET);
  const got = MEM.near(M, '38 × 19', { k: 8, probes: 12 });
  assert.equal(got.length, 8); assert.ok(got.some((r) => r.canon === '*(19,38)')); assert.deepEqual(Object.keys(got[0]), ['canon', 'fact', 'from']);
  assert.deepEqual(MEM.near(MEM.create(), '38 19'), []); assert.deepEqual(MEM.near(M, ''), []); assert.deepEqual(MEM.near(M, null), []);
  assert.equal(MEM.near(M, '38 × 19', { k: 2, probes: 12 }).length, 2); assert.equal(MEM.near(M, '38 × 19', { k: 1, probes: 12 }).length, 1);
  assert.equal(MEM.near(M, '38 × 19', { k: 3, probes: 12 })[0].canon, '*(19,38)', 'the most alike comes first');
  assert.equal(MEM.lookup(M, '*(19,361)', '19 × 361', { probes: 12 }), '19 × 361 = 6859'); assert.equal(MEM.lookup(M, '*(19,362)', '19 × 362', { probes: 12 }), null);
  assert.deepEqual(M.asked, [{ wanted: 1, found: 1 }, { wanted: 0, found: 0 }]);
  // a fact that is there but that the map does not hand back is logged as wanted and not found
  assert.equal(MEM.lookup(M, '*(7,7)', '19 × 361', { probes: 12, k: 1 }), null);
  assert.deepEqual(M.asked[2], { wanted: 1, found: 0 });
});

test('stats: what was there to be found against what the map handed back', () => {
  const M = fill(SHEET);
  assert.deepEqual(MEM.stats(M), { facts: 8, chambers: M.kernel.distribution(), asks: 0, wanted: 0, found: 0, recall: null });
  assert.equal(MEM.stats(M).chambers.reduce((a, b) => a + b, 0), 8); assert.equal(MEM.stats(M).chambers.length, 12);
  MEM.lookup(M, '*(19,361)', '19 × 361', { probes: 12 }); MEM.lookup(M, '*(1,1)', '1 × 1', { probes: 12 });
  M.asked.push({ wanted: 1, found: 0 });
  const s = MEM.stats(M);
  assert.deepEqual([s.asks, s.wanted, s.found, s.recall], [3, 2, 1, 0.5]);
  M.asked.push({ wanted: 2, found: 2 });
  assert.deepEqual([MEM.stats(M).wanted, MEM.stats(M).found, MEM.stats(M).recall], [4, 3, 0.75]);
});

test('the map is deterministic, and looking in one chamber and its neighbours can miss what a full scan finds', () => {
  const a = fill(SHEET), b = fill(SHEET);
  assert.deepEqual(a.kernel.distribution(), b.kernel.distribution());
  assert.deepEqual(MEM.near(a, '19 × 361', { probes: 1 }).map((r) => r.canon), MEM.near(b, '19 × 361', { probes: 1 }).map((r) => r.canon));
  const local = MEM.near(a, '19 × 361', { probes: 1 }).length, full = MEM.near(a, '19 × 361', { probes: 12 }).length;
  assert.equal(local, 3, 'one chamber and its five neighbours hold three of the eight'); assert.equal(full, 8); assert.equal(MEM.near(a, '0.5 × 38', { probes: 1 }).length, 6);
  assert.deepEqual(MEM.DEFAULTS, { k: 8, probes: 1 });
  // the defaults are what a call with no options uses
  assert.deepEqual(MEM.near(a, '19 × 361').map((r) => r.canon), MEM.near(a, '19 × 361', { k: 8, probes: 1 }).map((r) => r.canon));
  assert.deepEqual(MEM.near(a, '19 × 361', { probes: 11 }).map((r) => r.canon), MEM.near(a, '19 × 361', { probes: 11, k: 8 }).map((r) => r.canon));
});
