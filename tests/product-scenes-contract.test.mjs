import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const scenes = [
  ['DailyScene', 'src/ui/scenes/DailyScene.ts'],
  ['ThemesScene', 'src/ui/scenes/ThemesScene.ts'],
  ['LeaderboardsScene', 'src/ui/scenes/LeaderboardsScene.ts'],
  ['SettingsScene', 'src/ui/scenes/SettingsScene.ts'],
  ['HowToPlayScene', 'src/ui/scenes/HowToPlayScene.ts'],
];

test('all product destinations are Phaser scenes built on the Trifold UI base', () => {
  for (const [name, path] of scenes) {
    const source = read(path);
    assert.match(source, new RegExp(`export class ${name} extends BaseUiScene`));
  }
});

test('main registers every product scene', () => {
  const main = read('src/main.ts');
  for (const [name] of scenes) {
    assert.match(main, new RegExp(`import \\{ ${name} \\}`));
    assert.match(main, new RegExp(name));
  }
});

test('home routes product cards to Phaser scenes instead of legacy DOM shell views', () => {
  const home = read('src/ui/scenes/HomeScene.ts');
  assert.match(home, /scene\.start\('DailyScene'\)/);
  assert.match(home, /scene\.start\('ThemesScene'\)/);
  assert.match(home, /scene\.start\('LeaderboardsScene'\)/);
  assert.match(home, /scene\.start\('HowToPlayScene'\)/);
  assert.match(home, /scene\.start\('SettingsScene'\)/);
});

test('product bridge exposes screen data/actions without routing back to legacy shell', () => {
  const bridge = read('src/ui/bridge/CascadeProductBridge.ts');
  for (const token of ['themesSnapshot', 'buyTheme', 'equipTheme', 'leaderboardSnapshot', 'loadLeaderboard', 'authorizeLeaderboard', 'settingsSnapshot', 'setSoundEnabled', 'setLanguage', 'startDaily', 'rewardedCoins']) {
    assert.match(bridge, new RegExp(token));
  }
});

test('new leaderboard scene exposes Daily, streak, and Mastery tabs with Mastery score formatting', () => {
  const source = read('src/ui/scenes/LeaderboardsScene.ts');
  assert.match(source, /value:\s*'daily'/);
  assert.match(source, /value:\s*'streak'/);
  assert.match(source, /value:\s*'mastery'/);
  assert.match(source, /RANK_LABELS\[metric\.rank\]/);
  assert.match(source, /metric\.points/);
});

test('GameScene syncs Mastery leaderboard after wins and during historical sync', () => {
  const source = read('src/game/scenes/GameScene.ts');
  assert.match(source, /syncMasteryScore\(encodeMasteryLeaderboardScore\(this\.metaState\)\)/);
  const occurrences = source.match(/syncMasteryScore\(encodeMasteryLeaderboardScore\(this\.metaState\)\)/g) ?? [];
  assert.ok(occurrences.length >= 3, `expected completion + historical Mastery syncs, got ${occurrences.length}`);
});

test('Daily uses the Trifold replacement-confirmation flow for an already active Daily', () => {
  const daily = read('src/ui/scenes/DailyScene.ts');
  const bridge = read('src/ui/bridge/CascadeProductBridge.ts');
  assert.match(bridge, /activeDailyId/);
  assert.match(daily, /ModalShell/);
  assert.match(daily, /confirmReplacement/);
  assert.match(daily, /snapshot\.activeDailyId === this\.selectedDateKey/);
  assert.match(daily, /productBridge\.resumeGame\(\)/);
});

test('ordinary victory uses the Trifold rewarded double action', () => {
  const scene = read('src/game/scenes/GameScene.ts');
  const view = read('src/game/view/GameCompleteView.ts');
  assert.match(scene, /createRewardDoubleOffer/);
  assert.match(scene, /claimStandardRewardDouble/);
  assert.match(scene, /platform\.ads\.showRewarded\(\)/);
  assert.match(view, /doubleCoins/);
  assert.match(view, /rewardActionLabel/);
});
