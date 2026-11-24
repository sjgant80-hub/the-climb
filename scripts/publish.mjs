// publish.mjs — take a run that a browser tab made (saved from the page) and publish it, after checking it: it must
// be the complete set it says it is, every loop must cover every problem exactly once, a sealed run must have been
// made under this repository's seal, and every problem in every loop must come out the same when it is decided again
// here from its recorded replies, with no model. Nothing is edited: the file is copied as saved.
//   node scripts/publish.mjs <run file> sealed|dev      publish a run
//   node scripts/publish.mjs <reuse file> kv             publish a GPU-reuse measurement
//   node scripts/publish.mjs --check                     check the published runs again, in place (CI does this)
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import L from '../src/loop.mjs';
import T from '../src/tasks.mjs';

const rd = (p) => JSON.parse(readFileSync(p, 'utf8'));
const hash = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');
const settings = rd('data/settings.json'), pub = rd('data/published.json');
const ARMS = ['retry', 'naive', 'climb-alone', 'climb'];
const key = (r) => JSON.stringify([r.id, r.homeAt, r.stalled, r.passes.map((p) => [p.kept, p.dropped, p.answer, p.home, p.served, p.used ?? null, p.left ?? null, p.cut === true])]);
const fail = (why) => { console.error(`not published: ${why}`); process.exit(1); };

// check(run, set) → a line of what was checked; exits with the reason if anything is wrong
export async function check(run, set) {
  const s = settings.sets[set];
  if (!s) fail(`there is no set called ${set}`);
  const tasks = T.set(s.seed, s.sheets), opts = { depth: settings.depth, maxTokens: settings.maxTokens, mem: settings.mem };
  if (run.set !== set || run.complete !== true) fail(`the run is not the complete ${set} set`);
  if (set === 'sealed') { const seal = hash('SEAL.json'); if (run.sealSha256 !== seal) fail(`the run records seal ${String(run.sealSha256).slice(0, 12)}, this repository's is ${seal.slice(0, 12)}`); }
  let decided = 0;
  for (const arm of ARMS) {
    const recs = run.arms && run.arms[arm] && run.arms[arm].records;
    if (!Array.isArray(recs) || recs.length !== tasks.length || !tasks.every((t, i) => recs[i].id === t.id)) fail(`the ${arm} loop does not cover every problem once, in order`);
    const again = await L.replay(tasks, arm, recs, opts);
    const differ = again.records.filter((r, i) => key(r) !== key(recs[i])).length;
    if (differ) fail(`${arm}: ${differ} problems do not come out the same from their recorded replies`);
    if (arm === 'climb' && JSON.stringify(again.memory) !== JSON.stringify(run.arms.climb.memory)) fail('the climb\'s memory numbers do not come out the same');
    decided += recs.length;
  }
  return `${set}: ${run.model}, ${run.gpu}, ${run.seconds} s in ${run.segments} sitting(s), ${run.privacy ? run.privacy.requests : '?'} network requests; ${decided} problem-loops decided again identically`;
}

if (process.argv[1] && process.argv[1].endsWith('publish.mjs')) {
  if (process.argv[2] === '--check') {
    for (const set of ['sealed', 'dev']) if (pub[set] && existsSync(pub[set])) console.log(await check(rd(pub[set]), set));
    if (pub.kv && existsSync(pub.kv)) { const k = rd(pub.kv); if (!Array.isArray(k.pairs) || !k.pairs.length) fail('the reuse file holds no timings'); console.log(`kv: ${k.pairs.length} later passes timed, ${k.model}, ${k.gpu}`); }
  } else {
    const [file, what] = process.argv.slice(2);
    if (!file || !existsSync(file) || !['sealed', 'dev', 'kv'].includes(what)) fail('usage: node scripts/publish.mjs <file> sealed|dev|kv');
    const run = rd(file), out = `data/runs/${what}.json`;
    if (what === 'kv') { if (!Array.isArray(run.pairs) || !run.pairs.length) fail('the reuse file holds no timings'); console.log(`kv: ${run.pairs.length} later passes timed`); } else console.log(await check(run, what));
    copyFileSync(file, out);
    pub[what] = out;
    writeFileSync('data/published.json', JSON.stringify(pub, null, 1) + '\n');
  }
}
