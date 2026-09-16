import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('src/ui/win/WinOverlay.ts', 'utf8');

test('victory screen keeps compact two-column reward/mastery cards and ornate inner frames', () => {
  assert.match(source, /const rewardPanelWidth = \(innerWidth - panelGap\) \* 0\.49/);
  assert.doesNotMatch(source, /rewardPanelWidth = hasMastery \?/);
  assert.match(source, /this\.rewardPanel\.layout\(rewardPanelBounds, 'paper', true\)/);
  assert.match(source, /this\.masteryPanel\.layout\(masteryPanelBounds, 'paper', true\)/);
});
