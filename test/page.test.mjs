import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build, page, KERNELS, BAKED, rewrite, body } from '../scripts/make-page.mjs';

const root = new URL('..', import.meta.url);
const ROOT = fileURLToPath(root).replace(/[\\/]$/, '');
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const LF = (s) => s.split('\r\n').join('\n');
const html = LF(read('index.html'));
const visible = html.slice(html.indexOf('<body>'), html.indexOf('<script type="module">'));

test('index.html is exactly the build of page/ and the kernels, baked from the published runs', async () => {
  assert.equal(html, await page(ROOT));
});

test('every kernel is inlined byte for byte, its imports read from the scopes above it', () => {
  for (const [ns, file] of KERNELS) {
    const { code } = body(read(file), file);
    assert.ok(html.includes(`const ${ns} = (() => {\n${code}\n`), `${file} is not inlined as built`);
    for (const line of LF(read(file)).split('\n')) {
      if (line.startsWith('import ')) assert.ok(rewrite(line, file), `${file}: an import the page cannot inline: ${line}`);
      else if (!line.startsWith('export default ')) assert.ok(code.includes(line.replace(/^export /, '')), `${file}: a line changed: ${line}`);
    }
  }
  assert.equal(rewrite("import { a, b as c } from '../vendor/stats.mjs';", 'src/x.mjs'), 'const { a, b: c } = STATS;');
  assert.equal(rewrite("import MEM from './keep.mjs';", 'src/x.mjs'), 'const MEM = KEEP;');
  assert.equal(rewrite("import { FallRemember } from '../vendor/memory.mjs';", 'src/x.mjs'), 'const { FallRemember } = MEMORY;');
  assert.equal(rewrite("import LEFT from './left.mjs';", 'src/x.mjs'), '// LEFT: the scope above, under the same name', 'no line that would shadow the scope with itself');
  assert.equal(rewrite('const x = 1;', 'src/x.mjs'), null);
  assert.throws(() => rewrite("import X from './nowhere.mjs';", 'src/x.mjs'), /cannot inline/);
  // no two kernels share a file name, or an import by name could not tell them apart
  assert.equal(new Set(KERNELS.map(([, f]) => f.split('/').pop())).size, KERNELS.length);
});

