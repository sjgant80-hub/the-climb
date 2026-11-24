import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import CL from '../src/claims.mjs';
import S from '../src/score.mjs';

const DEPTH = 6;
const rec = (id, tier, arm, homeAt, passes = homeAt || DEPTH) => ({ id, tier, arm, homeAt, passes: Array.from({ length: passes }, (_, i) => ({ home: homeAt !== null && i + 1 >= homeAt && (arm !== 'naive' || true), ms: 1000, prompt: 100, reply: 20, cached: false })) });
// a run of 20 easy, 40 climb, 20 wall problems, with each loop's home pass given per tier as a list
const loop = (arm, easy, climb, wall) => [...easy.map((h, i) => rec(`e${i}`, 'easy', arm, h)), ...climb.map((h, i) => rec(`c${i}`, 'climb', arm, h)), ...wall.map((h, i) => rec(`w${i}`, 'wall', arm, h))];
const n = (count, value) => new Array(count).fill(value);
const facts = (arms) => { const F = { depth: DEPTH, records: {} }; for (const [arm, recs] of Object.entries(arms)) { F[arm] = S.summary(recs, DEPTH); F.records[arm] = recs; } return F; };
const GOOD = () => facts({
  retry: loop('retry', [...n(18, 1), ...n(2, null)], [...n(8, 1), ...n(4, 3), ...n(28, null)], n(20, null)),
  naive: loop('naive', [...n(18, 1), ...n(2, null)], [...n(8, 1), ...n(32, null)], n(20, null)),
  'climb-alone': loop('climb-alone', [...n(18, 1), ...n(2, 2)], [...n(8, 1), ...n(20, 3), ...n(12, null)], n(20, null)),
  climb: loop('climb', [...n(18, 1), ...n(2, 2)], [...n(8, 1), ...n(20, 2), ...n(12, null)], [...n(2, 4), ...n(18, null)]),
});
const by = (v) => Object.fromEntries(v.map((x) => [x.id, x]));

test('every bar is the one CLAIMS.md registered, and every claim has a name', () => {
  const md = readFileSync(new URL('../CLAIMS.md', import.meta.url), 'utf8');
  for (const [id, bar] of Object.entries(CL.BARS)) assert.ok(md.includes(bar), `${id}: ${bar}`);
  assert.deepEqual(Object.keys(CL.BARS), ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8']); assert.deepEqual(Object.keys(CL.NAMES), Object.keys(CL.BARS));
});

test('without the evidence every claim is pending, never passed or failed', () => {
  for (const F of [null, undefined, {}, { depth: 6 }]) { const v = CL.evaluate(F); assert.deepEqual(v.map((x) => x.id), ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8']); assert.ok(v.every((x) => x.pass === null && x.result.startsWith('pending: '))); }
  const some = by(CL.evaluate(facts({ retry: GOOD().records.retry })));
  assert.equal(some.C5.pass, true); for (const id of ['C1', 'C2', 'C3', 'C4', 'C6', 'C7', 'C8']) assert.equal(some[id].pass, null, id);
  const noClimb = by(CL.evaluate(facts({ retry: GOOD().records.retry, naive: GOOD().records.naive })));
  assert.equal(noClimb.C3.pass, true); assert.equal(noClimb.C1.pass, null); assert.equal(noClimb.C4.pass, null);
  const noAlone = by(CL.evaluate(facts({ retry: GOOD().records.retry, climb: GOOD().records.climb })));
  assert.equal(noAlone.C4.pass, null); assert.equal(noAlone.C1.pass, true); assert.equal(noAlone.C3.pass, null);
});

test('the verdicts on a run where the climb works', () => {
  const v = by(CL.evaluate(GOOD()));
  assert.deepEqual(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.pass])), { C1: true, C2: true, C3: true, C4: true, C5: true, C6: true, C7: true, C8: false });
  assert.match(v.C1.result, /^one try 32\.5%, the climb 62\.5%: 30\.0 points; 24 problems only the climb got home, 0 only the one try, p = /);
  assert.match(v.C2.result, /^retry 37\.5%, the climb 62\.5%; 20 problems only the climb got home, 0 only the retry loop, p = /);
  assert.equal(v.C3.result, 'one try 32.5%, naive at its last pass 32.5%: 0.0 points');
  assert.equal(v.C4.result, 'home: 50 with the memory, 48 without; passes of the model: 258 with, 282 without');
  assert.equal(v.C5.result, '90.0% of the 20 easy problems right at one try');
  assert.equal(v.C6.result, '20.0% of the 40 climb-tier problems right at one try, 70.0% after the climb: 50.0 points');
  assert.equal(v.C7.result, '2 of the 20 wall problems home after the climb (10.0%)');
  assert.match(v.C8.result, /^share not home after each pass: 80\.0%, 30\.0%, 30\.0%, 30\.0%, 30\.0%, 30\.0%; it held at 1 of 5 steps$/);
});

