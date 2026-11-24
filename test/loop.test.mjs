import { test } from 'node:test';
import assert from 'node:assert/strict';
import L from '../src/loop.mjs';
import LEFT from '../src/left.mjs';
import MEM from '../src/keep.mjs';
import X from '../src/exact.mjs';

const task = (id, statement, ask, tier = 'climb') => ({ id, sheet: 0, family: id.split(':')[0], tier, statement, ask, check: { type: 'value', value: X.show(X.evaluate(ask).value) } });
const POWER = task('power:1', 'A current of 15 A flows through a 37 Ω resistor. Power = current × current × resistance. How many watts?', '15 × 15 × 37');
const FACTOR = { id: 'factor:1', sheet: 0, family: 'factor', tier: 'wall', statement: 'The number 16637 is two primes multiplied together. Find them.', ask: null, check: { type: 'factors', n: '16637' } };
// a scripted model: each reply in turn, whatever it is asked; every conversation it saw is kept. A reply is text, or
// { text, cut } for one that ran into the length limit.
const script = (replies) => { const seen = []; let i = 0; return { seen, ask: async (messages, maxTokens) => { seen.push({ messages: messages.map((m) => ({ ...m })), maxTokens }); const r = replies[i++] ?? ''; return { text: typeof r === 'string' ? r : r.text, cut: typeof r !== 'string' && r.cut, ms: 10, ttft: 0.5, prompt: 100, reply: 20 }; } }; };
const last = (seen, k = 1) => seen[seen.length - k].messages[seen[seen.length - k].messages.length - 1].content;
const END = 'One step per line, then ANSWER: number', NONE = 'No step could be checked. Write each step as: working = number';
const SLIP = '15 × 15 = 225\n225 × 37 = 8250\nANSWER: 8250';

test('opening: the system line, the worked examples as earlier turns, then the problem', () => {
  const m = L.opening('Work out 2 + 2.', []);
  assert.equal(m.length, 2 + 2 * L.SHOTS.length); assert.deepEqual(m[0], { role: 'system', content: L.SYSTEM }); assert.deepEqual(m[m.length - 1], { role: 'user', content: 'Work out 2 + 2.' });
  assert.deepEqual(m.slice(1, -1).map((x) => x.role), L.SHOTS.flatMap(() => ['user', 'assistant'])); assert.deepEqual(m.slice(1, -1).map((x) => x.content), L.SHOTS.flat());
  assert.equal(L.opening('Q', ['19 × 19 = 361', '2 + 2 = 4']).pop().content, 'Q\nAlready checked, you can use these: 19 × 19 = 361; 2 + 2 = 4');
  assert.equal(L.opening('Q', ['19 × 19 = 361'], LEFT.start('0.5 × 38 × 361')).pop().content, 'Q\nAlready checked, you can use these: 19 × 19 = 361\nLeft to do: 0.5 × 38 × 361');
  assert.equal(L.opening('Q', ['5 × 6 = 30'], LEFT.start('30')).pop().content, 'Q\nAlready checked, you can use these: 5 × 6 = 30\nEvery step is done. Give the result of the last step as the answer.');
  assert.equal(L.opening('Q', ['5 × 6 = 30'], null).pop().content, 'Q\nAlready checked, you can use these: 5 × 6 = 30');
  assert.equal(L.opening('Q', [], LEFT.start('5 × 6')).pop().content, 'Q', 'nothing served: the problem as it is set'); assert.equal(L.opening('Q', null).pop().content, 'Q'); assert.equal(L.opening('Q').pop().content, 'Q');
  // every worked example is itself right: each step true, each answer the value of its own working
  for (const [, a] of L.SHOTS.filter((_, i) => i !== 2)) for (const line of a.split('\n').filter((l) => l.includes('='))) { const [l, r] = line.split(' = '); assert.equal(X.show(X.evaluate(l).value), r, line); }
  assert.match(L.SHOTS[2][1], /144 × 45 = 6380/, 'the third example holds the wrong step the fourth one puts right');
  assert.equal(L.SHOTS[3][0], `Right: 12 × 12 = 144\nWrong: 144 × 45 = 6380\nLeft to do: 144 × 40 + 144 × 5\n${END}`, 'the ruling in the example is the one the code gives that reply');
  assert.equal(L.SHOTS.length, 4); assert.equal(L.SHOTS[3][1].split('\n').pop(), 'ANSWER: 6480');
});

