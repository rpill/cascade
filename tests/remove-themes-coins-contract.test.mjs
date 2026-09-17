import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const main = readFileSync('src/main.ts', 'utf8');
const home = readFileSync('src/ui/scenes/HomeScene.ts', 'utf8');
const homeVm = readFileSync('src/ui/home/HomeViewModel.ts', 'utf8');
const bridge = readFileSync('src/ui/bridge/CascadeProductBridge.ts', 'utf8');
const metaSave = readFileSync('src/meta/MetaSave.ts', 'utf8');
const mastery = readFileSync('src/meta/mastery/Mastery.ts', 'utf8');
const hudVm = readFileSync('src/ui/game/GameHudViewModel.ts', 'utf8');
const gameScene = readFileSync('src/game/scenes/GameScene.ts', 'utf8');
const bootScene = readFileSync('src/game/scenes/BootScene.ts', 'utf8');
const appearance = existsSync('src/game/appearance/GameAppearance.ts')
  ? readFileSync('src/game/appearance/GameAppearance.ts', 'utf8')
  : '';

test('theme scene and theme shop are removed from runtime navigation', () => {
  assert.doesNotMatch(main, /ThemesScene/);
  assert.doesNotMatch(home, /ThemesScene|THEME_CATALOG|CoinPill|CoinShopOverlay/);
  assert.match(home, /LeaderboardsScene/);
  assert.doesNotMatch(homeVm, /themes|coins|themesTotal/);
  assert.match(homeVm, /leaders/);
  assert.doesNotMatch(bridge, /themesSnapshot|buyTheme|equipTheme|rewardedCoins|ThemeProduct|coins/);
});

test('meta schema v9 contains no themes, coin balance, purchases, or rewarded monetization state', () => {
  assert.match(metaSave, /META_SAVE_VERSION = 9/);
  assert.doesNotMatch(metaSave, /ownedThemes|equipped|coins|monetization|REWARDED/);
  assert.doesNotMatch(mastery, /rewardCoins|claimCoinRewardOnce|Coin/);
});

test('gameplay uses one fixed appearance and the deck redBack asset', () => {
  assert.match(appearance, /redBack\.webp/);
  assert.match(appearance, /assets\/game\/board-surface\.webp/);
  assert.doesNotMatch(gameScene, /ThemeCatalog|ThemeRegistry|ThemeSelection|ThemeLoader|setTheme|buyTheme|equipOwnedTheme|themePurchaseUnlocked|RewardDouble|doubleCoins|progression\.coins/);
  assert.doesNotMatch(bootScene, /ThemeRegistry|ThemeSelection|ThemeStartupCache|getThemeAssets|prepareCardBack/);
});

test('game HUD no longer exposes currency or per-deal coin rewards', () => {
  assert.doesNotMatch(hudVm, /coin|Coin|rewardCoins|rewardClaimed/);
});

test('theme assets and theme UI source are physically removed', () => {
  assert.equal(existsSync('src/theme'), false);
  assert.equal(existsSync('src/ui/themes'), false);
  assert.equal(existsSync('src/ui/scenes/ThemesScene.ts'), false);
  assert.equal(existsSync('public/assets/themes'), false);
});
