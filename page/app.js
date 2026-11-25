// app.js — the page. The kernels above it are the gated code, inlined byte for byte; this file only shows what they
// compute and drives the model in the tab. Every number it writes comes from a recorded run through SCORE and CLAIMS.
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (x) => (x === null || x === undefined || Number.isNaN(x) ? '—' : `${(x * 100).toFixed(1)}%`);
const bind = (k, html) => { for (const el of document.querySelectorAll(`[data-bind="${k}"]`)) el.innerHTML = html; };
const getJSON = async (p) => { try { const r = await fetch(p); return r.ok ? await r.json() : null; } catch { return null; } };
const NM = '<span class="pend">not measured yet</span>';
const WEBLLM = 'https://esm.run/@mlc-ai/web-llm@0.2.79';
const MODELS = { 'Llama-3.2-1B-Instruct-q4f16_1-MLC': 'Llama 3.2 1B, 4-bit (about 880 MB)' };
const ARMS = ['retry', 'naive', 'climb-alone', 'climb'];
const ARM_NAMES = { single: 'one try', retry: 'retry (told only "not right")', naive: 'naive (re-reads its own work)', 'climb-alone': 'the climb, no memory between problems', climb: 'the climb' };
const TIER_NAMES = { easy: 'easy', climb: 'climb', wall: 'wall' };
const S = { data: null, engine: null, model: null, gpu: null, busy: false, view: 'published', local: null, kvLocal: null, onToken: null, canRun: false };
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* storage off */ } },
};
try { performance.setResourceTimingBufferSize(100000); } catch { /* older browsers */ }

// ── the theme switch (light → dark → the device's own) ──
(function theme() {
  const root = document.documentElement;
  let t = null;
  try { t = localStorage.getItem('climb-theme'); } catch { t = null; }
  if (t === 'light' || t === 'dark') root.dataset.theme = t;
  $('theme').addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : root.dataset.theme === 'dark' ? '' : 'light';
    if (next) root.dataset.theme = next; else delete root.dataset.theme;
    try { if (next) localStorage.setItem('climb-theme', next); else localStorage.removeItem('climb-theme'); } catch { /* storage off */ }
  });
})();

// ── the sets and the facts worked out from a run ──
const tasksOf = (set) => { const s = S.data.settings.sets[set]; return s ? TASKS.set(s.seed, s.sheets) : []; };
const recordsOf = (run, arm) => (run && run.arms && run.arms[arm] && Array.isArray(run.arms[arm].records) ? run.arms[arm].records : []);
const covers = (run, arm, tasks) => { const ids = new Set(recordsOf(run, arm).map((r) => r.id)); return tasks.length > 0 && tasks.every((t) => ids.has(t.id)); };
// facts(run, set) → everything the page says about one run of one set
function facts(run, set) {
  const tasks = tasksOf(set), depth = S.data.settings.depth, F = { set, tasks, depth, run: run || null, kv: S.data.runs.kv || null };
  for (const arm of ARMS) F[arm] = covers(run, arm, tasks) ? SCORE.summary(recordsOf(run, arm), depth) : null;
  F.records = Object.fromEntries(ARMS.map((a) => [a, F[a] ? recordsOf(run, a) : null]));
  F.memory = F.climb && run.arms.climb.memory ? run.arms.climb.memory : null;
  return F;
}
function view() {
  const mine = S.view === 'mine' && S.local, run = mine ? S.local : S.data.runs.sealed, set = mine ? S.local.set : 'sealed';
  return facts(run, set);
}
const sourceOf = (run) => (run ? `${MODELS[run.model] ? MODELS[run.model].split(' (')[0] : esc(run.model)}, in a browser tab (WebLLM 0.2.79), ${esc(run.gpu || 'GPU not reported')}, ${String(run.at).slice(0, 10)}` : 'not measured yet');

// ── one climb as a story: what the cell was told before each pass, what it wrote, and the ruling on each line ──
const isClimb = (rec) => rec.arm === 'climb' || rec.arm === 'climb-alone';
// what is left of a problem's calculation once the facts the memory served are crossed off
const afterServed = (task, served) => (served || []).reduce((x, fact) => { const [w, v] = fact.split(' = '), got = x === null ? null : LEFT.cross(x, w, EXACT.num(v)); return got === null ? x : got.left; }, LEFT.start(task.ask));
function story(task, rec) {
  const out = [], first = rec.passes[0] || {};
  let before = LOOP.opening(task.statement, isClimb(rec) ? first.served || [] : [], isClimb(rec) ? afterServed(task, first.served) : null).pop().content;
  for (const [i, p] of rec.passes.entries()) {
    out.push({ n: i + 1, before, said: p.said, cut: p.cut === true, home: p.home, answer: p.answer, kept: p.kept, used: p.used || p.kept, dropped: p.dropped, served: p.served || [], left: p.left ?? null });
    const next = rec.passes[i + 1];
    // the message that went back in, made again by the loop's own code from what this pass recorded
    before = rec.arm === 'retry' ? LOOP.RETRY : rec.arm === 'naive' ? LOOP.REVIEW : LOOP.ruling({ used: p.used || p.kept, kept: p.kept, dropped: p.dropped.map((text) => ({ text })), splits: p.left === null || p.left === undefined ? LOOP.judge(p.cut ? p.said.split('\n').slice(0, -1).join('\n') : p.said, task, null).splits : [], answer: p.answer }, next ? next.served || [] : [], p.left === null || p.left === undefined ? null : LEFT.start(p.left));
  }
  return out;
}
// a reply drawn line by line: a tick on a true line, a cross on a false one, nothing on a line that claims nothing
function linesHTML(p, task, checked) {
  const lines = String(p.said).split('\n'), claims = CHECK.claimsOf(p.cut ? lines.slice(0, -1).join('\n') : p.said), used = new Set(p.used);
  return lines.map((l, n) => {
    if (l.trim() === '') return '';
    if (p.cut && n === lines.length - 1) return `<div><span class="muted">·</span> <span class="muted">${esc(l)}</span> <span class="small muted">cut off at the length limit, so not ruled on</span></div>`;
    if (/^\W*(?:final\s+)?answer\b/i.test(l)) { const a = CHECK.answerOf(l), ok = a !== null && CHECK.home(task, a); return `<div><span class="${ok ? 'pass' : 'fail'}">${ok ? '✓' : '✗'}</span> ${esc(l)} <span class="small ${ok ? 'pass' : 'fail'}">${ok ? 'right: home' : 'not right'}</span></div>`; }
    const c = claims.filter((x) => x.line === n);
    if (c.length === 0) return `<div><span class="muted">·</span> <span class="muted">${esc(l)}</span></div>`;
    const ok = c.every((x) => x.ok), hit = c.some((x) => used.has(`${x.left} = ${x.right}`));
    const word = !checked ? (ok ? 'true' : 'false') : !ok ? 'dropped' : hit ? 'kept: crossed off' : 'true, but not a step of this problem';
    return `<div><span class="${ok ? 'pass' : 'fail'}">${ok ? '✓' : '✗'}</span> ${esc(l)} <span class="small muted">${word}</span></div>`;
  }).join('');
}
function storyHTML(task, rec, opts) {
  const st = story(task, rec), o = opts || {}, depth = S.data.settings.depth, climb = isClimb(rec);
  const head = `<p class="small muted">${esc(o.label || '')}</p><p><b>${esc(task.statement)}</b></p>`;
  const body = st.map((p) => `<div class="stage ${p.home ? 'ok' : 'no'}"><b>Pass ${p.n} of ${depth}</b>${p.served.length ? ` <span class="small muted">· from the memory: ${esc(p.served.join('; '))}</span>` : ''}${p.n === 1 ? '' : `<details><summary class="small">what the ${climb ? 'checker' : 'page'} said first</summary><pre>${esc(p.before)}</pre></details>`}<div>${linesHTML(p, task, climb)}</div>${climb && p.left !== null && !p.home ? `<div class="small"><b>Left to do:</b> <code>${esc(p.left)}</code></div>` : ''}</div>`).join('');
  const end = rec.homeAt && rec.arm !== 'naive' ? `<div class="verdict ok">Right at pass ${rec.homeAt}: the checker ruled the answer right.</div>` : rec.arm === 'naive' ? `<div class="verdict ${st[st.length - 1].home ? 'ok' : 'no'}">Nobody was checking. It stopped at pass ${st.length} with ${st[st.length - 1].home ? 'a right' : 'a wrong'} answer.</div>` : `<div class="verdict no">Not reached${rec.stalled ? ': it stalled (the same reply to the same ruling)' : `: ${st.length} passes used`}.</div>`;
  return head + body + (o.open ? '' : end);
}