test('judge: the ruling, the lines that crossed something off, and what is left', () => {
  const j = L.judge(SLIP, POWER, LEFT.start(POWER.ask));
  assert.deepEqual([j.kept.map((k) => k.text), j.dropped.map((d) => d.text), j.used, j.splits, j.answer, j.home, LEFT.left(j.left)], [['15 × 15 = 225'], ['225 × 37 = 8250'], ['15 × 15 = 225'], [], '8250', false, '225 × 30 + 225 × 7']);
  // working on both sides, a chain of equals signs, the value written first
  const t = L.judge('21 × 3 = 63\n0.5 × 6 × 3 × 3 = 0.5 × 54 = 27\n90 = 63 + 27\nANSWER: 90', task('travel:1', 'Q', '21 × 3 + 0.5 × 6 × 3 × 3'), LEFT.start('21 × 3 + 0.5 × 6 × 3 × 3'));
  assert.deepEqual([t.used, LEFT.left(t.left), t.home], [['21 × 3 = 63', '0.5 × 6 × 3 × 3 = 0.5 × 54', '0.5 × 54 = 27', '90 = 63 + 27'], '90', true]);
  // a true line that is no part of the calculation is kept as a fact and crosses nothing off
  const off = L.judge('19 + 20 = 39\n39 × 20 = 780\nANSWER: 780', task('series:1', 'Q', '(19 + 38) × 20 ÷ 2'), LEFT.start('(19 + 38) × 20 ÷ 2'));
  assert.deepEqual([off.kept.length, off.used, LEFT.left(off.left)], [2, [], '(19 + 38) × 20 ÷ 2']);
  // a wrong line about something that is no part of it changes nothing; the same line twice counts once
  const twice = L.judge('15 × 15 = 225\n15 × 15 = 225\n16 × 16 = 250\nANSWER: 1', POWER, LEFT.start(POWER.ask));
  assert.deepEqual([twice.used, LEFT.left(twice.left)], [['15 × 15 = 225'], '225 × 37']);
  // a problem that carries no calculation: every true line counts as right, and wrong steps get a smaller-step line
  const f = L.judge('127 × 131 = 16537\n7 × 8 = 54\n2 + 2 = 4\n101 × 103 = 1\n45 × 144 = 2\nANSWER: 127 × 133', FACTOR, null);
  assert.deepEqual([f.used, f.left, f.home], [['2 + 2 = 4'], null, false]);
  assert.deepEqual(f.splits, ['127 × 131 = 127 × 100 + 127 × 30 + 127 × 1', '101 × 103 = 101 × 100 + 101 × 3'], 'the first three wrong steps, where there is something smaller');
  assert.deepEqual(L.judge('ANSWER: 127 × 131', FACTOR).home, true); assert.equal(L.judge('ANSWER: 127 × 131', FACTOR).left, null);
  assert.deepEqual(L.judge('1 × 2 = 3\n3 × 4 = 5\n5 × 6 = 7\n45 × 144 = 2\nANSWER: 1', FACTOR, null).splits, [], 'only the first three wrong steps are looked at');
});

