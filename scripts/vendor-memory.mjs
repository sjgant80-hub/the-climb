// vendor-memory.mjs — vendor/memory.mjs is the estate's own 12-chamber memory kernel (estate-nest, kernel/fall-remember.mjs)
// with its comments taken out and one unused constant dropped. No line of its code is changed. This script makes
// that file from the upstream bytes, so the claim can be checked: with --check it fetches the upstream file at the
// recorded commit, derives again, and fails unless the result is byte for byte the file in this repository.
//   node scripts/vendor-memory.mjs <upstream file>     derive vendor/memory.mjs and record vendor/PROVENANCE.json
//   node scripts/vendor-memory.mjs --check             fetch upstream at the recorded commit and compare (CI)
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const sha = (s) => createHash('sha256').update(s).digest('hex');
export const UPSTREAM = { repo: 'sjgant80-hub/estate-nest', path: 'kernel/fall-remember.mjs', commit: '0de2b6c7a9a0950cf09c193360582469e19085dc' };
const HEAD = '// memory.mjs: the estate\'s 12-chamber memory kernel, from estate-nest (kernel/fall-remember.mjs) at the commit in\n// vendor/PROVENANCE.json. Comments removed and one unused constant dropped by scripts/vendor-memory.mjs; the code is\n// unchanged, and CI derives this file again from the upstream bytes and compares.\n';
// derive(upstream text) → this repository's copy
export function derive(text) {
  const out = [];
  for (const raw of text.split('\r\n').join('\n').split('\n')) {
    // the dropped constant is found by its value, the line "export const … = (Math.sqrt(5) - 1) / 2;", which nothing in the file uses
    if (/^\s*\/\//.test(raw) || /^export const \w+ = \(Math\.sqrt\(5\) - 1\) \/ 2;/.test(raw)) continue;
    out.push(raw.replace(/\s+\/\/ [^'"`]*$/, ''));
  }
  return HEAD + out.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').replace(/\n*$/, '\n');
}

if (process.argv[1] && process.argv[1].endsWith('vendor-memory.mjs')) {
  if (process.argv[2] === '--check') {
    const p = JSON.parse(readFileSync('vendor/PROVENANCE.json', 'utf8')).files.find((f) => f.file === 'vendor/memory.mjs');
    const r = await fetch(`https://raw.githubusercontent.com/${p.repo}/${p.commit}/${p.path}`);
    const up = await r.text(), ours = readFileSync('vendor/memory.mjs', 'utf8');
    const okay = r.ok && sha(up) === p.upstreamSha256 && derive(up) === ours;
    console.log(`${okay ? 'same ' : 'DIFFERS '}vendor/memory.mjs = derive(${p.repo}@${p.commit.slice(0, 7)}:${p.path})`);
    process.exitCode = okay ? 0 : 1;
  } else {
  const up = readFileSync(process.argv[2], 'utf8'), ours = derive(up);
  writeFileSync('vendor/memory.mjs', ours);
  const prov = { v: 'the-climb-vendor/1', note: 'each vendored file and where it came from', files: [
    { file: 'vendor/memory.mjs', ...UPSTREAM, upstreamSha256: sha(up), sha256: sha(ours), how: 'derived by scripts/vendor-memory.mjs: comment lines and trailing comments removed, one unused constant dropped, no code changed', gate: 'estate-nest kernel/witness.baseline.json and its gate workflow' },
    { file: 'vendor/stats.mjs', repo: 'sjgant80-hub/docdecdemo', path: 'src/stats.mjs', how: 'byte for byte, as vendored in browser-swarm', sha256: sha(readFileSync('vendor/stats.mjs', 'utf8')), gate: 'docdecdemo data/v2/gates.json' },
  ] };
  writeFileSync('vendor/PROVENANCE.json', JSON.stringify(prov, null, 1) + '\n');
  console.log(`vendor/memory.mjs: ${ours.length} bytes from ${up.length} upstream`);
  }
}
