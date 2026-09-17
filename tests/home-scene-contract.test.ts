import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('HomeScene is a real Trifold-style responsive product hub', () => {
  assert.equal(existsSync('src/ui/scenes/HomeScene.ts'), true);
  const source = readFileSync('src/ui/scenes/HomeScene.ts', 'utf8');
  assert.match(source, /computeHomeLayout/);
  assert.match(source, /new SegmentedControl/);
  assert.doesNotMatch(source, /CoinPill|CoinShopOverlay/);
  assert.match(source, /new ActionCard/);
  assert.match(source, /Daily/);
  assert.match(source, /Мастерство/);
  assert.match(source, /leaders/);
  assert.match(source, /LeaderboardsScene/);
  assert.match(source, /CASCADE_UI_ART_KEYS/);
  assert.match(source, /productBridge/);
});

test('Home keeps gameplay actions in the bridge and routes product destinations to Phaser scenes', () => {
  const source = readFileSync('src/ui/scenes/HomeScene.ts', 'utf8');
  for (const action of ['resumeGame', 'startStandard', 'setStandardDifficulty']) {
    assert.match(source, new RegExp(`productBridge\\.${action}`), `missing bridge action ${action}`);
  }
  for (const destination of ['DailyScene','MasteryScene','LeaderboardsScene','HowToPlayScene','SettingsScene']) {
    assert.match(source, new RegExp(`scene\\.start\\('${destination}'\\)`), `missing scene destination ${destination}`);
  }
});
