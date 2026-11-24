import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sha256, utf8 } from '../src/sha256.mjs';

const ref = (s) => createHash('sha256').update(Buffer.from(new TextEncoder().encode(s))).digest('hex');

test('known vectors (FIPS 180-4)', () => {
  assert.equal(sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(sha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'), '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1');
  assert.equal(sha256(42), sha256(''));
});

test('every block boundary and every UTF-8 width, against node:crypto', () => {
  for (let n = 0; n <= 130; n++) assert.equal(sha256('a'.repeat(n)), ref('a'.repeat(n)), `length ${n}`);
  for (const s of ['é', '€', '😀', 'a😀b', '\ud800', 'x\udc00y', '߿ࠀ￿', '😀\ud83d', 'Ā'.repeat(40),
    '𐀀', '􏿿', '􏰀', '𐏿', '\udbff', '\udfff', '퟿', '\ud83d', '\udc00\ud800']) assert.equal(sha256(s), ref(s), JSON.stringify(s));
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < 200; i++) {
    let s = ''; const n = Math.floor(rnd() * 150);
    for (let j = 0; j < n; j++) s += String.fromCharCode(Math.floor(rnd() * 0x10000));
    assert.equal(sha256(s), ref(s));
  }
});

test('utf8 matches TextEncoder', () => {
  for (const s of ['', 'abc', '£', '😀', '\ud800', 'a\udc00', '\u0080߿ࠀ']) assert.deepEqual(utf8(s), [...new TextEncoder().encode(s)]);
  assert.deepEqual(utf8(null), []);
});