test('each bar, at and just past its edge', () => {
  const G = GOOD(), put = (arm, recs) => { const F = GOOD(); F[arm] = S.summary(recs, DEPTH); F.records[arm] = recs; return by(CL.evaluate(F)); };
  // C1: 20 points and the test
  assert.equal(put('climb', loop('climb', [...n(18, 1), ...n(2, null)], [...n(8, 1), ...n(16, 2), ...n(16, null)], n(20, null))).C1.pass, true, 'exactly 20 points');
  assert.equal(put('climb', loop('climb', [...n(18, 1), ...n(2, null)], [...n(8, 1), ...n(15, 2), ...n(17, null)], n(20, null))).C1.pass, false, 'under 20 points');
  assert.equal(put('climb', G.records.retry.map((r) => ({ ...r, arm: 'climb' }))).C1.pass, false, 'no lift at all');
  // C2: more than retry, by the test
  assert.equal(put('climb', loop('climb', [...n(18, 1), ...n(2, null)], [...n(8, 1), ...n(4, 3), ...n(28, null)], n(20, null))).C2.pass, false, 'the same as retry');
  assert.equal(put('climb', loop('climb', [...n(18, 1), ...n(2, null)], [...n(8, 1), ...n(4, 3), ...n(5, 2), ...n(23, null)], n(20, null))).C2.pass, false, 'five more is not enough for the test');
  assert.equal(put('climb', loop('climb', [...n(18, 1), ...n(2, null)], [...n(8, 1), ...n(4, 3), ...n(6, 2), ...n(22, null)], n(20, null))).C2.pass, true, 'six more, none lost');
  assert.equal(put('retry', loop('retry', n(20, 1), n(40, 1), n(20, 1))).C2.pass, false, 'retry better is not a pass');
  // C3: naive at most 5 points over one try
  assert.equal(put('naive', loop('naive', [...n(18, 1), ...n(2, null)], [...n(12, 1), ...n(28, null)], n(20, null))).C3.pass, true, 'exactly 5 points over');
  assert.equal(put('naive', loop('naive', [...n(18, 1), ...n(2, null)], [...n(13, 1), ...n(27, null)], n(20, null))).C3.pass, false);
  assert.equal(put('naive', loop('naive', n(20, null), n(40, null), n(20, null))).C3.pass, true, 'worse than one try is still "does not climb"');
  // C4: at least as many home, in fewer passes
  assert.equal(put('climb-alone', G.records.climb.map((r) => ({ ...r, arm: 'climb-alone' }))).C4.pass, false, 'the same number of passes is not fewer');
  // a pass that another loop had already asked for still counts as a pass of this loop
  assert.equal(put('climb', G.records.climb.map((r) => ({ ...r, passes: r.passes.map((p) => ({ ...p, cached: true })) }))).C4.pass, true); assert.equal(put('climb-alone', G.records.climb.map((r) => ({ ...r, arm: 'climb-alone', passes: r.passes.map((p) => ({ ...p, cached: true })) }))).C4.pass, false);
  assert.equal(put('climb-alone', loop('climb-alone', n(20, 1), n(40, 1), n(20, 1))).C4.pass, false, 'fewer home with the memory');
  assert.equal(put('climb-alone', loop('climb-alone', [...n(18, 1), ...n(2, 2)], [...n(8, 1), ...n(20, 3), ...n(12, null)], [...n(2, 5), ...n(18, null)])).C4.pass, true, 'as many home, in fewer passes');
  // C5: 80% of easy at one try
  assert.equal(put('retry', loop('retry', [...n(16, 1), ...n(4, null)], n(40, null), n(20, null))).C5.pass, true); assert.equal(put('retry', loop('retry', [...n(15, 1), ...n(5, null)], n(40, null), n(20, null))).C5.pass, false);
  assert.equal(put('retry', loop('retry', [...n(16, 1), ...n(4, 2)], n(40, null), n(20, null))).C5.pass, true, 'home at a later pass does not count as right at one try');
  // C6: at most 50% cold on the climb tier, and 40 points more after the climb
  assert.equal(put('retry', loop('retry', n(20, 1), [...n(20, 1), ...n(20, null)], n(20, null))).C6.pass, false, '50% cold, 70% after: only 20 points');
  assert.equal(put('retry', loop('retry', n(20, 1), [...n(12, 1), ...n(28, null)], n(20, null))).C6.pass, true, '30% cold, 70% after: 40 points');
  assert.equal(put('retry', loop('retry', n(20, 1), [...n(13, 1), ...n(27, null)], n(20, null))).C6.pass, false, '32.5% cold, 70% after: 37.5 points');
  assert.equal(put('retry', loop('retry', n(20, 1), [...n(21, 1), ...n(19, null)], n(20, null))).C6.pass, false, 'over 50% cold');
  // C7: at most 20% of the wall home
  assert.equal(put('climb', loop('climb', n(20, 1), [...n(8, 1), ...n(32, 2)], [...n(4, 4), ...n(16, null)])).C7.pass, true); assert.equal(put('climb', loop('climb', n(20, 1), [...n(8, 1), ...n(32, 2)], [...n(5, 4), ...n(15, null)])).C7.pass, false);
  // C8: squaring at every step
  assert.equal(put('climb', loop('climb', n(20, 1), [...n(8, 1), ...n(14, 2), ...n(10, 3), ...n(7, 4), ...n(1, 5)], n(20, null))).C8.pass, true, '80%, 45%, 20%, 2.5%, 0%, 0% left');
  assert.equal(put('climb', loop('climb', n(20, 1), [...n(8, 1), ...n(14, 2), ...n(10, 3), ...n(6, 4), ...n(2, 5)], n(20, null))).C8.pass, false, '5% left is more than the square of 20%');
  assert.equal(put('climb', loop('climb', n(20, 1), [...n(8, 1), ...n(14, 2), ...n(9, 3), ...n(9, null)], n(20, null))).C8.pass, false);
});

