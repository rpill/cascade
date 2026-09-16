import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const mastery = readFileSync(new URL('../src/ui/scenes/MasteryScene.ts', import.meta.url), 'utf8');
const actionCard = readFileSync(new URL('../src/ui/components/ActionCard.ts', import.meta.url), 'utf8');

test('Mastery uses framed reward coins, locked future ranks, and decorative segmented connectors', () => {
  assert.match(mastery, /rewardFrame/);
  assert.match(mastery, /rewardCoins/);
  assert.match(mastery, /UI_ICON_KEYS\.coin/);
  assert.match(mastery, /pathLocks/);
  assert.match(mastery, /UI_ICON_KEYS\.lock/);
  assert.match(mastery, /drawPathConnectors/);
  assert.doesNotMatch(mastery, /lineBetween\(startX, badgeYPath, startX \+ step \* \(this\.pathTexts\.length - 1\), badgeYPath\)/);
});

test('Mastery has an explicit compact landscape composition rather than a portrait fallback', () => {
  assert.match(mastery, /viewport\.profile === 'mobile-landscape'/);
  assert.match(mastery, /layoutMasterySections/);
  assert.match(mastery, /mobile \? 0\.2[0-9]/);
});

test('Home tile chevrons are smaller and further left on mobile landscape', () => {
  assert.match(actionCard, /mobile-landscape' \? 32 : 44/);
  assert.match(actionCard, /tile \? \(this\.viewport\.profile === 'mobile-landscape' \? 0\.82 : 0\.86\)/);
});