// ── the memory map: twelve chambers, each beside five others, filled as kept steps are written in ──
function mapSVG(counts, note) {
  const c = Array.isArray(counts) && counts.length === 12 ? counts : new Array(12).fill(0), max = Math.max(1, ...c);
  const pos = (i) => { if (i === 0) return [150, 150]; if (i === 11) return [450, 150]; const ring = i <= 5 ? 0 : 1, k = ring === 0 ? i - 1 : i - 6, a = (k / 5) * 2 * Math.PI - Math.PI / 2 + ring * Math.PI / 5; return [(ring === 0 ? 150 : 450) + 105 * Math.cos(a), 150 + 105 * Math.sin(a)]; };
  const edges = MEMORY.DODECA.flatMap((nb, i) => nb.filter((j) => j > i).map((j) => [i, j])).filter(([i, j]) => (i <= 5) === (j <= 5) || true);
  const lines = edges.map(([i, j]) => { const [x1, y1] = pos(i), [x2, y2] = pos(j); return `<line x1="${x1.toFixed(0)}" y1="${y1.toFixed(0)}" x2="${x2.toFixed(0)}" y2="${y2.toFixed(0)}" stroke="var(--line)" stroke-width="1"/>`; }).join('');
  const dots = c.map((n, i) => { const [x, y] = pos(i), r = 12 + 16 * Math.sqrt(n / max); return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="${n ? 'var(--series)' : 'var(--chip)'}" opacity="${n ? 0.85 : 1}" stroke="var(--line)"/><text x="${x.toFixed(0)}" y="${(y + 4).toFixed(0)}" text-anchor="middle" style="font-size:12px">${n}</text>`; }).join('');
  return `<svg class="diagram" viewBox="0 0 600 300" role="img" aria-label="The memory: twelve chambers holding ${c.reduce((a, b) => a + b, 0)} kept steps">${lines}${dots}<text x="300" y="292" text-anchor="middle" class="muted">${esc(note || 'the memory: kept steps in each of its twelve chambers')}</text></svg>`;
}

// ── results ──
function curveSVG(F) {
  const series = [['single', F.retry ? Array.from({ length: F.depth }, () => F.retry.first) : null, 'var(--muted)', '4 4'], ['retry', F.retry && F.retry.curve, 'var(--series2)', ''], ['naive', F.naive && F.naive.curve, 'var(--series3)', ''], ['climb-alone', F['climb-alone'] && F['climb-alone'].curve, 'var(--series)', '6 3'], ['climb', F.climb && F.climb.curve, 'var(--series)', '']].filter((s) => s[1]);
  if (!series.length) return NM;
  const W = 640, H = 280, L = 44, B = 36, T = 14, R = 150, x = (d) => L + ((d - 1) / Math.max(1, F.depth - 1)) * (W - L - R), y = (v) => T + (1 - v) * (H - T - B);
  const grid = [0, 0.25, 0.5, 0.75, 1].map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" class="muted">${v * 100}%</text>`).join('');
  const ticks = Array.from({ length: F.depth }, (_, i) => `<text x="${x(i + 1)}" y="${H - B + 16}" text-anchor="middle" class="muted">${i + 1}</text>`).join('');
  const lines = series.map(([name, c, col, dash]) => `<polyline fill="none" stroke="${col}" stroke-width="${name === 'climb' ? 3 : 2}" ${dash ? `stroke-dasharray="${dash}"` : ''} points="${c.map((v, i) => `${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}"/>${c.map((v, i) => `<circle cx="${x(i + 1).toFixed(1)}" cy="${y(v).toFixed(1)}" r="${name === 'climb' ? 3.5 : 2.5}" fill="${col}"/>`).join('')}`).join('');
  const ends = series.map(([name, c, col], k) => `<text x="${W - R + 8}" y="${T + 16 + k * 18}" fill="${col}" style="fill:${col}">${esc(ARM_NAMES[name].split(' (')[0].split(',')[0])} ${pct(c[c.length - 1])}</text>`).join('');
  return `<svg class="diagram" viewBox="0 0 ${W} ${H}" role="img" aria-label="Share of problems with a right answer after each pass, for each loop">${grid}${ticks}${lines}${ends}<text x="${(L + W - R) / 2}" y="${H - 4}" text-anchor="middle" class="muted">pass</text></svg>`;
}
function renderResults(F) {
  $('curve').innerHTML = curveSVG(F);
  const row = (name, s, at1) => (s ? `<tr><td>${esc(ARM_NAMES[name])}</td><td class="num">${pct(at1 ?? s.first)}</td><td class="num"><b>${pct(name === 'single' ? s.first : s.solved)}</b> <span class="muted">(${name === 'single' ? Math.round(s.first * s.tasks) : s.home} of ${s.tasks})</span></td><td class="num">${name === 'single' ? s.tasks : s.cost.passes}</td><td class="num">${name === 'single' ? '1.00' : s.cost.passesPerTask.toFixed(2)}</td></tr>` : `<tr><td>${esc(ARM_NAMES[name])}</td><td colspan="4">${NM}</td></tr>`);
  $('arms').innerHTML = `<table><thead><tr><th>loop</th><th class="num">right after pass 1</th><th class="num">right after pass ${F.depth}</th><th class="num">model calls</th><th class="num">passes per problem</th></tr></thead><tbody>${row('single', F.retry)}${row('retry', F.retry)}${row('naive', F.naive)}${row('climb-alone', F['climb-alone'])}${row('climb', F.climb)}</tbody></table>`
    + (F.naive ? (() => { const r = SCORE.rot(F.records.naive, F.depth); return `<p class="small">The naive loop, with nobody checking: ${r.gained} problem${r.gained === 1 ? '' : 's'} went from wrong to right, and <span class="${r.lost ? 'fail' : ''}">${r.lost} held a right answer at some pass and ended wrong</span>.</p>`; })() : '');
  const tier = (t) => `<tr><td>${TIER_NAMES[t]}</td><td class="num">${F.retry ? F.retry.tiers[t].tasks : '—'}</td>${['retry', 'naive', 'climb-alone', 'climb'].map((a, k) => (F[a] ? `${k === 0 ? `<td class="num">${pct(F[a].tiers[t].first)}</td>` : ''}<td class="num">${a === 'climb' ? '<b>' : ''}${pct(F[a].tiers[t].solved)}${a === 'climb' ? '</b>' : ''}</td>` : `${k === 0 ? '<td>—</td>' : ''}<td>—</td>`)).join('')}</tr>`;
  $('tiers').innerHTML = F.retry ? `<table><thead><tr><th>tier</th><th class="num">problems</th><th class="num">one try</th><th class="num">retry</th><th class="num">naive</th><th class="num">climb, no memory</th><th class="num">the climb</th></tr></thead><tbody>${SCORE.TIERS.map(tier).join('')}</tbody></table>` : NM;
  // each part's own number
  const m = F.memory, kv = F.kv ? SCORE.reuse(F.kv.pairs) : null, parts = [];
  parts.push(['The lift', F.climb && F.retry ? `${pct(F.retry.first)} right at one try, ${pct(F.climb.solved)} after the climb: ${((F.climb.solved - F.retry.first) * 100).toFixed(1)} points` : NM, 'what checked depth added over a single try']);
  parts.push(['Depth multiplier', F.climb && F.retry && F.retry.first > 0 ? `${(F.climb.solved / F.retry.first).toFixed(2)}×` : F.climb && F.retry ? 'one try got none right, so there is no ratio' : NM, 'right after the climb ÷ right at one try']);
  parts.push(['The memory', m ? `${m.facts} checked steps held. It was asked ${m.asks} times for a step a problem had to do; ${m.wanted} of those steps were in it, and the map found ${m.found} (${m.wanted ? pct(m.recall) : 'nothing to find'})` : NM, 'measured against an exact list of everything stored']);
  parts.push(['What the memory changed', F.climb && F['climb-alone'] ? `home: ${F.climb.home} with the memory, ${F['climb-alone'].home} without; passes of the model: ${F.climb.cost.passes} against ${F['climb-alone'].cost.passes}` : NM, 'the same climb with and without memory between problems']);
  parts.push(['GPU reuse', kv && kv.factor ? `${kv.factor.toFixed(2)}× faster to the first word of a reply on ${kv.pairs} later passes (${kv.kept.toFixed(1)} s continuing the conversation, ${kv.fresh.toFixed(1)} s starting from nothing)` : NM, F.kv ? esc(sourceOf(F.kv)) : 'run step 7 to measure it on this device']);
  parts.push(['Cost of depth', F.climb && F.retry ? `${(F.climb.cost.passes / F.retry.tasks).toFixed(2)} model calls per problem for the climb, against 1; ${F.climb.cost.replyTokens} tokens written against ${recordsOf(F.run, 'retry').reduce((a, r) => a + (r.passes[0].reply || 0), 0)}` : NM, 'the price of the lift, in compute']);
  $('parts').innerHTML = `<table><thead><tr><th>part</th><th>measured</th><th>what it is</th></tr></thead><tbody>${parts.map(([a, b, c]) => `<tr><td><b>${a}</b></td><td>${b}</td><td class="small muted">${c}</td></tr>`).join('')}</tbody></table>${m ? mapSVG(m.chambers, `the memory at the end of the run: ${m.facts} kept steps across its twelve chambers`) : ''}`;
  // the wall
  if (F.climb) {
    const byId = new Map(F.tasks.map((t) => [t.id, t])), out = F.records.climb.filter((r) => !SCORE.homeBy(r, F.depth));
    $('wallList').innerHTML = out.length ? `<table><thead><tr><th>tier</th><th>the problem</th><th class="num">passes</th><th>where it stopped</th></tr></thead><tbody>${out.map((r) => { const t = byId.get(r.id), last = r.passes[r.passes.length - 1]; return `<tr><td>${TIER_NAMES[r.tier] || esc(r.tier)}</td><td class="small">${esc(t.statement)}</td><td class="num">${r.passes.length}</td><td class="small"><span class="fail">not reached</span>${r.stalled ? ': stalled' : ''}. Last pass: ${last.kept.length} line${last.kept.length === 1 ? '' : 's'} true, ${last.dropped.length} false${last.answer === null ? ', no answer given' : `, answered ${esc(last.answer)}`}.${last.left ? ` Still left to do: <code>${esc(last.left)}</code>` : ' Nothing to climb by: no step of it can be checked.'}</td></tr>`; }).join('')}</tbody></table><p class="small">${out.length} of ${F.tasks.length} problems were not reached: ${SCORE.TIERS.map((t) => `${out.filter((r) => r.tier === t).length} ${TIER_NAMES[t]}`).join(', ')}.</p>` : '<p>Every problem was reached.</p>';
  } else $('wallList').innerHTML = NM;
}

function renderHeadline(F, V) {
  const c = F.climb, r = F.retry, n = F.naive;
  bind('hl.cold', r ? `${pct(r.first)} <span class="muted">(${Math.round(r.first * r.tasks)} of ${r.tasks})</span>` : NM);
  bind('hl.climb', c ? `${pct(c.solved)} <span class="muted">(${c.home} of ${c.tasks})</span>` : NM);
  bind('hl.retry', r ? `${pct(r.solved)} <span class="muted">(${r.home} of ${r.tasks})</span>` : NM);
  bind('hl.naive', n ? `${pct(n.solved)} <span class="muted">(${n.home} of ${n.tasks})</span>` : NM);
  bind('hl.wall', c ? `${c.tasks - c.home} of ${c.tasks}` : NM);
  bind('hl.cost', c && r ? `${(c.cost.passes / r.tasks).toFixed(2)}× as many` : NM);
  bind('hl.privacy', F.run && F.run.privacy ? `${F.run.privacy.requests} requests` : NM);
  const failed = V.filter((v) => v.pass === false), passed = V.filter((v) => v.pass === true), pending = V.filter((v) => v.pass === null && /^pending/.test(v.result));
  bind('hl.result', c && r ? `On ${c.tasks} sealed problems, the model alone got ${pct(r.first)} right at one try. Told only "not right" and given ${F.depth} tries, ${pct(r.solved)}. Left to re-read its own work, ${n ? pct(n.solved) : '(not measured)'}. With every step checked, wrong steps split and kept steps remembered, <b>${pct(c.solved)}</b>. ${c.tasks - c.home} problems were never reached, and they are listed under <a href="#wall">the wall</a>.` : 'The sealed run has not been made yet. The build, the problems and the claims are in place, and the numbers will appear here when it is run.');
  bind('hl.note', F.run ? `Source: ${S.view === 'mine' && S.local ? 'your run on this device' : 'the published sealed run'} (${sourceOf(F.run)}). Of the registered claims, ${passed.length ? `<span class="pass">${passed.length} pass</span> (${passed.map((v) => v.id).join(', ')})` : 'none pass'}${failed.length ? ` and <span class="fail">${failed.length} fail</span> (${failed.map((v) => v.id).join(', ')})` : ''}${pending.length ? `; ${pending.length} not measured yet` : ''}. Every verdict is worked out on this page, and the failures stay.` : 'Nothing has been measured on the sealed problems yet.');
  bind('b.what', c && r ? `On the sealed problems it took the share finished from ${pct(r.first)} at one try to ${pct(c.solved)}.` : 'The lift is not measured yet.');
  bind('b.not', c ? `It did not reach ${c.tasks - c.home} of ${c.tasks} problems.` : 'The limits are not measured yet.');
  bind('b.cost', c && r ? `The climb made ${c.cost.passes} model calls on ${c.tasks} problems, ${(c.cost.passes / r.tasks).toFixed(2)} per problem against 1 for a single try.` : 'The cost is not measured yet.');
  bind('b.cost2', c && r ? `${(c.cost.passes / r.tasks).toFixed(2)} model calls per problem against 1, and ${c.cost.seconds.toFixed(0)} s of model time on the sealed set against ${recordsOf(F.run, 'retry').reduce((a, x) => a + (x.passes[0].ms || 0), 0) / 1000 | 0} s.` : 'The cost is not measured yet.');
  bind('b.retry', c && r ? (() => { const p = SCORE.paired(F.records.retry, F.records.climb, F.depth); return `With the same number of tries and only "not right" to go on, the model finished ${r.home} of ${r.tasks}; the climb finished ${c.home}. ${p.bOnly} problems only the climb reached, ${p.aOnly} only the retry loop reached (exact test p = ${p.p.toPrecision(2)}).`; })() : 'The comparison is not measured yet.');
  bind('b.wall', c ? `${c.tasks - c.home} of ${c.tasks} sealed problems were not reached.` : 'The count is not measured yet.');
  bind('b.req', F.run && F.run.privacy ? `While the sealed run was made, the browser counted <b>${F.run.privacy.requests}</b> network requests.` : 'The network-request count is not measured yet.');
  bind('b.board', c && r ? `On ${c.tasks} sealed problems, checked depth took a small model from ${Math.round(r.first * r.tasks)} finished to ${c.home}, at ${(c.cost.passes / r.tasks).toFixed(2)} times the model calls, and it says plainly which ${c.tasks - c.home} it could not do.` : 'The result is not measured yet.');
  bind('paper.sources', F.run ? `The numbers on this page: ${sourceOf(F.run)}; ${F.tasks.length} problems made by src/tasks.mjs from the seed in data/settings.json; ${F.depth} passes at most.` : 'No run is published yet.');
}

const NAMES = () => CLAIMS.NAMES;
const badge = (v) => (v.pass === true ? '<span class="pass">PASS</span>' : v.pass === false ? '<span class="fail">FAIL</span>' : /^pending/.test(v.result) ? '<span class="pend">NOT MEASURED YET</span>' : '<span class="muted">reported</span>');
function renderClaims(VP, VM) {
  const mine = Object.fromEntries((VM || []).map((v) => [v.id, v]));
  $('claimsTable').innerHTML = `<table><thead><tr><th>claim</th><th>bar</th><th>result on the published sealed run</th><th>verdict</th><th>on this device</th></tr></thead><tbody>${VP.map((v) => `<tr><td><b>${v.id}</b> ${esc(NAMES()[v.id] || '')}</td><td class="small">${esc(CLAIMS.BARS[v.id] || '')}</td><td class="small">${esc(v.result.replace(/^pending: /, 'Not measured yet: '))}</td><td>${badge(v)}</td><td class="small">${mine[v.id] && !/^pending/.test(mine[v.id].result) ? `${badge(mine[v.id])}<br>${esc(mine[v.id].result)}` : '<span class="badge">NOT RE-RUN ON THIS DEVICE YET</span>'}</td></tr>`).join('')}</tbody></table>`;
}

function renderTrace(F) {
  if (!F.climb) { $('trace').innerHTML = NM; return null; }
  const byId = new Map(F.tasks.map((t) => [t.id, t]));
  const pick = F.records.climb.find((r) => r.tier === 'climb' && r.homeAt !== null && r.homeAt >= 3) || F.records.climb.find((r) => r.homeAt !== null && r.homeAt >= 2) || F.records.climb[0];
  $('trace').innerHTML = `<div class="card">${storyHTML(byId.get(pick.id), pick, { label: `${TIER_NAMES[pick.tier]} tier · ${pick.id} · from the run: ${sourceOf(F.run)}` })}</div>`;
  return pick;
}
// the glass before the visitor runs anything: a recorded climb, labelled as recorded
function renderGlassRecorded() {
  const run = S.data.runs.sealed || S.data.runs.dev, set = S.data.runs.sealed ? 'sealed' : 'dev';
  if (!run || !recordsOf(run, 'climb').length) { $('glass').innerHTML = `<p>${NM}: no climb has been recorded yet. Press the button to run one here.</p>`; return; }
  const tasks = new Map(tasksOf(set).map((t) => [t.id, t])), recs = recordsOf(run, 'climb');
  const pick = recs.find((r) => r.tier === 'climb' && r.homeAt !== null && r.homeAt >= 2) || recs.find((r) => r.homeAt !== null) || recs[0];
  $('glass').innerHTML = storyHTML(tasks.get(pick.id), pick, { label: `Recorded, not live: ${sourceOf(run)} (${set} set, ${pick.id}).` });
}

function renderMoney(F) {
  const prices = S.data.prices, c = F.climb, r = F.retry;
  if (!c || !r || !prices || !prices.models) { $('money').innerHTML = NM; return; }
  const per = (s) => ({ inTok: s.cost.promptTokens / s.tasks, outTok: s.cost.replyTokens / s.tasks });
  const one = { inTok: recordsOf(F.run, 'retry').reduce((a, x) => a + (x.passes[0].prompt || 0), 0) / r.tasks, outTok: recordsOf(F.run, 'retry').reduce((a, x) => a + (x.passes[0].reply || 0), 0) / r.tasks }, cl = per(c);
  const usd = (t, m) => (t.inTok * m.in + t.outTok * m.out) / 1e6;
  $('money').innerHTML = `<table><thead><tr><th>where the tokens are bought</th><th class="num">one try, per 1,000 problems</th><th class="num">the climb, per 1,000 problems</th><th>price source</th></tr></thead><tbody><tr><td><b>Your own hardware (this page)</b></td><td class="num">$0</td><td class="num">$0</td><td class="small muted">no meter: electricity only</td></tr>${Object.entries(prices.models).map(([name, m]) => `<tr><td>${esc(name)} <span class="small muted">($${m.in} in, $${m.out} out per million tokens)</span></td><td class="num">$${(usd(one, m) * 1000).toFixed(2)}</td><td class="num">$${(usd(cl, m) * 1000).toFixed(2)}</td><td class="small"><a href="${esc(prices.source)}">${esc(prices.source.replace('https://', ''))}</a>, read ${esc(prices.read)}</td></tr>`).join('')}</tbody></table><p class="small muted">Tokens are this page's own measured counts on the sealed set: ${one.inTok.toFixed(0)} read and ${one.outTok.toFixed(0)} written per problem at one try; ${cl.inTok.toFixed(0)} read and ${cl.outTok.toFixed(0)} written per problem for the climb (later passes read only the new turn, because the GPU reuses the earlier ones; a cloud service that does not keep the conversation reads all of it again at every pass, and would charge for more than this). A cloud model would be a different model and would get more right at one try; this table prices the loop, not a like-for-like result.</p>`;
}

function renderBlueprint(F) {
  const G = S.data.gates && S.data.gates.files ? S.data.gates.files : {};
  const cell = (files) => { const got = files.map((f) => G[f]); if (got.some((g) => !g)) return '<span class="pend">built; its mutation gate is not recorded yet</span>'; const k = got.reduce((a, g) => a + g.killed, 0), n = got.reduce((a, g) => a + g.total, 0), ig = got.reduce((a, g) => a + (g.ignored || 0), 0); return got.every((g) => g.clean === true) ? `<span class="pass">built, gated ${k}/${n}${ig ? ` (${ig} equivalent, with the reason written down)` : ''}</span>` : `<span class="fail">built, gate not clean: ${k}/${n}</span>`; };
  bind('bp.exact', cell(['src/exact.mjs'])); bind('bp.checker', cell(['src/checker.mjs'])); bind('bp.plan', cell(['src/plan.mjs'])); bind('bp.left', cell(['src/left.mjs'])); bind('bp.memory', cell(['src/keep.mjs'])); bind('bp.loop', cell(['src/loop.mjs'])); bind('bp.tasks', cell(['src/tasks.mjs'])); bind('bp.score', cell(['src/score.mjs', 'src/claims.mjs']));
  const kv = F.kv ? SCORE.reuse(F.kv.pairs) : null;
  bind('bp.reuse', kv && kv.factor ? `<span class="${kv.factor > 1 ? 'pass' : 'fail'}">measured: ${kv.factor.toFixed(2)}× faster to start a reply</span>` : '<span class="pend">not measured yet</span>');
}
function renderWalk() {
  const w = S.data.walk;
  $('walk').innerHTML = w ? `<h3>A simulated buyer walk</h3><p class="small muted">${esc(w.note)}</p>${w.personas.map((p) => `<details><summary>${esc(p.who)}: ${esc(p.verdict)}</summary><ul>${p.gaps.map((g) => `<li>${esc(g.gap)} <span class="muted">→ ${esc(g.fix)}</span></li>`).join('')}</ul></details>`).join('')}` : '';
}
function renderViewBar(F) {
  const L = S.local;
  if (S.view === 'mine' && L) $('viewBar').innerHTML = `<b>Showing your run on this device.</b> ${L.set} set, ${ARMS.filter((a) => covers(L, a, F.tasks)).length} of ${ARMS.length} loops complete. ${esc(sourceOf(L))}. <button class="ghost" type="button" data-act="published">Show the published run</button> <button class="ghost" type="button" data-act="discard">Discard my run</button>`;
  else $('viewBar').innerHTML = `Showing the published sealed run: ${esc(sourceOf(S.data.runs.sealed))}.${L ? ' <button class="ghost" type="button" data-act="mine">Show my run</button>' : ' Run step 5 of Start here (the measurement) to see your own device\'s numbers on this page.'}`;
}
async function renderAll() {
  const F = view(), FP = facts(S.data.runs.sealed, 'sealed'), VP = CLAIMS.evaluate(FP), VM = S.local && S.local.set === 'sealed' ? CLAIMS.evaluate(facts(S.local, 'sealed')) : null;
  renderViewBar(F); renderHeadline(F, S.view === 'mine' && VM ? VM : VP); renderResults(F); renderClaims(VP, VM); renderTrace(F); renderMoney(F); renderBlueprint(F); renderWalk();
}

// ── the model in the tab ──
async function device() {
  if (typeof navigator === 'undefined' || !navigator.gpu) { $('device').innerHTML = '<span class="fail">This browser has no WebGPU, so the model cannot run here.</span> Everything published on this page still reads, and step 6 still works. To run it, use a current Chrome or Edge on a computer with a graphics chip.'; return; }
  try {
    const a = await navigator.gpu.requestAdapter();
    if (!a) throw new Error('no adapter');
    const info = a.info || (a.requestAdapterInfo ? await a.requestAdapterInfo() : {});
    S.gpu = [info.vendor, info.architecture].filter(Boolean).join(' ') || 'WebGPU';
    S.canRun = true;
    $('device').innerHTML = `<span class="pass">WebGPU is available</span> (${esc(S.gpu)}). The model can run here.`;
  } catch { $('device').innerHTML = '<span class="fail">WebGPU did not start on this device.</span> The published numbers still read, and step 6 still works.'; }
}
async function load() {
  if (S.engine) return true;
  if (!S.canRun) { $('loadOut').innerHTML = '<span class="fail">No WebGPU on this device.</span>'; return false; }
  const id = $('model').value || Object.keys(MODELS)[0];
  $('load').disabled = true;
  try {
    const webllm = await import(WEBLLM);
    S.engine = await webllm.CreateMLCEngine(id, { initProgressCallback: (p) => { $('loadOut').textContent = p.text; $('loadBar').style.width = `${Math.round((p.progress || 0) * 100)}%`; } });
    S.model = id;
    $('loadOut').innerHTML = `<span class="pass">Loaded:</span> ${esc(MODELS[id] || id)}. It is running on this device.`;
    $('loadBar').style.width = '100%';
    return true;
  } catch (e) { $('loadOut').innerHTML = `<span class="fail">The model did not load:</span> ${esc(e && e.message)}`; $('load').disabled = false; return false; }
}
async function needModel(out) {
  if (S.engine) return true;
  if (out) out.innerHTML = 'Loading the model first: its progress is shown in step 2.';
  const ok = await load();
  if (out) out.innerHTML = ok ? '' : '<span class="fail">The model is not loaded, so this cannot run here.</span>';
  return ok;
}
// ask(messages, maxTokens, opts) → one reply from the model, streamed; opts.fresh starts from nothing (no reuse)
async function ask(messages, maxTokens, opts) {
  if (opts && opts.fresh) await S.engine.resetChat();
  const t0 = performance.now();
  let text = '', first = null, usage = null, cut = false;
  const stream = await S.engine.chat.completions.create({ messages, temperature: 0, max_tokens: maxTokens, stream: true, stream_options: { include_usage: true } });
  for await (const chunk of stream) {
    const d = chunk.choices && chunk.choices[0] && chunk.choices[0].delta ? chunk.choices[0].delta.content || '' : '';
    if (d) { if (first === null) first = performance.now() - t0; text += d; if (S.onToken) S.onToken(text); }
    if (chunk.choices && chunk.choices[0] && chunk.choices[0].finish_reason === 'length') cut = true;
    if (chunk.usage) usage = chunk.usage;
  }
  return { text, ms: performance.now() - t0, ttft: first === null ? null : first / 1000, prompt: usage ? usage.prompt_tokens ?? null : null, reply: usage ? usage.completion_tokens ?? null : null, cut };
}
const setBusy = (b) => { S.busy = b; for (const id of ['watch', 'ownGo', 'run', 'kv']) $(id).disabled = b; };

// ── the live glass: one problem climbed in front of the visitor ──
async function climbLive(task, target, out) {
  if (S.busy || !(await needModel(out))) return null;
  setBusy(true);
  const depth = S.data.settings.depth, shown = { id: task.id, arm: 'climb-alone', tier: task.tier, passes: [], homeAt: null, stalled: false };
  let n = 0;
  const draw = (liveText) => { target.innerHTML = `<p class="small"><b>Live on this device.</b> Pass ${Math.max(1, n)} of ${depth} · ${shown.passes.reduce((a, p) => a + p.used.length, 0)} steps kept · ${shown.passes.reduce((a, p) => a + p.dropped.length, 0)} dropped · ${n} model call${n === 1 ? '' : 's'}</p>${shown.passes.length ? storyHTML(task, shown, { open: true }) : `<p><b>${esc(task.statement)}</b></p>`}${liveText !== null ? `<div class="stage"><b>Pass ${n} of ${depth}</b> <span class="small muted">· the model is writing</span><pre class="live">${esc(liveText)}</pre></div>` : ''}`; };
  const call = async (messages, maxTokens) => {
    n++; S.onToken = (t) => draw(t); draw('');
    const c = await ask(messages, maxTokens);
    S.onToken = null;
    return { ...c, cached: false };
  };
  let rec = null;
  try { rec = await LOOP.climb(task, call, { depth, maxTokens: S.data.settings.maxTokens, onPass: (pass) => { shown.passes.push(pass); draw(null); } }); target.innerHTML = `<p class="small"><b>Ran live on this device</b> (${esc(S.gpu || 'WebGPU')}): ${rec.passes.length} pass${rec.passes.length === 1 ? '' : 'es'}, ${n} model call${n === 1 ? '' : 's'}.</p>${storyHTML(task, rec, {})}`; }
  catch (e) { target.innerHTML += `<p class="fail">It stopped: ${esc(e && e.message)}</p>`; }
  setBusy(false);
  return rec;
}
// a sheet of problems climbed one after another with the memory between them: the memory fills as steps are checked,
// and a later problem is handed the steps it shares with an earlier one
async function sheetLive(tasks, target, out) {
  if (S.busy || !(await needModel(out))) return null;
  setBusy(true);
  const depth = S.data.settings.depth, done = [], now = [];
  let n = 0, stats = null;
  const row = (r, i) => `<details><summary>${r.homeAt ? `<span class="pass">✓ right at pass ${r.homeAt}</span>` : '<span class="fail">✗ not reached</span>'}${r.passes.some((p) => p.served.length) ? ' <span class="small">· handed steps from the memory</span>' : ''} · <span class="small">${esc(tasks[i].statement)}</span></summary>${storyHTML(tasks[i], r, {})}</details>`;
  const draw = (liveText) => {
    const cur = tasks[done.length];
    target.innerHTML = `<p class="small"><b>Live on this device.</b> Problem ${Math.min(done.length + 1, tasks.length)} of ${tasks.length} · ${n} model call${n === 1 ? '' : 's'} · ${stats ? stats.facts : 0} checked steps in the memory${stats && stats.wanted ? ` · it was asked for ${stats.wanted} it held and found ${stats.found}` : ''}</p>${done.map(row).join('')}`
      + (cur ? (now.length ? storyHTML(cur, { arm: 'climb', passes: now, homeAt: null, stalled: false }, { open: true }) : `<p><b>${esc(cur.statement)}</b></p>`) : '')
      + (liveText !== null ? `<div class="stage"><b>Pass ${now.length + 1} of ${depth}</b> <span class="small muted">· the model is writing</span><pre class="live">${esc(liveText)}</pre></div>` : '')
      + mapSVG(stats ? stats.chambers : null, 'the memory, filling as steps are checked');
  };
  const call = async (messages, maxTokens) => { n++; S.onToken = (t) => draw(t); draw(''); const c = await ask(messages, maxTokens); S.onToken = null; return { ...c, cached: false }; };
  let got = null;
  try {
    got = await LOOP.run(tasks, 'climb', call, { depth, maxTokens: S.data.settings.maxTokens, mem: S.data.settings.mem, onPass: (p) => { now.push(p); draw(null); }, onDone: (rec, M) => { done.push(rec); now.length = 0; stats = KEEP.stats(M); draw(null); } });
    target.innerHTML = `<p class="small"><b>Ran live on this device</b> (${esc(S.gpu || 'WebGPU')}): ${done.filter((r) => r.homeAt).length} of ${tasks.length} problems home, ${n} model calls, ${got.memory.facts} checked steps in the memory.</p>${done.map(row).join('')}${mapSVG(got.memory.chambers, `the memory after the sheet: ${got.memory.facts} checked steps across its twelve chambers`)}`;
  } catch (e) { target.innerHTML += `<p class="fail">It stopped: ${esc(e && e.message)}</p>`; }
  setBusy(false);
  return got;
}
async function watch() {
  const tasks = tasksOf('dev'), v = $('which').value;
  if (v === 'sheet') { await sheetLive(tasks.filter((x) => x.sheet === 0 && x.tier === 'climb'), $('glass'), $('watchOut')); return; }
  const t = tasks.find((x) => x.id === v) || tasks.find((x) => x.tier === 'climb');
  if (t) await climbLive(t, $('glass'), $('watchOut'));
}
async function ownGo() {
  const t = TASKS.own($('ownIn').value);
  if (!t) { $('ownOut').innerHTML = '<span class="fail">That is not a calculation the checker can read.</span> Use numbers, + - × ÷ and brackets, for example (37 × 48 + 912) × 6.'; return; }
  await climbLive(t, $('ownOut'), $('ownOut'));
}

// ── the measurement: every problem through all four loops, saved as it goes ──
const sealCache = {};
async function sealHash() {
  if (sealCache.v === undefined) { try { const r = await fetch('SEAL.json'); sealCache.v = r.ok ? SHA.sha256((await r.text()).split('\r\n').join('\n')) : ''; } catch { sealCache.v = ''; } }
  return sealCache.v || null;
}
const runKey = (set) => `climb-run-${set}`;
// runSet({ set, ui }) → the run record; resumes a saved one
async function runSet({ set = 'sample', ui = true } = {}) {
  const tasks = tasksOf(set), key = runKey(set), depth = S.data.settings.depth, opts = { depth, maxTokens: S.data.settings.maxTokens, mem: S.data.settings.mem };
  let L = store.get(key);
  if (!L || L.set !== set || L.model !== S.model || L.complete) L = { v: 'the-climb-run/1', venue: 'tab (WebLLM 0.2.79, WebGPU)', model: S.model, gpu: S.gpu, ua: navigator.userAgent, set, sealSha256: await sealHash(), at: new Date().toISOString(), seconds: 0, segments: 0, privacy: { requests: 0 }, arms: {}, complete: false };
  L.segments++;
  if (ui) { S.local = L; S.view = 'mine'; $('save').disabled = true; }
  const seen = [], obs = typeof PerformanceObserver === 'function' ? new PerformanceObserver((l) => { for (const e of l.getEntries()) seen.push(e.name); }) : null;
  try { if (obs) obs.observe({ type: 'resource', buffered: false }); } catch { /* no observer */ }
  const before = performance.getEntriesByType('resource').length, baseReq = L.privacy.requests || 0, t0 = Date.now(), base = L.seconds;
  const call = LOOP.caller(ask), total = tasks.length * ARMS.length;
  const count = () => { L.privacy = { requests: baseReq + Math.max(performance.getEntriesByType('resource').length - before, seen.length), observed: [...new Set([...(L.privacy.observed || []), ...seen])].slice(0, 20) }; };
  for (const arm of ARMS) {
    if (covers(L, arm, tasks)) continue;
    const done = recordsOf(L, arm).slice();
    L.arms[arm] = { records: done, memory: null };
    const out = await LOOP.run(tasks, arm, call, { ...opts, done, onDone: async (rec, M) => {
      L.arms[arm].records.push(rec);
      if (M) L.arms[arm].memory = KEEP.stats(M);
      L.seconds = base + Math.round((Date.now() - t0) / 1000); count(); store.set(key, L);
      const n = ARMS.reduce((a, x) => a + recordsOf(L, x).length, 0);
      if (ui) { $('runBar').style.width = `${Math.round((n / total) * 100)}%`; $('runOut').textContent = `${n} of ${total} (${ARM_NAMES[arm].split(' (')[0]}: ${recordsOf(L, arm).length} of ${tasks.length}) · ${L.seconds} s`; if (L.arms[arm].records.length % 8 === 0) await renderAll(); }
    } });
    L.arms[arm] = { records: out.records, memory: out.memory };
    store.set(key, L);
  }
  try { if (obs) obs.disconnect(); } catch { /* none */ }
  count();
  L.complete = ARMS.every((a) => covers(L, a, tasks));
  store.set(key, L);
  return L;
}
async function runUI() {
  if (S.busy || !(await needModel($('runOut')))) return;
  setBusy(true);
  const L = await runSet({ set: $('runWhich').value || 'sample', ui: true });
  window.__climbRun = L;
  await renderAll();
  $('runOut').innerHTML = `<b>Done</b> in ${L.segments} sitting${L.segments === 1 ? '' : 's'}, ${L.seconds} s. Network requests while it ran: ${L.privacy.requests}. The page now shows this device's numbers. Scroll up, or press Save.`;
  setBusy(false); $('save').disabled = false;
}
function save() {
  if (!S.local) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(S.local)], { type: 'application/json' }));
  a.download = `the-climb-${S.local.set}-${String(S.local.at).slice(0, 10)}.json`;
  a.click();
}
// re-judge: every published run decided again from its recorded replies, with no model
const decided = (rs) => JSON.stringify(rs.map((r) => [r.id, r.homeAt, r.stalled, r.passes.map((p) => [p.kept, p.dropped, p.answer, p.home, p.served, p.used ?? null, p.left ?? null, p.cut === true])]));
const same = (a, b) => decided(a) === decided(b);
async function rejudge() {
  const lines = [], opts = { depth: S.data.settings.depth, maxTokens: S.data.settings.maxTokens, mem: S.data.settings.mem };
  for (const [name, set] of [['the published sealed run', 'sealed'], ['the published dev run', 'dev']]) {
    const run = S.data.runs[set];
    if (!run) { lines.push(`${name}: ${NM}`); continue; }
    const tasks = tasksOf(set);
    for (const arm of ARMS) {
      const recs = recordsOf(run, arm);
      if (!recs.length) continue;
      const again = await LOOP.replay(tasks, arm, recs, opts), n = recs.length, ok = again.records.filter((r, i) => same([r], [recs[i]])).length;
      lines.push(`${name}, ${esc(ARM_NAMES[arm].split(' (')[0])}: ${ok} of ${n} problems decided identically ${ok === n ? '<span class="pass">✓</span>' : '<span class="fail">✗</span>'}`);
    }
  }
  $('rejudgeOut').innerHTML = `${lines.join('<br>')}<br><span class="muted">Each problem is decided again from the model's recorded replies by the code on this page: the checker, the planner, the memory and the loop run for real.</span>`;
}
// what the GPU reuses: the later passes of recorded climbs, timed continuing the conversation and from nothing
async function kvMeasure() {
  if (S.busy || !(await needModel($('kvOut')))) return;
  setBusy(true);
  const run = S.local && recordsOf(S.local, 'climb-alone').length ? S.local : S.data.runs.sealed || S.data.runs.dev, set = run === S.local ? S.local.set : S.data.runs.sealed ? 'sealed' : 'dev';
  const tasks = new Map(tasksOf(set).map((t) => [t.id, t])), recs = recordsOf(run, 'climb-alone').filter((r) => r.passes.length >= 2).slice(0, S.data.settings.kvProblems || 8);
  const out = { v: 'the-climb-reuse/1', venue: 'tab (WebLLM 0.2.79, WebGPU)', model: S.model, gpu: S.gpu, at: new Date().toISOString(), set, pairs: [] };
  for (const [i, rec] of recs.entries()) {
    const task = tasks.get(rec.id), st = story(task, rec), messages = LOOP.opening(task.statement, []);
    for (let d = 1; d < st.length && d < 4; d++) {
      // make the earlier turns for real, so the browser holds them; then time the next turn's first word both ways
      const made = await ask(messages, S.data.settings.maxTokens, { fresh: d === 1 });
      messages.push({ role: 'assistant', content: made.text }, { role: 'user', content: st[d].before });
      const kept = await ask(messages, 1), fresh = await ask(messages, 1, { fresh: true });
      out.pairs.push({ id: rec.id, pass: d + 1, kept: kept.ttft, fresh: fresh.ttft, keptPrompt: kept.prompt, freshPrompt: fresh.prompt, same: made.text === rec.passes[d - 1].said });
      $('kvOut').textContent = `${out.pairs.length} later passes timed (${i + 1} of ${recs.length} problems)…`;
      if (made.text !== rec.passes[d - 1].said) break;
      await ask(messages.slice(0, -2), S.data.settings.maxTokens, { fresh: true });
    }
  }
  S.kvLocal = out; window.__climbKv = out;
  const r = SCORE.reuse(out.pairs);
  $('kvOut').innerHTML = r.factor ? `<b>On this device:</b> ${r.factor.toFixed(2)}× faster to the first word of a reply when the conversation continues (${r.kept.toFixed(2)} s against ${r.fresh.toFixed(2)} s over ${r.pairs} later passes).` : 'No later pass could be timed here.';
  setBusy(false);
}

