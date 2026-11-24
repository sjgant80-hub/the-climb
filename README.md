# The Climb

**Live: https://sjgant80-hub.github.io/the-climb/** · open it, press Enter, and watch a small AI model get a
calculation wrong on your own graphics chip, then check its way to the right answer.

A small model fails first. A checker that is not the model reads every line it writes. A true step is crossed off the
calculation. A false step is dropped and split into smaller steps. What is left to do goes back to the model, so every
pass starts from a smaller problem than the last, until the checker says the answer is right or the climb stops.
Nothing leaves the device.

The page is the experiment. It runs the same sealed problems four ways (one try, retry, naive self-review, the climb),
and every number on it comes from a recorded run that the page, and CI, decide again from the model's recorded replies.
The problems the climb did not reach are listed in red beside the ones it did.

- [CLAIMS.md](CLAIMS.md) — the eight claims and their bars, committed before the model saw a sealed problem.
- [SEAL.md](SEAL.md) — what the dev problems showed, what was changed because of them, and the seal that froze every
  file that can change a result, by hash (`SEAL.json`).
- `data/runs/` — the published runs, with every model reply and every ruling.

## The four beats of a pass

| beat | what happens | where |
|---|---|---|
| Try | the model writes working, one step per line, and an answer | WebLLM in the tab |
| Check | code works each line out exactly; a true step is crossed off the calculation, a false one is replaced by smaller steps, and what is left goes back | `src/checker.mjs`, `src/left.mjs`, `src/plan.mjs`, `src/exact.mjs` |
| Remember | true steps go into a twelve-chamber memory, placed by their digits; a step a later problem has to do is crossed off from it before the model is asked | `src/keep.mjs`, `vendor/memory.mjs` |
| Reuse | a problem's passes are one growing conversation, so the GPU keeps its work for the earlier turns | `src/loop.mjs`, measured on the page |

## What is in it

| path | what |
|---|---|
| `src/exact.mjs` | exact arithmetic on whole-number fractions; reads a line of working (gated) |
| `src/checker.mjs` | rules on each line and on the answer; three kinds of finish line (gated) |
| `src/plan.mjs` | splits a step by place value, and a carry into a step of its own; never contains a result (gated) |
| `src/left.mjs` | what is left to do: the calculation, crossed off step by step, its value never changing (gated) |
| `src/keep.mjs` | the memory around the vendored kernel, and the exact list that measures what it finds (gated) |
| `src/loop.mjs` | the climb, and the retry and naive loops it is measured against; replay with no model (gated) |
| `src/tasks.mjs` | the problems, made by code in sheets of eight with their finish lines (gated) |
| `src/score.mjs`, `src/claims.mjs` | every number and every verdict (gated) |
| `vendor/` | the estate's memory kernel and the exact McNemar test (`vendor/PROVENANCE.json`) |
| `page/`, `index.html` | the page: every kernel inlined, every published number baked in by running the page script at build time (`scripts/make-page.mjs`, `test/page.test.mjs`) |
| `scripts/publish.mjs` | publishes a run saved from the page only if it is complete, under the seal, and decides again identically; `--check` repeats that in CI |
| `scripts/seal.mjs`, `scripts/gates.mjs` | the seal; the mutation gate and its record (`data/gates.json`) |
| `genome/`, `seed.json` | the estate's four hooks: judge, lane, health, tombstone |

## Run it

```bash
node --test test/*.test.mjs
```

```bash
node scripts/make-page.mjs
```

```bash
node scripts/publish.mjs --check
```

The model work happens in the browser: open the live page (or `index.html` from any static server), load the model,
and use **Run the measurement yourself**. It needs a browser with WebGPU.

## Honest edges

- It is arithmetic. That was chosen because the finish line cannot be argued with. Nothing here measures the pattern on
  another kind of job.
- The checker is code and it knows how to work out the right value. It never gives the model a value the model did not
  write: it says which lines are right and wrong, splits a wrong step, and shows what is left to do. It does hold the
  calculation the problem asks for, which is more help than "not right"; the retry loop shows what the model does
  without it. Every message the checker sent is in the recorded runs.
- Depth costs model calls. The page shows how many.
- The model's files come from the public WebLLM model library; this page does not pin their hashes.

Built by Kar. MIT licence, holder Simon Gant. Supplied by [AI Native Solutions](https://www.ai-nativesolutions.com);
support is agreed per deployment, in each deployment's agreement.
