import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const scene = readFileSync('src/ui/scenes/LeaderboardsScene.ts', 'utf8');
const art = readFileSync('src/ui/assets/CascadeUiArt.ts', 'utf8');
const assets = readFileSync('src/ui/assets/UiAssets.ts', 'utf8');

test('mastery leaderboard uses dedicated raster rank icons instead of symbolic glyphs', () => {
  assert.match(art, /rankLeaderboard:/);
  assert.match(assets, /CASCADE_UI_ART_KEYS\.rankLeaderboard/);
  assert.match(scene, /Phaser\.GameObjects\.Image/);
  assert.match(scene, /CASCADE_UI_ART_KEYS\.rankLeaderboard\[row\.entry\.metric\.rank\]/);
  assert.doesNotMatch(scene, /RANK_GLYPHS/);
});

test('all six leaderboard rank raster assets exist', () => {
  for (const rank of ['novice','player','tactician','expert','master','grandmaster']) {
    assert.equal(existsSync(`public/assets/ui/art/rank-leaderboard-${rank}.png`), true, rank);
  }
});

test('mastery rank medals are large enough to remain legible in leaderboard rows', () => {
  assert.match(scene, /viewport\.profile === 'desktop' \? 40 : 34/);
  assert.match(scene, /bounds\.height \* 0\.88/);
});
