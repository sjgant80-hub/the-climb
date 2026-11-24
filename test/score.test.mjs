import { test } from 'node:test';
import assert from 'node:assert/strict';
import S from '../src/score.mjs';

const pass = (home, extra) => ({ home, ms: 1000, prompt: 100, reply: 20, cached: false, ...extra });
const rec = (id, tier, arm, homes, extra) => ({ id, tier, arm, passes: homes.map((h) => pass(h)), homeAt: homes.indexOf(true) < 0 ? null : homes.indexOf(true) + 1, ...extra });

test('homeBy: home by a pass for a checked loop; the answer held at that pass for the naive loop', () => {
  const c = rec('a', 'climb', 'climb', [false, false, true]);
  assert.deepEqual([1, 2, 3, 4, 6].map((d) => S.homeBy(c, d)), [false, false, true, true, true]);
  const n = rec('a', 'climb', 'naive', [true, false, false]);
  assert.deepEqual([1, 2, 3, 4, 6].map((d) => S.homeBy(n, d)), [true, false, false, false, false], 'it had it, and lost it; after it stopped, its last answer stands');
  const n2 = rec('a', 'climb', 'naive', [false, true]);
  assert.deepEqual([1, 2, 5].map((d) => S.homeBy(n2, d)), [false, true, true]);
  assert.equal(S.homeBy(null, 3), false); assert.equal(S.homeBy({}, 3), false); assert.equal(S.homeBy({ homeAt: '2' }, 3), false); assert.equal(S.homeBy({ arm: 'naive', passes: [] }, 1), false);
  assert.equal(S.homeBy({ homeAt: 2 }, 2), true); assert.equal(S.homeBy({ homeAt: 2 }, 1), false);
});

test('curve and summary: the share home at each depth, overall and by tier, with what it cost', () => {
  const rs = [rec('e1', 'easy', 'climb', [true]), rec('e2', 'easy', 'climb', [true]), rec('c1', 'climb', 'climb', [false, true]), rec('c2', 'climb', 'climb', [false, false, false, true]), rec('c3', 'climb', 'climb', [false, false]), rec('w1', 'wall', 'climb', [false, false, false, false])];
  assert.deepEqual(S.curve(rs, 4), [2 / 6, 3 / 6, 3 / 6, 4 / 6]); assert.deepEqual(S.curve([], 3), [null, null, null]); assert.deepEqual(S.curve(null, 2), [null, null]);
  const s = S.summary(rs, 4);
  assert.deepEqual([s.arm, s.depth, s.tasks, s.first, s.solved, s.home], ['climb', 4, 6, 2 / 6, 4 / 6, 4]);
  assert.deepEqual(s.tiers.easy, { tasks: 2, first: 1, solved: 1, home: 2, curve: [1, 1, 1, 1] });
  assert.deepEqual(s.tiers.climb, { tasks: 3, first: 0, solved: 2 / 3, home: 2, curve: [0, 1 / 3, 1 / 3, 2 / 3] });
  assert.deepEqual(s.tiers.wall, { tasks: 1, first: 0, solved: 0, home: 0, curve: [0, 0, 0, 0] });
  assert.deepEqual(s.cost, { passes: 14, calls: 14, replyTokens: 280, promptTokens: 1400, seconds: 14, passesPerTask: 14 / 6 });
  const empty = S.summary([], 3);
  assert.deepEqual([empty.arm, empty.tasks, empty.first, empty.solved, empty.home, empty.cost.passesPerTask], [null, 0, null, null, 0, null]);
  assert.deepEqual(S.TIERS, ['easy', 'climb', 'wall']);
});

test('cost: every pass is a model call of the loop; one another loop already asked for is not asked for twice', () => {
  const rs = [{ passes: [pass(false), pass(true, { cached: true })] }, { passes: [pass(false, { ms: 'x', reply: null })] }];
  assert.deepEqual(S.cost(rs), { passes: 3, calls: 2, replyTokens: 40, promptTokens: 300, seconds: 2, passesPerTask: 1.5 });
  assert.deepEqual(S.cost(null), { passes: 0, calls: 0, replyTokens: 0, promptTokens: 0, seconds: 0, passesPerTask: null });
});

