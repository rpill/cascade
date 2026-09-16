import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('shared win overlay supports a mastery celebration block with progress meter animation', () => {
  assert.equal(existsSync('src/game/view/VictoryMastery.ts'), true);
  const source = readFileSync('src/ui/win/WinOverlay.ts', 'utf8');
  assert.match(source, /masteryBadge/);
  assert.match(source, /masteryMeter/);
  assert.match(source, /playMasteryAnimation\(\)/);
  assert.match(source, /CASCADE_UI_ART_KEYS\.rank/);
});

test('ordinary and Daily completion pass mastery celebration data into WinOverlay', () => {
  const ordinary = readFileSync('src/game/view/GameCompleteView.ts', 'utf8');
  const daily = readFileSync('src/game/view/DailyCompleteView.ts', 'utf8');
  assert.match(ordinary, /mastery\?: VictoryMasteryState/);
  assert.match(ordinary, /presentVictoryMastery/);
  assert.match(daily, /mastery\?: VictoryMasteryState/);
  assert.match(daily, /presentVictoryMastery/);
});

test('GameScene builds mastery celebration state from before\/after meta snapshots for both win flows', () => {
  const scene = readFileSync('src/game/scenes/GameScene.ts', 'utf8');
  const matches = scene.match(/buildVictoryMasteryState\(/g) ?? [];
  assert.ok(matches.length >= 2, `expected mastery celebration builder in both ordinary and Daily flows, got ${matches.length}`);
  assert.match(scene, /mastery: completion\.mastery/);
  assert.match(scene, /mastery: this\.lastDailyMastery/);
});
