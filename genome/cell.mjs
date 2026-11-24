// cell.mjs — The Climb's three answers for the estate genome's birth check (seed.json, genome/).
//
// judge  the checker's own ruling on one step { working, value }: verified when the working, worked out exactly,
//        comes to that value; unverified when it comes to something else; refused when the input is not a step it can
//        read (no working, no operation in it, or text that is not arithmetic).
// lane   the same reader the checker uses before it rules: a step is in lane when its working is arithmetic.
// health the repository cannot see its page's visitors or callers from inside it, so it says so.
import { evaluate, num, same } from '../src/exact.mjs';

const str = (x) => typeof x === 'string';
const working = (input) => (input !== null && typeof input === 'object' && str(input.working) ? evaluate(input.working) : null);

export async function judge(input) {
  const w = working(input), v = w !== null && str(input.value) ? num(input.value) : null;
  if (w === null || w.ops === 0 || v === null) return 'refused';
  return same(w.value, v) ? 'verified' : 'unverified';
}

export async function inLane(input) {
  const w = working(input);
  return w !== null && w.ops > 0;
}

export async function health() {
  return { used: null, dependedOn: null, lastEarned: null };
}