test('the page code runs: the inlined kernels decide as the modules do', async () => {
  const built = build(ROOT);
  const kernels = built.slice(built.indexOf('<script type="module">') + 22, built.indexOf('// app.js'));
  const mod = await import('data:text/javascript;base64,' + Buffer.from(kernels + '\nexport { SHA, MEMORY, EXACT, CHECK, PLAN, LEFT, KEEP, LOOP, TASKS, SCORE, CLAIMS };').toString('base64'));
  const L = (await import('../src/loop.mjs')).default, T = (await import('../src/tasks.mjs')).default, C = (await import('../src/checker.mjs')).default, P = (await import('../src/plan.mjs')).default, LEFT = (await import('../src/left.mjs')).default;
  const tasks = T.set(20261101, 2), power = tasks.find((t) => t.family === 'power');
  assert.deepEqual(mod.TASKS.set(20261101, 2), tasks); assert.equal(power.ask, '19 × 19 × 38');
  const reply = '19 × 19 = 361\n361 × 38 = 13778\nANSWER: 13778';
  assert.deepEqual(mod.CHECK.rule(reply, power), C.rule(reply, power));
  assert.deepEqual(mod.PLAN.ways('361 × 38'), P.ways('361 × 38')); assert.equal(mod.PLAN.ways('361 × 38').length, 3);
  const left = (K) => { const x = K.wrong(K.start(power.ask), '19 × 38'); return [K.left(x.left), K.ops(x.left), K.key(x.left), K.atoms(x.left), x.split]; };
  assert.deepEqual(left(mod.LEFT), left(LEFT)); assert.equal(left(mod.LEFT)[0], '(19 × 30 + 19 × 8) × 19');
  assert.deepEqual(mod.LOOP.SHOTS, L.SHOTS);
  const script = () => { let i = 0; const said = [reply, '361 × 30 = 10830\n361 × 8 = 2888\n10830 + 2888 = 13718\nANSWER: 13718']; return async () => ({ text: said[i++ % 2], ms: 1 }); };
  for (const arm of ['climb', 'climb-alone', 'retry', 'naive']) {
    const a = await mod.LOOP.run(tasks, arm, mod.LOOP.caller(script()), { depth: 3, mem: { probes: 12 } }), b = await L.run(tasks, arm, L.caller(script()), { depth: 3, mem: { probes: 12 } });
    assert.deepEqual(a, b, arm);
    assert.deepEqual(mod.SCORE.summary(a.records, 3), (await import('../src/score.mjs')).default.summary(b.records, 3));
  }
  assert.equal(mod.SHA.sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(mod.MEMORY.DODECA.length, 12);
  assert.deepEqual(mod.CLAIMS.evaluate(null).map((v) => v.pass), new Array(8).fill(null));
});

test('nothing ships as a bare placeholder: every fill target is baked, and an unmeasured value says so', () => {
  assert.ok(!/>\s*…\s*</.test(visible), 'an element whose whole content is an ellipsis is on the page');
  for (const id of BAKED) {
    const m = visible.match(new RegExp(`<([a-z0-9]+)\\b[^>]*\\sid="${id}"[^>]*>`));
    assert.ok(m, `#${id} is on the page`);
  }
  const tpl = read('page/template.html');
  const bound = [...tpl.matchAll(/data-bind="([^"]+)"/g)].map((m) => m[1]);
  for (const k of bound) {
    const inTpl = tpl.match(new RegExp(`data-bind="${k.replace(/[.$]/g, '\\$&')}"[^>]*>([^<]*)<`))[1];
    const m = visible.match(new RegExp(`data-bind="${k.replace(/[.$]/g, '\\$&')}"[^>]*>([\\s\\S]*?)</(?:span|b|p|td)>`));
    assert.ok(m, `data-bind="${k}" is on the built page`);
    if (m[1] === inTpl) assert.match(m[1], /not measured yet/, `data-bind="${k}" was not baked and does not say it is unmeasured`);
  }
});

test('every id and binding the page script uses is on the page, and every binding is filled by the script', () => {
  const tpl = read('page/template.html'), app = read('page/app.js');
  const ids = new Set([...tpl.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of app.matchAll(/\$\('([^']+)'\)/g)) assert.ok(ids.has(m[1]), `#${m[1]} is used by the script but not on the page`);
  const bound = new Set([...tpl.matchAll(/data-bind="([^"]+)"/g)].map((m) => m[1]));
  const set = new Set([...app.matchAll(/bind\('([^']+)'/g)].map((m) => m[1]));
  for (const k of bound) assert.ok(set.has(k), `data-bind="${k}" is never filled`);
  for (const k of set) assert.ok(bound.has(k), `the script fills "${k}", which is not on the page`);
  // a fill target holds plain text only, so the bake can write into it
  for (const k of [...BAKED.map((id) => `id="${id}"`), ...[...bound].map((b) => `data-bind="${b}"`)]) {
    assert.match(tpl, new RegExp(`<([a-z0-9]+)\\b[^>]*\\s${k.replace(/[.$]/g, '\\$&')}[^>]*>[^<]*</\\1>`), `${k} must hold plain text in the template`);
  }
});

test('the page says what it is and how to use it, with no private symbols and no price list', () => {
  const tpl = read('page/template.html');
  for (const h of ['id="live"', 'id="start"', 'id="results"', 'id="wall"', 'id="claims"', 'id="how"', 'id="blueprint"', 'id="adopt"', 'id="brochure"', 'id="paper"']) assert.ok(tpl.includes(h), h);
  // the estate's private vocabulary stays private: none of its symbols or its shape-word is on any public file
  const shape = ['to', 'rus'].join('');
  for (const f of ['page/template.html', 'page/app.js', 'README.md', 'CLAIMS.md', 'SEAL.md', 'NOTICE', 'seed.json', ...readdirSync(new URL('src/', root)).map((x) => `src/${x}`), ...readdirSync(new URL('vendor/', root)).map((x) => `vendor/${x}`), ...readdirSync(new URL('scripts/', root)).map((x) => `scripts/${x}`)]) {
    const text = read(f);
    assert.ok(!/[◊κφ]/.test(text), `${f}: a private symbol`);
    assert.ok(!text.toLowerCase().includes(shape), `${f}: the private shape-word`);
  }
  assert.ok(/supplied by <a href="https:\/\/www\.ai-nativesolutions\.com">AI Native Solutions<\/a>/.test(tpl));
  assert.ok(/agreed per deployment, in each deployment's agreement/.test(tpl));
  assert.ok(existsSync(new URL('data/published.json', root)));
});

test('no private repository name is in anything this repository ships (checked by hash: the names are not listed here)', () => {
  const banned = new Set(JSON.parse(read('data/private-names.sha256.json')).sha256);
  assert.ok(banned.size >= 50);
  const sha = (s) => createHash('sha256').update(s).digest('hex');
  const files = ['index.html', 'README.md', 'CLAIMS.md', 'SEAL.md', 'NOTICE', 'seed.json', 'sw.js', 'manifest.webmanifest', 'data/published.json', 'data/settings.json', 'data/prices.json'];
  for (const dir of ['src', 'scripts', 'test', 'page', 'genome', 'vendor', '.github/workflows']) for (const f of readdirSync(new URL(`${dir}/`, root))) files.push(`${dir}/${f}`);
  const seen = new Set();
  for (const f of files) {
    for (const tok of read(f).toLowerCase().match(/[a-z0-9_]+(?:-[a-z0-9_]*)*/g) || []) {
      if (seen.has(tok)) continue;
      seen.add(tok);
      const parts = tok.split('-');
      for (let i = 0; i < parts.length; i++) for (let k = i + 1; k <= parts.length; k++) {
        const run = parts.slice(i, k).join('-');
        if (run.length >= 5) assert.ok(!banned.has(sha(run)), `${f} carries a private repository name (a ${run.length}-letter run in "${tok.slice(0, 4)}…")`);
      }
    }
  }
});

test('no two elements of the page share an id', () => {
  const tpl = read('page/template.html'), seen = new Map();
  for (const m of tpl.matchAll(/\sid="([^"]+)"/g)) seen.set(m[1], (seen.get(m[1]) || 0) + 1);
  assert.deepEqual([...seen].filter(([, n]) => n > 1).map(([id]) => id), []);
  assert.ok(seen.size > 30);
});
