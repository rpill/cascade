import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

const names = [
  'button',
  'card-touch-1','card-touch-2',
  'card-place-1','card-place-2','card-place-3','card-place-4',
  'deal-1','deal-2','deal-3','deal-4',
  'undo-1','undo-2','victory','level-up','coin-reward',
];

test('shipped SFX are real-source OGG assets rather than generated PCM placeholders', () => {
  for (const name of names) {
    const url = new URL(`../public/assets/audio/sfx/${name}.ogg`, import.meta.url);
    const data = readFileSync(url);
    assert.ok(statSync(url).size > 1000, `${name} is unexpectedly tiny`);
    assert.equal(data.subarray(0,4).toString('ascii'), 'OggS');
  }
});

test('legacy synthetic WAV set and invalid cue are gone', () => {
  for (const name of ['button','card-pick','card-place','deal','foundation-place','undo','invalid','victory','level-up','coin-reward']) {
    const url = new URL(`../public/assets/audio/sfx/${name}.wav`, import.meta.url);
    assert.throws(() => readFileSync(url));
  }
});
