import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const scene = readFileSync(new URL('../src/ui/scenes/DailyScene.ts', import.meta.url), 'utf8');
const assets = readFileSync(new URL('../src/ui/assets/UiAssets.ts', import.meta.url), 'utf8');

test('Daily concept summary uses exact Font Awesome fire, trophy and crown assets', () => {
  assert.match(scene, /UI_ICON_KEYS\.fire/u);
  assert.match(scene, /UI_ICON_KEYS\.trophy/u);
  assert.match(scene, /UI_ICON_KEYS\.crown/u);
  assert.doesNotMatch(scene, /UI_ICON_KEYS\.streak/u);
  assert.doesNotMatch(scene, /UI_ICON_KEYS\.leaderboard/u);
  assert.doesNotMatch(scene, /UI_ICON_KEYS\.mastery/u);

  assert.match(assets, /fire:\s*'fire\.svg'/u);
  assert.match(assets, /trophy:\s*'trophy\.svg'/u);
  assert.match(assets, /crown:\s*'crown\.svg'/u);

  for (const name of ['fire.svg', 'trophy.svg', 'crown.svg']) {
    const url = new URL(`../public/assets/ui/icons/${name}`, import.meta.url);
    assert.equal(existsSync(url), true, `${name} must be vendored`);
    assert.match(readFileSync(url, 'utf8'), /Font Awesome Free 6\.7\.2/u);
  }
});

test('Daily concept summary places icons on circular paper-gold badges', () => {
  assert.match(scene, /summaryRowIconBadges/u);
  assert.match(scene, /fillCircle\(/u);
  assert.match(scene, /strokeCircle\(/u);
});