test('ruling: right steps, wrong steps, what is left, and never a right value for a wrong step', () => {
  const say = (reply, t) => { const j = L.judge(reply, t, LEFT.start(t.ask)); return L.ruling(j, [], j.left); };
  assert.equal(say(SLIP, POWER), `Right: 15 × 15 = 225\nWrong: 225 × 37 = 8250\nLeft to do: 225 × 30 + 225 × 7\n${END}`);
  assert.equal(say('ANSWER: 7', POWER), `${NONE}\nLeft to do: 15 × 15 × 37\n${END}`); assert.equal(say('', POWER), `${NONE}\nLeft to do: 15 × 15 × 37\n${END}`);
  assert.equal(say('19 + 20 = 39\nANSWER: 39', POWER), `Left to do: 15 × 15 × 37\n${END}`, 'a true line that is no part of it: checked, so no reminder, and not called right');
  assert.equal(say('16 × 16 = 250\nANSWER: 39', POWER), `Wrong: 16 × 16 = 250\nLeft to do: 15 × 15 × 37\n${END}`);
  assert.equal(say('15 × 15\n225\nANSWER: 225', POWER), `Right: 15 × 15 = 225\nLeft to do: 225 × 37\n${END}`, 'working rewritten on the next line is read as a step');
  assert.equal(say('15 × 15 = 225\n225 × 37 = 8325\nANSWER: 8300', POWER), `Right: 15 × 15 = 225; 225 × 37 = 8325\nEvery step is done. Give the result of the last step as the answer.\n${END}`);
  assert.equal(say('7 × 8 = 54\nANSWER: 54', task('t:1', 'Q', '7 × 8 + 1')), `Wrong: 7 × 8 = 54\nLeft to do: 7 × 8 + 1\n${END}`, 'nothing smaller to offer');
  const j = L.judge(SLIP, POWER, LEFT.start(POWER.ask));
  assert.equal(L.ruling(j, ['225 × 30 = 6750'], LEFT.start('6750 + 225 × 7')), `Right: 15 × 15 = 225\nWrong: 225 × 37 = 8250\nAlready checked, you can use these: 225 × 30 = 6750\nLeft to do: 6750 + 225 × 7\n${END}`);
  // a problem that carries no calculation
  const none = (reply) => { const f = L.judge(reply, FACTOR, null); return L.ruling(f, [], null); };
  assert.equal(none('2 + 2 = 4\nANSWER: 5'), `Right: 2 + 2 = 4\nThe answer is not right yet.\n${END}`); assert.equal(none('2 + 2 = 4'), `Right: 2 + 2 = 4\nThere was no ANSWER line.\n${END}`);
  assert.equal(none(''), `${NONE}\nThere was no ANSWER line.\n${END}`); assert.equal(none('ANSWER: 3'), `${NONE}\nThe answer is not right yet.\n${END}`);
  assert.equal(none('127 × 131 = 16537\n7 × 8 = 54\nANSWER: 3'), `Wrong: 127 × 131 = 16537; 7 × 8 = 54\nSmaller steps: 127 × 131 = 127 × 100 + 127 × 30 + 127 × 1\n${END}`);
  for (const out of [say(SLIP, POWER), L.SHOTS[3][0]]) assert.doesNotMatch(out, /8325|6480/, 'no right value for a wrong step');
});

