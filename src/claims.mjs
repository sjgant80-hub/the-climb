// claims.mjs — the verdict on every registered claim, worked out from the recorded sealed run. Pure and total.
// The bars are CLAIMS.md's, word for word in BARS; test/claims.test.mjs checks the file still says each one. A claim
// whose evidence is missing is pending (pass: null), never passed or failed by default. Every bar is tested on
// whole-number counts of problems, so a result that is exactly on a bar is decided exactly.
import { paired, squares, homeBy, curve, cost } from './score.mjs';

const get = (o, k) => { try { return o[k]; } catch { return undefined; } };
const pct = (x) => `${(x * 100).toFixed(1)}%`;
const pts = (x) => `${(x * 100).toFixed(1)} points`;
export const NAMES = {
  C1: 'The climb lifts', C2: 'Checking is what does it', C3: 'Left alone, it does not climb', C4: 'The memory earns its place',
  C5: 'Easy is easy', C6: 'The climb tier climbs', C7: 'The wall holds', C8: 'Each pass squares what is left',
};
export const BARS = {
  C1: 'the climb gets at least 20 points more of the sealed problems right by its last pass than one try does, and more by an exact two-sided McNemar test, p < 0.05',
  C2: 'the climb gets more of the sealed problems right by its last pass than the retry loop does with the same number of passes, by the same test, p < 0.05',
  C3: 'the naive loop, at its last pass, has at most 5 points more of the sealed problems right than one try',
  C4: 'with the memory, the climb gets at least as many sealed problems home as without it, and takes fewer passes of the model to do it',
  C5: 'at least 80% of the easy tier right at one try',
  C6: 'on the climb tier, at most 50% right at one try, and at least 40 points more after the climb',
  C7: 'at most 20% of the wall tier home after the climb',
  C8: 'on the climb tier, after every pass the share not yet home is at most the square of the share not yet home one pass earlier',
};
const pending = (id, why) => ({ id, pass: null, result: `pending: ${why}` });
const beats = (p) => Math.sign(p.bOnly - p.aOnly) === 1 && p.p < 0.05;
// one try, as records: the retry loop's first pass, cut to depth 1
const firstTry = (recs) => recs.map((r) => ({ ...r, homeAt: homeBy(r, 1) ? 1 : null }));
const of = (rs, tier) => rs.filter((r) => get(r, 'tier') === tier);
const home = (rs, d) => rs.filter((r) => homeBy(r, d)).length;

// evaluate(F) → [{ id, pass, result }]. F holds the depth and, per loop (retry, naive, climb-alone, climb), the records
// of the run. Every number is worked out here from those records; a loop with no records is missing evidence.
export function evaluate(F) {
  const f = F || {}, depth = get(f, 'depth'), recs = get(f, 'records') || {}, deep = Number.isInteger(depth) && depth >= 1;
  const arm = (name) => { const r = get(recs, name); return deep && Array.isArray(r) && r.length > 0 ? r : null; };
  const R = arm('retry'), N = arm('naive'), A = arm('climb-alone'), C = arm('climb');
  const out = [];
  if (R === null || C === null) out.push(pending('C1', 'needs the retry loop and the climb on the sealed problems'), pending('C2', 'needs the retry loop and the climb on the sealed problems'));
  else {
    const one = home(R, 1), up = home(C, depth), p1 = paired(firstTry(R), C, depth), p2 = paired(R, C, depth);
    // 20 points: up / C.length - one / R.length >= 1/5, in whole numbers
    out.push({ id: 'C1', pass: (up * R.length - one * C.length) * 5 >= R.length * C.length && beats(p1), result: `one try ${pct(one / R.length)}, the climb ${pct(up / C.length)}: ${pts(up / C.length - one / R.length)}; ${p1.bOnly} problems only the climb got home, ${p1.aOnly} only the one try, p = ${p1.p.toPrecision(3)}` });
    out.push({ id: 'C2', pass: beats(p2), result: `retry ${pct(home(R, depth) / R.length)}, the climb ${pct(up / C.length)}; ${p2.bOnly} problems only the climb got home, ${p2.aOnly} only the retry loop, p = ${p2.p.toPrecision(3)}` });
  }
  if (R === null || N === null) out.push(pending('C3', 'needs the retry loop and the naive loop on the sealed problems'));
  else {
    const one = home(R, 1), last = home(N, depth);
    // 5 points: last / N.length - one / R.length <= 1/20, in whole numbers
    out.push({ id: 'C3', pass: (last * R.length - one * N.length) * 20 <= R.length * N.length, result: `one try ${pct(one / R.length)}, naive at its last pass ${pct(last / N.length)}: ${pts(last / N.length - one / R.length)}` });
  }
  out.push(A === null || C === null ? pending('C4', 'needs the climb with and without the memory on the sealed problems') : { id: 'C4', pass: home(C, depth) >= home(A, depth) && cost(C).passes < cost(A).passes, result: `home: ${home(C, depth)} with the memory, ${home(A, depth)} without; passes of the model: ${cost(C).passes} with, ${cost(A).passes} without` });
  const easy = R === null ? [] : of(R, 'easy');
  out.push(easy.length === 0 ? pending('C5', 'needs one try on the sealed easy problems') : { id: 'C5', pass: home(easy, 1) * 5 >= easy.length * 4, result: `${pct(home(easy, 1) / easy.length)} of the ${easy.length} easy problems right at one try` });
  const cold = R === null ? [] : of(R, 'climb'), tier = C === null ? [] : of(C, 'climb'), wall = C === null ? [] : of(C, 'wall');
  if (cold.length === 0 || tier.length === 0) out.push(pending('C6', 'needs one try and the climb on the sealed climb-tier problems'));
  else {
    const first = home(cold, 1), after = home(tier, depth);
    // at most half at one try; and 40 points: after / tier.length - first / cold.length >= 2/5, in whole numbers
    out.push({ id: 'C6', pass: first * 2 <= cold.length && (after * cold.length - first * tier.length) * 5 >= 2 * tier.length * cold.length, result: `${pct(first / cold.length)} of the ${tier.length} climb-tier problems right at one try, ${pct(after / tier.length)} after the climb: ${pts(after / tier.length - first / cold.length)}` });
  }
  out.push(wall.length === 0 ? pending('C7', 'needs the climb on the sealed wall problems') : { id: 'C7', pass: home(wall, depth) * 5 <= wall.length, result: `${home(wall, depth)} of the ${wall.length} wall problems home after the climb (${pct(home(wall, depth) / wall.length)})` });
  if (tier.length === 0) out.push(pending('C8', 'needs the climb on the sealed climb-tier problems'));
  else {
    const c = curve(tier, depth), sq = squares(c);
    out.push({ id: 'C8', pass: sq.holds, result: sq.steps.length ? `share not home after each pass: ${c.map((s) => pct(1 - s)).join(', ')}; it held at ${sq.steps.filter((s) => s.holds).length} of ${sq.steps.length} steps` : 'only one pass, so there is no step to test' });
  }
  return out;
}

export default { NAMES, BARS, evaluate };
