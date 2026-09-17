import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const services = readFileSync('src/platform/services.ts', 'utf8');
const yandex = readFileSync('src/platform/yandex.ts', 'utf8');
const service = readFileSync('src/leaderboards/LeaderboardService.ts', 'utf8');
const scene = readFileSync('src/ui/scenes/LeaderboardsScene.ts', 'utf8');

test('Yandex leaderboard adapter exposes player avatar URLs to the product layer', () => {
  assert.match(services, /readonly avatarUrl\?: string/);
  assert.match(yandex, /getAvatarSrc\?: \(size\?: 'small' \| 'medium' \| 'large'\) => string/);
  assert.match(yandex, /getAvatarSrc\?\.\('small'\)/);
  assert.match(yandex, /avatarUrl/);
});

test('leaderboard rows preserve avatar URLs from the platform', () => {
  assert.match(service, /readonly avatarUrl\?: string/);
  assert.match(service, /avatarUrl: entry\.avatarUrl/);
});

test('leaderboard scene loads real avatars with fallback initials', () => {
  assert.match(scene, /avatarImage: Phaser\.GameObjects\.Image/);
  assert.match(scene, /loadAvatarTextures/);
  assert.match(scene, /row\.avatarReady/);
  assert.match(scene, /row\.avatarInitial\.setVisible\(visible && !row\.avatarReady\)/);
});

test('mastery rows use dedicated small raster versions of the real rank medals', () => {
  assert.match(scene, /rankIcon: Phaser\.GameObjects\.Image/);
  assert.match(scene, /row\.rankIcon\.setTexture\(CASCADE_UI_ART_KEYS\.rankLeaderboard\[row\.entry\.metric\.rank\]\)/);
  assert.doesNotMatch(scene, /RANK_GLYPHS/);
});

test('top three rows get explicit podium styling beyond the plain numeric badge', () => {
  assert.match(scene, /podiumRank/);
  assert.match(scene, /PODIUM_ROW_ALPHAS/);
  assert.match(scene, /strokeRoundedRect/);
});