test('climb: a wrong step is dropped and split, and the problem gets home on a later pass from what was kept', async () => {
  const m = script([SLIP, '225 × 30 = 6750\n225 × 7 = 1575\n6750 + 1575 = 8325\nANSWER: 8325']);
  const r = await L.climb(POWER, L.caller(m.ask), { depth: 6 });
  assert.deepEqual([r.id, r.arm, r.tier, r.family, r.sheet, r.homeAt, r.stalled, r.passes.length], ['power:1', 'climb-alone', 'climb', 'power', 0, 2, false, 2]);
  assert.deepEqual(r.passes[0], { said: SLIP, ms: 10, ttft: 0.5, prompt: 100, reply: 20, cached: false, cut: false, kept: ['15 × 15 = 225'], dropped: ['225 × 37 = 8250'], answer: '8250', home: false, used: ['15 × 15 = 225'], served: [], left: '225 × 30 + 225 × 7' });
  assert.deepEqual([r.passes[1].kept.length, r.passes[1].used.length, r.passes[1].dropped.length, r.passes[1].home, r.passes[1].left], [3, 3, 0, true, '8325']);
  assert.equal(m.seen.length, 2); assert.equal(m.seen[0].maxTokens, 128);
  assert.equal(last(m.seen), `Right: 15 × 15 = 225\nWrong: 225 × 37 = 8250\nLeft to do: 225 × 30 + 225 × 7\n${END}`);
  // the second conversation is the first one with two turns added: nothing before them changed
  assert.deepEqual(m.seen[1].messages.slice(0, m.seen[0].messages.length), m.seen[0].messages);
  assert.deepEqual(m.seen[1].messages[m.seen[0].messages.length], { role: 'assistant', content: SLIP });
  assert.equal(m.seen[1].messages.length, m.seen[0].messages.length + 2);
  // what is left carries over from pass to pass: each pass starts from a smaller problem
  const slow = script(['15 × 15 = 225\nANSWER: 225', '225 × 30 = 6750\nANSWER: 6750', '225 × 7 = 1575\nANSWER: 1', '6750 + 1575 = 8325\nANSWER: 8325']);
  const s = await L.climb(POWER, L.caller(slow.ask), {});
  assert.deepEqual(s.passes.map((p) => p.left), ['225 × 37', '6750 + 225 × 7', '6750 + 1575', '8325']); assert.equal(s.homeAt, 4);
  // a problem with no calculation to hold still climbs on its rulings
  const f = await L.climb(FACTOR, L.caller(script(['127 × 131 = 16537\nANSWER: 127 × 133', 'ANSWER: 127 × 131']).ask), {});
  assert.deepEqual([f.homeAt, f.passes[0].left, f.passes[0].used, f.passes[1].home], [2, null, [], true]);
});

test('climb: the same reply to the same ruling is a stall; depth is a limit; a reply cut off loses its last line', async () => {
  const stuck = script([SLIP, SLIP, SLIP, SLIP]);
  const r = await L.climb(POWER, L.caller(stuck.ask), { depth: 6 });
  assert.deepEqual([r.homeAt, r.stalled, r.passes.length], [null, true, 3], 'the second ruling differs from the first (the step is now split), the third is the second again: stop');
  assert.equal(last(stuck.seen), `Wrong: 225 × 37 = 8250\nLeft to do: 225 × 30 + 225 × 7\n${END}`);
  const never = script(['1 + 1 = 3\nANSWER: 3', '1 + 2 = 4\nANSWER: 4', '1 + 3 = 5\nANSWER: 5', '1 + 4 = 6\nANSWER: 6']);
  const cut = await L.climb(POWER, L.caller(never.ask), { depth: 3, maxTokens: 50 });
  assert.deepEqual([cut.homeAt, cut.stalled, cut.passes.length, never.seen[0].maxTokens, never.seen.length], [null, false, 3, 50, 3]);
  for (const bad of [0, -1, 13, 1.5, 'x', null]) assert.equal((await L.climb(POWER, L.caller(script(['1 + 1 = 3\nANSWER: 3', 'ANSWER: 4', 'ANSWER: 5', 'ANSWER: 6', 'ANSWER: 7', 'ANSWER: 8', 'ANSWER: 9', 'ANSWER: 10', 'ANSWER: 11', 'ANSWER: 12']).ask), { depth: bad })).passes.length, 8, `depth ${bad} falls back to the setting`);
  assert.equal((await L.climb(POWER, L.caller(script(['ANSWER: 1', 'ANSWER: 2']).ask), { depth: 12 })).passes.length, 4, 'two different answers, then an empty reply twice running to the same ruling: the stall is seen on the fourth pass');
  assert.equal((await L.climb(POWER, L.caller(script(['ANSWER: 1', 'ANSWER: 2', 'ANSWER: 3']).ask), { depth: 1 })).passes.length, 1);
  assert.equal((await L.climb(POWER, L.caller(script(['ANSWER: 8325']).ask), { maxTokens: 0 })).homeAt, 1);
  assert.equal((await L.climb(POWER, L.caller(script(['ANSWER: 8325']).ask), { maxTokens: 1.5 })).passes.length, 1);
  // cut off in the middle of a number: the half line is not ruled on
  const half = await L.climb(POWER, L.caller(script([{ text: '15 × 15 = 225\n225 × 37 = 83', cut: true }, 'ANSWER: 8325']).ask), {});
  assert.deepEqual([half.passes[0].cut, half.passes[0].said, half.passes[0].kept, half.passes[0].dropped, half.passes[0].left, half.passes[1].cut], [true, '15 × 15 = 225\n225 × 37 = 83', ['15 × 15 = 225'], [], '225 × 37', false]);
  const full = await L.climb(POWER, L.caller(script(['15 × 15 = 225\n225 × 37 = 83', 'ANSWER: 8325']).ask), {});
  assert.deepEqual([full.passes[0].dropped, full.passes[0].left], [['225 × 37 = 83'], '225 × 30 + 225 × 7'], 'the same reply, finished, is ruled on in full');
  assert.equal((await L.climb(POWER, L.caller(script([{ text: 'ANSWER: 8325', cut: true }, 'ANSWER: 8325']).ask), {})).homeAt, 2, 'an answer on the cut line is not an answer');
});