test('nothing throws on a broken record of the run', () => {
  const junk = [null, 5, 'x', {}, { passes: 7 }, { passes: [null, 3, { home: 'yes' }], tier: 'climb', homeAt: 'two' }];
  for (const F of [{ depth: 6, retry: {}, climb: {} }, { depth: 'x', records: null }, { retry: null, naive: 5 }, 'x', 7, { depth: 6, records: { retry: junk, naive: junk, climb: junk, 'climb-alone': junk } }, { depth: 0, records: GOOD().records }, { depth: 6, records: { retry: 'abc', climb: 9 } }]) {
    const v = CL.evaluate(F);
    assert.equal(v.length, 8); assert.ok(v.every((x) => [true, false, null].includes(x.pass) && typeof x.result === 'string'));
  }
  assert.ok(CL.evaluate({ depth: 0, records: GOOD().records }).every((x) => x.pass === null), 'no depth, no verdict');
});

test('the edges the gate asked about: one pass, no records, a tier that is not there, a result exactly on a bar', () => {
  const G = GOOD();
  // a depth of one is a depth: the claims are decided, and the squaring claim says it has no step to test
  const d1 = by(CL.evaluate({ depth: 1, records: G.records }));
  assert.deepEqual([d1.C5.pass, d1.C1.pass, d1.C8.pass, d1.C8.result], [true, false, false, 'only one pass, so there is no step to test']);
  for (const d of [0, -1, 1.5, '8', null]) assert.ok(CL.evaluate({ depth: d, records: G.records }).every((x) => x.pass === null), `depth ${d}`);
  // a loop with no records is missing, not a loop that got nothing right
  assert.ok(CL.evaluate({ depth: DEPTH, records: { retry: [], naive: [], 'climb-alone': [], climb: [] } }).every((x) => x.pass === null && x.result.startsWith('pending: ')));
  // only easy problems: the claims about the other tiers wait; with no wall only the wall claim waits
  const easyOnly = (arm) => G.records[arm].filter((r) => r.tier === 'easy'), noWall = (arm) => G.records[arm].filter((r) => r.tier !== 'wall');
  const e = by(CL.evaluate({ depth: DEPTH, records: Object.fromEntries(Object.keys(G.records).map((a) => [a, easyOnly(a)])) }));
  assert.deepEqual([e.C5.pass, e.C6.pass, e.C7.pass, e.C8.pass, e.C4.pass === null, e.C1.pass === null], [true, null, null, null, false, false]);
  const w = by(CL.evaluate({ depth: DEPTH, records: Object.fromEntries(Object.keys(G.records).map((a) => [a, noWall(a)])) }));
  assert.deepEqual([w.C6.pass, w.C7.pass, w.C7.result, w.C8.pass], [true, null, 'pending: needs the climb on the sealed wall problems', false]);
  // one try has no climb-tier problems though the climb has: the tier's claim waits, the squaring claim does not
  const lop = by(CL.evaluate({ depth: DEPTH, records: { ...G.records, retry: easyOnly('retry') } }));
  assert.deepEqual([lop.C6.pass, lop.C6.result, lop.C8.pass], [null, 'pending: needs one try and the climb on the sealed climb-tier problems', false]);
  // exactly half of the climb tier right at one try is "at most 50%"
  const half = by(CL.evaluate(facts({ ...G.records, retry: loop('retry', n(20, 1), [...n(20, 1), ...n(20, null)], n(20, null)), climb: loop('climb', n(20, 1), [...n(36, 1), ...n(4, null)], n(20, null)) })));
  assert.deepEqual([half.C6.pass, half.C6.result], [true, '50.0% of the 40 climb-tier problems right at one try, 90.0% after the climb: 40.0 points']);
  const over = by(CL.evaluate(facts({ ...G.records, retry: loop('retry', n(20, 1), [...n(21, 1), ...n(19, null)], n(20, null)), climb: loop('climb', n(20, 1), n(40, 1), n(20, null)) })));
  assert.equal(over.C6.pass, false, '52.5% at one try is more than half, however far the climb goes');
  // loops of different sizes are compared as shares
  const short = by(CL.evaluate({ depth: DEPTH, records: { ...G.records, naive: G.records.naive.slice(0, 40) } }));
  assert.equal(short.C3.result, 'one try 32.5%, naive at its last pass 65.0%: 32.5 points'); assert.equal(short.C3.pass, false);
});
