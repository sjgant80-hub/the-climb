# The Climb: the claims, registered before the sealed run

This file was committed, with the seal ([SEAL.md](SEAL.md), `SEAL.json`), before the model was shown one sealed
problem. The verdicts are worked out by `src/claims.mjs` from the recorded run, and the bars in that file are the bars
below, word for word (`test/claims.test.mjs` checks that on every push). A claim that fails stays on the page, failed,
in red. No bar is moved after the run.

## The question

Does going round again help a small model, when something that is not the model checks every step? And by how much,
against the same model given one try, given the same number of tries with no step checked, and left to re-read its own
work?

## What is run

One model: Llama 3.2 1B Instruct at 4 bits (`Llama-3.2-1B-Instruct-q4f16_1-MLC`), in a browser tab through WebLLM
0.2.79 on WebGPU, always choosing its likeliest next word. The sealed problems are the 96 that
`src/tasks.mjs` makes from the sealed seed in `data/settings.json`: 12 sheets of 8, each sheet 2 easy, 4 climb and
2 wall problems. No sealed problem was made, read or run before this file was committed; the build was tuned on
the dev seed only (5 sheets, 40 problems), and what that tuning showed is in [SEAL.md](SEAL.md).

Four loops run every sealed problem, each up to 8 passes:

- **Retry.** After a wrong answer the model is told only that the answer is not right. Its first pass is **one try**:
  the model, cold, once.
- **Naive.** The model is asked to re-read its own working and correct it. Nothing checks it, and nothing stops it.
  It is scored on the answer it holds at each pass, so it can lose a right answer.
- **The climb, without the memory.** Every line the model writes is ruled on by code. The checker holds the
  calculation the problem asks for: a true line that is a step of it is crossed off with the value the model wrote, a
  false step is replaced by smaller steps, and what is left to do is sent back. The checker never gives the model a
  value it did not write. Each problem starts with nothing remembered.
- **The climb.** The same, with every true step written into a memory. Before the model is asked, a step the
  problem has to do that the memory already holds is crossed off and named as already checked.

"Right" always means the checker, which is code and not a model, ruled the final answer right: an exact value, two
whole-number factors greater than 1 that multiply to the number, or a whole number that satisfies the equation.

## The claims

| | claim | the bar |
|---|---|---|
| C1 | The climb lifts | the climb gets at least 20 points more of the sealed problems right by its last pass than one try does, and more by an exact two-sided McNemar test, p < 0.05 |
| C2 | Checking is what does it | the climb gets more of the sealed problems right by its last pass than the retry loop does with the same number of passes, by the same test, p < 0.05 |
| C3 | Left alone, it does not climb | the naive loop, at its last pass, has at most 5 points more of the sealed problems right than one try |
| C4 | The memory earns its place | with the memory, the climb gets at least as many sealed problems home as without it, and takes fewer passes of the model to do it |
| C5 | Easy is easy | at least 80% of the easy tier right at one try |
| C6 | The climb tier climbs | on the climb tier, at most 50% right at one try, and at least 40 points more after the climb |
| C7 | The wall holds | at most 20% of the wall tier home after the climb |
| C8 | Each pass squares what is left | on the climb tier, after every pass the share not yet home is at most the square of the share not yet home one pass earlier |

On the dev problems, which the build was tuned on and which prove nothing, the same claims came out like this: C1
32.5 points, C2 the climb 70.0% against retry 45.0% (p = 0.006), C3 the naive loop 12.5 points *below* one try, C5
100%, C6 25% at one try and 90% after, C7 none of 10, C8 held at 1 step of 7. **C4 did not hold on dev**: the climb got
28 problems home with the memory and 29 without, in 114 passes against 118. It is registered as it stands, because a
build that has a memory has to say whether the memory earns its place, and the sealed run will say.

C1 is the headline. C2 and C3 are what make it mean something: C2 says the lift is from checking steps and not from
having more tries, and C3 says more passes with no checker do not do the same. C5, C6 and C7 test the tiers, which
were set before anything sealed was measured; they are predictions and can be wrong. C8 is the strong form of the
idea, that depth compounds as fast as squaring. It is registered because it was claimed, and it is expected to fail:
one pass that leaves 30% not home would have to leave 9% after the next, then under 1%.

## What also goes on the page, whatever it shows

These are measurements, not claims, and none has a bar. Each is shown with its number.

- The share right after every pass, for all four loops.
- Every sealed problem the climb did not bring home, with where it stopped.
- What the climb cost: passes of the model and tokens against one try. (A pass is one model call. When two loops of
  the same run reach the same conversation, the page asks the model for it once and counts a pass for each loop.)
- How often the memory found a step it held, measured against an exact list kept beside it.
- How many problems the naive loop had right at some pass and wrong at the end.
- What the browser saved by keeping its work for the earlier turns of a conversation, timed both ways on the same
  passes.
- The network requests made while the run worked.

## Rules for the run

- The sealed run is one run of all four loops over all 96 problems, on one device, saved from the page. It may be made
  in more than one sitting: the page saves after every problem and carries on, and the number of sittings is recorded.
- The run is published only if `scripts/publish.mjs` finds it complete, made under this seal, and every problem in
  every loop comes out the same when it is decided again from its recorded replies with no model.
- If the run cannot be completed, that is reported, and no partial result is shown as the result.
- A second sealed run is not made to get a better number. If a fault in the code is found after the run, the fault,
  the fix and both results are published.