test('climb with a memory: true steps are written in, and a step a later problem has to do is crossed off before the model is asked', async () => {
  const M = MEM.create(), mem = { probes: 12 };
  const a = await L.climb(POWER, L.caller(script(['15 × 15 = 225\n225 × 30 = 6750\n225 × 7 = 1575\n6750 + 1575 = 8325\nANSWER: 8325']).ask), { memory: M, mem });
  assert.deepEqual([a.arm, a.homeAt, a.passes[0].served], ['climb', 1, []]); assert.equal(M.floor.size, 4);
  assert.deepEqual(M.asked, [{ wanted: 0, found: 0 }, { wanted: 0, found: 0 }], 'asked for the two steps the problem could start with; nothing was there yet');
  // a second problem on the same numbers: the memory crosses off the step it holds, then the split steps it holds
  const SAME = task('power:2', 'A lamp takes 15 A through 37 Ω. Power = 15 × 15 × 37. How many watts?', '15 × 15 × 37');
  const second = script(['225 × 37 = 8000\nANSWER: 8000', 'ANSWER: 8325']);
  const b = await L.climb(SAME, L.caller(second.ask), { memory: M, mem });
  assert.deepEqual(b.passes[0].served, ['15 × 15 = 225']);
  assert.equal(second.seen[0].messages.pop().content, 'A lamp takes 15 A through 37 Ω. Power = 15 × 15 × 37. How many watts?\nAlready checked, you can use these: 15 × 15 = 225\nLeft to do: 225 × 37');
  assert.equal(last(second.seen), `Wrong: 225 × 37 = 8000\nAlready checked, you can use these: 225 × 30 = 6750; 225 × 7 = 1575; 6750 + 1575 = 8325\nEvery step is done. Give the result of the last step as the answer.\n${END}`);
  assert.deepEqual([b.homeAt, b.passes[0].left, b.passes[1].served], [2, '8325', ['225 × 30 = 6750', '225 × 7 = 1575', '6750 + 1575 = 8325']]);
  assert.deepEqual(MEM.stats(M).asks, 7); assert.deepEqual([MEM.stats(M).wanted, MEM.stats(M).found, MEM.stats(M).recall], [4, 4, 1]);
  // each step is asked for once in a problem, however many passes it stays undone
  const before = M.asked.length;
  const idle = await L.climb(task('idle:1', 'Q', '16 × 16 × 2'), L.caller(script(['ANSWER: 1', 'ANSWER: 2', 'ANSWER: 3']).ask), { memory: M, mem, depth: 3 });
  assert.equal(idle.passes.length, 3); assert.equal(M.asked.length - before, 2);
  // a problem that gets home is not asked about again
  const home = await L.climb(task('home:1', 'Q', '15 × 15 + 1'), L.caller(script(['225 + 1 = 226\nANSWER: 226']).ask), { memory: M, mem });
  assert.deepEqual([home.homeAt, home.passes[0].served, home.passes[0].used, home.passes[0].left], [1, ['15 × 15 = 225'], ['225 + 1 = 226'], '226']);
  // without a memory nothing is served and nothing is asked
  const alone = await L.climb(SAME, L.caller(script(['ANSWER: 8325']).ask), { mem });
  assert.deepEqual([alone.arm, alone.passes[0].served], ['climb-alone', []]);
});