test('paired: the same problems under two loops, and the exact test on the ones that differ', () => {
  const a = [rec('1', 'climb', 'retry', [false, false]), rec('2', 'climb', 'retry', [true]), rec('3', 'climb', 'retry', [false]), rec('4', 'wall', 'retry', [false]), rec('5', 'easy', 'retry', [true])];
  const b = [rec('1', 'climb', 'climb', [false, true]), rec('2', 'climb', 'climb', [true]), rec('3', 'climb', 'climb', [false, false, true]), rec('4', 'wall', 'climb', [false]), rec('5', 'easy', 'climb', [false]), rec('9', 'climb', 'climb', [true])];
  assert.deepEqual(S.paired(a, b, 6), { aOnly: 1, bOnly: 2, both: 1, neither: 1, p: 1 });
  assert.deepEqual(S.paired(a, b, 2), { aOnly: 1, bOnly: 1, both: 1, neither: 2, p: 1 }, 'at depth 2 the third problem is not home yet');
  assert.deepEqual(S.paired(a, b, 6, 'climb'), { aOnly: 0, bOnly: 2, both: 1, neither: 0, p: 0.5 });
  assert.deepEqual(S.paired(null, null, 6), { aOnly: 0, bOnly: 0, both: 0, neither: 0, p: 1 });
  const many = (arm, home) => Array.from({ length: 12 }, (_, i) => rec(String(i), 'climb', arm, [home]));
  assert.ok(S.paired(many('retry', false), many('climb', true), 1).p < 0.001);
});

test('squares: does the share left shrink like a squaring, step by step', () => {
  const sq = S.squares([0.2, 0.36, 0.5904]);
  assert.deepEqual(sq.steps.map((s) => [s.from, s.to, s.holds]), [[1, 2, true], [2, 3, true]]); assert.equal(sq.holds, true);
  assert.ok(Math.abs(sq.steps[0].before - 0.8) < 1e-12 && Math.abs(sq.steps[0].after - 0.64) < 1e-12 && Math.abs(sq.steps[0].square - 0.64) < 1e-12);
  const lin = S.squares([0.2, 0.3, 0.4]);
  assert.deepEqual([lin.holds, lin.steps.map((s) => s.holds)], [false, [false, false]]);
  assert.equal(S.squares([0.2, 0.36, 0.4]).holds, false, 'one step that falls short fails the whole');
  // exactly the square holds, and the least bit more than the square does not
  assert.deepEqual(S.squares([0.5, 0.75]).steps.map((s) => [s.before, s.after, s.square, s.holds]), [[0.5, 0.25, 0.25, true]]);
  assert.equal(S.squares([0.5, 0.749999]).holds, false); assert.equal(S.squares([0.5, 0.750001]).holds, true);
  assert.equal(S.squares([0.7, 0.91]).holds, true, 'a share that is the square but for the last bit of a float still holds');
  assert.deepEqual(S.squares([0.5]), { steps: [], holds: false }); assert.deepEqual(S.squares([]), { steps: [], holds: false }); assert.deepEqual(S.squares(null), { steps: [], holds: false });
  assert.deepEqual(S.squares([null, 0.5]).steps, []); assert.equal(S.squares([1, 1]).holds, true, 'nothing left, squared, is nothing left');
});

test('rot: a loop no checker stops can hold a right answer and lose it', () => {
  const rs = [rec('1', 'climb', 'naive', [true, false, false]), rec('2', 'climb', 'naive', [false, true]), rec('3', 'climb', 'naive', [true, true]), rec('4', 'climb', 'naive', [false, false]), rec('5', 'climb', 'naive', [false, true, false])];
  assert.deepEqual(S.rot(rs, 6), { lost: 2, gained: 1 }); assert.deepEqual(S.rot(rs, 2), { lost: 1, gained: 2 }, 'at depth 2 the fifth still holds its right answer');
  assert.deepEqual(S.rot(null, 6), { lost: 0, gained: 0 });
});

test('reuse: what continuing the conversation saved over starting from nothing', () => {
  const r = S.reuse([{ fresh: 4, kept: 1, same: true }, { fresh: 6, kept: 1.5, same: false }, { fresh: 0, kept: 1 }, { fresh: 3, kept: 0 }, { fresh: 'x', kept: 1 }, null]);
  assert.deepEqual(r, { pairs: 2, fresh: 10, kept: 2.5, factor: 4, same: 1 });
  assert.equal(S.reuse([{ fresh: 4, kept: 1, same: true }, { fresh: 4, kept: 1, same: true }, { fresh: 4, kept: 1, same: 'yes' }, { fresh: 4, kept: 1 }, { fresh: 4, kept: 1, same: false }]).same, 2, 'only a pass that came out the same counts as the same');
  assert.deepEqual(S.reuse([]), { pairs: 0, fresh: 0, kept: 0, factor: null, same: 0 }); assert.deepEqual(S.reuse(null), { pairs: 0, fresh: 0, kept: 0, factor: null, same: 0 });
});
