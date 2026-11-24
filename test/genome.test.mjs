import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { judge, inLane, health } from '../genome/cell.mjs';

const seed = JSON.parse(readFileSync(new URL('../seed.json', import.meta.url), 'utf8'));

test('the judge tells the seed\'s good case from its bad one', async () => {
  assert.equal(await judge(seed.judge.cases.good), 'verified');
  assert.equal(await judge(seed.judge.cases.bad), 'unverified');
  assert.equal(await judge({ working: '0.5 × 14 × 23²', value: '3703' }), 'verified');
  assert.equal(await judge({ working: '1 ÷ 3', value: '0.333' }), 'unverified');
  assert.equal(await judge({ working: 'pizza', value: '1' }), 'refused');
  assert.equal(await judge({ working: '14 × 529', value: 'lots' }), 'refused');
  assert.equal(await judge({ working: '14 × 529', value: 7406 }), 'refused');
  assert.equal(await judge({ working: '7406', value: '7406' }), 'refused', 'a bare number is not a step');
  assert.equal(await judge({ value: '7406' }), 'refused');
  assert.equal(await judge({ working: '14 × 529' }), 'refused');
  assert.equal(await judge(null), 'refused');
  assert.equal(await judge('14 × 529 = 7406'), 'refused');
});

test('the lane takes the seed\'s in-lane step and refuses the other', async () => {
  assert.equal(await inLane(seed.boundary.inLane), true);
  assert.equal(await inLane(seed.boundary.outOfLane), false);
  assert.equal(await inLane({ working: '42' }), false);
  assert.equal(await inLane({ working: 42 }), false);
  assert.equal(await inLane(null), false);
  assert.equal(await inLane({}), false);
});

test('health says what it cannot see', async () => {
  assert.deepEqual(await health(), { used: null, dependedOn: null, lastEarned: null });
});