test('retry: told only that the answer is not right; naive: asked to review itself, with no checker', async () => {
  const m = script(['225 × 37 = 8250\nANSWER: 8250', '225 × 37 = 8325\nANSWER: 8325']);
  const r = await L.retry(POWER, L.caller(m.ask), {});
  assert.deepEqual([r.arm, r.homeAt, r.stalled, r.passes.length, last(m.seen)], ['retry', 2, false, 2, L.RETRY]);
  assert.deepEqual(r.passes[0].dropped, ['225 × 37 = 8250'], 'the ruling is recorded for scoring, though the model was not shown it');
  assert.deepEqual(m.seen[0].messages, L.opening(POWER.statement, []), 'the same opening as the climb with nothing served');
  const stuck = await L.retry(POWER, L.caller(script(['ANSWER: 1', 'ANSWER: 1', 'ANSWER: 1']).ask), {});
  assert.deepEqual([stuck.homeAt, stuck.stalled, stuck.passes.length], [null, true, 2]);
  const full = await L.retry(POWER, L.caller(script(['ANSWER: 1', 'ANSWER: 2', 'ANSWER: 3']).ask), { depth: 3 });
  assert.deepEqual([full.homeAt, full.stalled, full.passes.length], [null, false, 3]);
  assert.equal((await L.retry(POWER, L.caller(script([{ text: 'ANSWER: 83', cut: true }, 'ANSWER: 8325']).ask), {})).homeAt, 2);
  assert.equal((await L.retry(POWER, L.caller(script([{ text: 'ANSWER: 8325\n83', cut: true }]).ask), {})).homeAt, 1);
  // naive keeps going after a right answer (nobody told it), and can lose it
  const n = script(['ANSWER: 8325', 'ANSWER: 8000', 'ANSWER: 8000', 'ANSWER: 9']);
  const nv = await L.naive(POWER, L.caller(n.ask), {});
  assert.deepEqual([nv.arm, nv.homeAt, nv.passes.length, nv.passes.map((p) => p.home), last(n.seen)], ['naive', 1, 3, [true, false, false], L.REVIEW]);
  const steady = await L.naive(POWER, L.caller(script(['ANSWER: 8325', 'ANSWER: 8325', 'ANSWER: 1']).ask), {});
  assert.deepEqual([steady.passes.length, steady.stalled], [2, false], 'the same answer twice running: it has stopped changing');
  const silent = await L.naive(POWER, L.caller(script(['no answer', 'no answer', 'no answer']).ask), { depth: 3 });
  assert.equal(silent.passes.length, 3, 'no answer is not an answer that stopped changing');
  assert.equal((await L.naive(POWER, L.caller(script([{ text: 'ANSWER: 8325\n83', cut: true }, 'ANSWER: 8325']).ask), {})).passes[0].home, true);
});

