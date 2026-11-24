import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SEALED } from '../scripts/seal.mjs';

const sha = (b) => createHash('sha256').update(b).digest('hex');
const at = (p) => new URL(`../${p}`, import.meta.url);
const rd = (p) => JSON.parse(readFileSync(at(p), 'utf8'));

test('every sealed file still has the bytes the seal froze, and the seal covers every file that can change a result', () => {
  const seal = rd('SEAL.json');
  assert.equal(seal.v, 'the-climb-seal/1');
  for (const [f, h] of Object.entries(seal.files)) assert.equal(sha(readFileSync(at(f))), h, `${f} changed after the seal`);
  const kernels = readdirSync(at('src/')).filter((f) => f.endsWith('.mjs')).map((f) => `src/${f}`), vendored = readdirSync(at('vendor/')).filter((f) => f.endsWith('.mjs')).map((f) => `vendor/${f}`);
  assert.deepEqual(Object.keys(seal.files).sort(), [...kernels, ...vendored, 'data/settings.json', 'CLAIMS.md'].sort());
  assert.deepEqual([...SEALED].sort(), Object.keys(seal.files).sort());
  assert.ok(kernels.length >= 9 && vendored.length >= 2);
});

test('no sealed file holds a carriage return, so the seal is the same on every machine', () => {
  for (const f of Object.keys(rd('SEAL.json').files)) assert.ok(!readFileSync(at(f)).includes(13), f);
  assert.match(readFileSync(at('.gitattributes'), 'utf8'), /^\* text=auto eol=lf$/m);
});

test('every vendored file is recorded with the hash it has', () => {
  const p = rd('vendor/PROVENANCE.json');
  assert.deepEqual(p.files.map((v) => v.file).sort(), readdirSync(at('vendor/')).filter((f) => f.endsWith('.mjs')).map((f) => `vendor/${f}`).sort());
  for (const v of p.files) assert.equal(sha(readFileSync(at(v.file))), v.sha256, v.file);
  assert.match(p.files.find((v) => v.file === 'vendor/memory.mjs').commit, /^[0-9a-f]{40}$/);
});

test('the sealed problems are the ones the sealed settings make, and they are not the dev problems', async () => {
  const T = (await import('../src/tasks.mjs')).default, s = rd('data/settings.json');
  const sealed = T.set(s.sets.sealed.seed, s.sets.sealed.sheets), dev = T.set(s.sets.dev.seed, s.sets.dev.sheets);
  assert.equal(sealed.length, 96); assert.equal(dev.length, 40);
  assert.notEqual(s.sets.sealed.seed, s.sets.dev.seed); assert.equal(s.sets.sample.seed, s.sets.dev.seed);
  const devText = new Set(dev.map((t) => t.statement));
  assert.equal(sealed.filter((t) => devText.has(t.statement)).length, 0, 'a sealed problem is word for word a dev problem');
  assert.deepEqual(Object.fromEntries(['easy', 'climb', 'wall'].map((t) => [t, sealed.filter((x) => x.tier === t).length])), { easy: 24, climb: 48, wall: 24 });
});

test('a published sealed run was made under this seal; the dev run and the sample never count as sealed', () => {
  const seal = sha(readFileSync(at('SEAL.json'))), pub = rd('data/published.json');
  if (pub.sealed) { const r = rd(pub.sealed); assert.deepEqual([r.set, r.complete, r.sealSha256], ['sealed', true, seal]); }
  if (pub.dev) { const r = rd(pub.dev); assert.deepEqual([r.set, r.complete], ['dev', true]); }
  const dir = at('data/runs/');
  if (existsSync(dir)) for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) { const r = rd(`data/runs/${f}`); if (r.set === 'sealed' && r.arms !== undefined) assert.equal(r.sealSha256, seal, `${f} is a sealed run made under another seal`); }
  // a reuse measurement is not a run of the claims: it only says which set's problems it timed
  if (pub.kv) { const k = rd(pub.kv); assert.equal(k.arms, undefined); assert.ok(Array.isArray(k.pairs) && k.pairs.length > 0); assert.ok(['sealed', 'dev'].includes(k.set)); }
});
