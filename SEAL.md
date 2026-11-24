# The Climb: the seal

Everything that can change a result was frozen by hash in `SEAL.json` before the model was shown one sealed problem:
every kernel in `src/`, the vendored files in `vendor/`, `data/settings.json` (which holds the sealed seed, so it fixes
the 96 sealed problems, the depth and the reply length), and `CLAIMS.md`. `test/seal.test.mjs` fails if one sealed
byte changes, and a sealed run counts only when it records the SHA-256 of `SEAL.json` itself.

This file is the record of what the build was tuned on before that, and what the tuning changed. All of it was done on
the dev seed (20261101: 5 sheets, 40 problems). The sealed seed (20261124) was not used to make, read or run a problem
until after the seal was committed and pushed.

## What the dev problems showed, in the order it happened

1. **A plain ruling was not enough.** The first build told the model which lines were right and wrong and how to split
   a wrong step. It confirmed lines that were true but had nothing to do with the problem ("0.5 × 13 = 6.5" in a
   problem that never asks for it), and the model wandered off after them. One problem ended with the model halving a
   number nine times in a row, each line true, each line marked right.
2. **So the checker now holds the calculation** (`src/left.mjs`). A true line that is a step of the problem is crossed
   off with the value the model wrote. A true line that is not a step is recorded as true and not called right. A
   false step is replaced by smaller steps. What is left to do is what goes back to the model. This is more help than
   the first build gave, and the retry loop, which gets none of it, is the measure of how much.
3. **Five of the first eight climb-tier families were right at the first try**, so they were not a climb. The tier was
   re-made with harder families (three products of two-digit numbers, a three-digit by two-digit product, a sum
   in brackets) before any four-loop run. The easy and wall tiers were left as they were.
4. **The model's weak step is adding with a carry**, not multiplying. It also undid a split: given
   `8000 + 400 + 200` it wrote `8000 + 400 = 8400` and then failed `8400 + 200` again. A carry is now split into a
   step of its own that stands in a bracket (`8400 + 200` becomes `8000 + (4 + 2) × 100`), and a bracket the checker
   wrote has to be done before anything outside it.
5. **Working rewritten line under line** with no equals sign was not being read, so a problem could go six passes
   with nothing checked. Two such lines are now read as a step when they come to the same number, and only then: lines
   that disagree claim nothing and nothing is dropped.
6. **A reply cut off at the length limit** could end in half a number and be ruled wrong for it. The last line of a
   cut reply is now left unruled.
7. **Six passes left three climb-tier problems one or two steps short.** The depth was raised to 8 for all four loops.
   A decimal times a whole number (`28.5 × 16`) had no smaller step and stalled one problem; it now splits into its
   whole part and its decimal part.

## The dev run under the sealed build

One run of all four loops over the 40 dev problems, made through the page itself: Llama-3.2-1B-Instruct-q4f16_1-MLC,
intel gen-12lp, 3366 s in 1 sitting, 0 network requests while it worked. It is published as `data/runs/dev.json`.
The run was made a few edits before the seal: those edits took out conditions that the mutation gate had shown did
nothing. The sealed code decides every one of the run's 160 problem-loops again from the recorded replies and gets
the same decision each time, and CI repeats that on every push.

| loop | right after pass 1 | right after pass 8 | easy | climb | wall | passes |
|---|---|---|---|---|---|---|
| one try | 37.5% | | 10 of 10 | 5 of 20 | 0 of 10 | 40 |
| retry (told only "not right") | 37.5% | 45.0% | 10 of 10 | 8 of 20 | 0 of 10 | 111 |
| naive (re-reads its own work) | 37.5% | 25.0% | 4 of 10 | 6 of 20 | 0 of 10 | 166 |
| the climb, no memory | 37.5% | 72.5% | 10 of 10 | 19 of 20 | 0 of 10 | 118 |
| the climb | 42.5% | 70.0% | 10 of 10 | 18 of 20 | 0 of 10 | 114 |

- The naive loop ended below one try: 9 problems held a right answer at some pass and ended wrong, and 2 went from
  wrong to right.
- The memory held 128 checked steps by the end. It was asked 225 times for a step a problem had to do; 14 of those
  were in it, and the map found 14. With it the climb got 28 problems home, without it 29: on dev the memory did not
  earn its place, and claim C4 is registered knowing that.
- No wall problem was reached by any loop.
- These are the problems the build was tuned on. They say the build runs and what to expect; they are not the
  result.

## What was not tuned

- The model, its 4-bit weights, and greedy decoding were fixed from the start.
- The retry and naive loops keep the one-line prompts they were first written with (`src/loop.mjs`). Like the climb,
  they got the cut-reply rule and the depth of 8, and nothing else.
- The worked examples in the prompt are invented and come from no problem set. They are the same for all four loops.