test('caller: the same conversation is asked once', async () => {
  const m = script(['ANSWER: 1', 'ANSWER: 2']), call = L.caller(m.ask);
  const a = await call([{ role: 'user', content: 'x' }], 10), b = await call([{ role: 'user', content: 'x' }], 10), c = await call([{ role: 'user', content: 'x' }], 11);
  assert.deepEqual([a.text, a.cached, b.text, b.cached, c.text, c.cached, m.seen.length], ['ANSWER: 1', false, 'ANSWER: 1', true, 'ANSWER: 2', false, 2]);
  const odd = await L.caller(async () => ({ text: 5, ms: 'x', cut: 'yes' }))([], 1);
  assert.deepEqual(odd, { text: '', ms: 0, ttft: null, prompt: null, reply: null, cut: false, cached: false });
  assert.deepEqual(await L.caller(async () => null)([], 1), { text: '', ms: 0, ttft: null, prompt: null, reply: null, cut: false, cached: false });
  assert.deepEqual(await L.caller(async () => ({ text: 'a', ms: 3, ttft: 0.1, prompt: 9, reply: 2, cut: true }))([], 1), { text: 'a', ms: 3, ttft: 0.1, prompt: 9, reply: 2, cut: true, cached: false });
});

test('run and replay: a whole loop over a set, and the same decisions again from the recorded replies alone', async () => {
  const A = task('a:1', 'Work out 15 × 15.', '15 × 15', 'easy'), B = task('b:1', 'Work out 15 × 15 + 1.', '15 × 15 + 1');
  for (const arm of ['climb', 'climb-alone', 'retry', 'naive']) {
    const m = script(['15 × 15 = 225\nANSWER: 225', '15 × 15 = 225\nANSWER: 225', { text: '15 × 15 = 220\nANSWER: 221\n22', cut: true }, '225 + 1 = 226\nANSWER: 226', '225 + 1 = 226\nANSWER: 226', 'ANSWER: 226']);
    const done = [];
    const out = await L.run([A, B], arm, L.caller(m.ask), { depth: 4, mem: { probes: 12 }, onDone: (rec, M) => done.push([rec.id, M ? M.floor.size : null]) });
    assert.equal(out.arm, arm); assert.deepEqual(out.records.map((r) => r.id), ['a:1', 'b:1']); assert.deepEqual(done.map((d) => d[0]), ['a:1', 'b:1']);
    assert.equal(out.memory === null, arm !== 'climb');
    if (arm === 'climb') { assert.equal(done[0][1], 1); assert.deepEqual(out.records[1].passes[0].served, ['15 × 15 = 225'], 'the second problem starts with the first one\'s checked step'); assert.deepEqual([out.memory.facts, out.memory.wanted, out.memory.found], [2, 1, 1]); }
    else assert.equal(done[0][1], null);
    const again = await L.replay([A, B], arm, out.records, { depth: 4, mem: { probes: 12 } });
    assert.deepEqual(again, out, `${arm} replays to the same records`);
  }
  assert.deepEqual(await L.run(null, 'retry', async () => ({}), {}), { arm: 'retry', records: [], memory: null });
  // a run picked up part-way: the first problem comes from its record (no model call, no onDone), the memory is rebuilt from it
  const fresh = script(['225 + 1 = 226\nANSWER: 226']), seen = [];
  const first = await L.run([A], 'climb', L.caller(script(['15 × 15 = 225\nANSWER: 225']).ask), { mem: { probes: 12 } });
  const resumed = await L.run([A, B], 'climb', L.caller(fresh.ask), { mem: { probes: 12 }, done: first.records, onDone: (rec) => seen.push(rec.id) });
  assert.deepEqual([resumed.records[0], fresh.seen.length, seen, resumed.records[1].passes[0].served], [first.records[0], 1, ['b:1'], ['15 × 15 = 225']]);
  const lost = await L.replay([A], 'retry', [], { depth: 2 });
  assert.deepEqual([lost.records[0].homeAt, lost.records[0].passes.length], [null, 2], 'a missing record replays as empty replies');
  assert.deepEqual(Object.keys(L.ARMS), ['climb', 'climb-alone', 'retry', 'naive']); assert.deepEqual(L.SETTINGS, { depth: 8, maxTokens: 128 });
});

