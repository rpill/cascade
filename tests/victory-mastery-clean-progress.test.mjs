import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const overlay = readFileSync('src/ui/win/WinOverlay.ts', 'utf8');
const presenter = readFileSync('src/game/view/VictoryMastery.ts', 'utf8');

test('victory mastery card has no redundant MASTERY heading', () => {
  assert.doesNotMatch(overlay, /masteryTitle/);
  assert.doesNotMatch(presenter, /title:\s*tr\(language, 'МАСТЕРСТВО'\)/);
});

test('victory progress label, meter and value share one horizontal progress row', () => {
  assert.match(overlay, /const progressRowY=/);
  assert.match(overlay, /masteryProgressLabel[^\n]*setPosition\([^,]+,progressRowY\)/);
  assert.match(overlay, /masteryProgressValue[^\n]*setPosition\([^,]+,progressRowY\)/);
  assert.match(overlay, /meterBounds=\{[^}]*y:progressRowY-meterHeight\/2/s);
});

test('mastery progress animates for every fresh victory and handles promotion as a two-stage fill', () => {
  assert.doesNotMatch(overlay, /!mastery\.promoted\) return/);
  assert.match(overlay, /addCounter\(/);
  assert.match(overlay, /beforeProgressCurrent/);
  assert.match(overlay, /afterProgressCurrent/);
  assert.match(overlay, /if\(mastery\.promoted\)/);
});