// ── start ──
const ready = (async function start() {
  const [settings, published, gates, prices] = await Promise.all(['data/settings.json', 'data/published.json', 'data/gates.json', 'data/prices.json'].map(getJSON));
  const P = published || {}, runs = {};
  for (const k of ['sealed', 'dev', 'kv']) runs[k] = P[k] ? await getJSON(P[k]) : null;
  S.data = { settings: settings || { depth: LOOP.SETTINGS.depth, maxTokens: LOOP.SETTINGS.maxTokens, mem: {}, sets: {} }, runs, gates, prices, walk: P.walk ? await getJSON(P.walk) : null };
  $('model').innerHTML = Object.entries(MODELS).map(([id, name]) => `<option value="${id}">${esc(name)}</option>`).join('');
  const dev = tasksOf('dev');
  $('which').innerHTML = dev.filter((t) => t.tier === 'climb').slice(0, 8).map((t) => `<option value="${esc(t.id)}">${esc(t.statement.slice(0, 76))}${t.statement.length > 76 ? '…' : ''}</option>`).join('') + '<option value="sheet">A sheet of four problems, one after another, with the memory between them</option>' + dev.filter((t) => t.tier === 'wall').slice(0, 4).map((t) => `<option value="${esc(t.id)}">A wall: ${esc(t.statement.slice(0, 66))}${t.statement.length > 66 ? '…' : ''}</option>`).join('');
  const saved = store.get(runKey('sealed')) || store.get(runKey('dev')) || store.get(runKey('sample'));
  S.local = saved && saved.arms ? saved : null;
  renderGlassRecorded();
  await renderAll();
  $('load').addEventListener('click', load);
  $('watch').addEventListener('click', watch);
  $('ownGo').addEventListener('click', ownGo);
  $('run').addEventListener('click', runUI);
  $('save').addEventListener('click', save);
  $('rejudge').addEventListener('click', rejudge);
  $('kv').addEventListener('click', kvMeasure);
  $('viewBar').addEventListener('click', (e) => {
    const act = e.target && e.target.dataset ? e.target.dataset.act : null;
    if (act === 'mine') S.view = 'mine'; else if (act === 'published') S.view = 'published'; else if (act === 'discard') { store.del(runKey(S.local.set)); S.local = null; S.view = 'published'; } else return;
    renderAll();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !S.busy && !(e.target && /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(e.target.tagName))) watch(); });
  device();
  if (typeof navigator !== 'undefined' && navigator.serviceWorker && typeof location !== 'undefined' && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
window.__climb = { ready, S, runSet, needModel, kvMeasure, rejudge, renderAll, facts, tasksOf, story, storyHTML };