test('the settings a loop is handed: depth up to 12, a reply length that is a whole number above nought, passed down by run and replay', async () => {
  const many = () => script(Array.from({ length: 14 }, (_, i) => `ANSWER: ${i + 1}`));
  assert.equal((await L.retry(POWER, L.caller(many().ask), { depth: 12 })).passes.length, 12); assert.equal((await L.retry(POWER, L.caller(many().ask), { depth: 13 })).passes.length, 8);
  assert.equal((await L.retry(POWER, L.caller(many().ask), { depth: 1 })).passes.length, 1); assert.equal((await L.retry(POWER, L.caller(many().ask), {})).passes.length, 8);
  for (const [given, used] of [[0, 128], [-5, 128], [1.5, 128], ['40', 128], [40, 40], [1, 1]]) { const m = many(); await L.climb(POWER, L.caller(m.ask), { depth: 1, maxTokens: given }); assert.equal(m.seen[0].maxTokens, used, `maxTokens ${given}`); }
  // run and replay hand their settings on to the loop
  const B = task('b:1', 'Work out 15 × 15 + 1.', '15 × 15 + 1');
  const out = await L.run([B], 'retry', L.caller(many().ask), { depth: 2 });
  assert.equal(out.records[0].passes.length, 2);
  const kept = { id: 'b:1', passes: [{ said: 'ANSWER: 1' }, { said: 'ANSWER: 2' }, { said: 'ANSWER: 3' }, { said: 'ANSWER: 4' }] };
  assert.equal((await L.replay([B], 'retry', [kept], { depth: 2 })).records[0].passes.length, 2); assert.equal((await L.replay([B], 'retry', [kept], { depth: 3 })).records[0].passes.length, 3);
  assert.equal((await L.replay([B], 'retry', [kept])).records[0].passes.length, 6, 'no settings: the depth of 8; the fifth reply is empty, and the sixth is the fifth again');
});

test('the worked examples are these, word for word, and a loop tells of each pass as it is recorded', async () => {
  assert.deepEqual(L.SHOTS.slice(0, 3), [
    ['A 6 kg box moves at 12 m/s. Kinetic energy = 0.5 × mass × speed × speed. How many joules?', '12 × 12 = 144\n0.5 × 6 = 3\n3 × 144 = 432\nANSWER: 432'],
    ['Work out 34 × 7 + 15 × 8.', '34 × 7 = 238\n15 × 8 = 120\n238 + 120 = 358\nANSWER: 358'],
    ['A current of 12 A flows through a 45 Ω resistor. Power = current × current × resistance. How many watts?', '12 × 12 = 144\n144 × 45 = 6380\nANSWER: 6380'],
  ]);
  assert.equal(X.show(X.evaluate('34 × 7 + 15 × 8').value), '358'); assert.equal(X.show(X.evaluate('0.5 × 6 × 12 × 12').value), '432'); assert.equal(X.show(X.evaluate('12 × 12 × 45').value), '6480');
  for (const [arm, run] of [['climb', L.climb], ['retry', L.retry], ['naive', L.naive]]) {
    const seen = [];
    const r = await run(POWER, L.caller(script(['ANSWER: 1', 'ANSWER: 2', 'ANSWER: 8325', 'ANSWER: 8325']).ask), { onPass: (pass, n) => seen.push([n, pass.answer, pass.home]) });
    assert.deepEqual(seen, r.passes.map((p, i) => [i + 1, p.answer, p.home]), arm); assert.ok(seen.length >= 3, arm);
    assert.deepEqual(seen.slice(0, 3), [[1, '1', false], [2, '2', false], [3, '8325', true]], arm);
  }
  await L.climb(POWER, L.caller(script(['ANSWER: 8325']).ask), { onPass: 'not a function' });
});
