import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const actionCard = readFileSync('src/ui/components/ActionCard.ts', 'utf8');
const art = readFileSync('src/ui/assets/CascadeUiArt.ts', 'utf8');
const assets = readFileSync('src/ui/assets/UiAssets.ts', 'utf8');

test('leaders home card uses a dedicated home-strength background, not the washed leaderboard panel background', () => {
  assert.match(art, /homeLeadersBg: 'cascade\.ui\.home\.leaders-bg'/);
  assert.match(art, /homeLeadersBg: '\.\/assets\/ui\/art\/home-leaders-bg\.webp'/);
  assert.match(assets, /CASCADE_UI_ART_KEYS\.homeLeadersBg/);
  assert.match(actionCard, /state\.artwork === 'leaders' \? CASCADE_UI_ART_KEYS\.homeLeadersBg/);
  assert.doesNotMatch(actionCard, /state\.artwork === 'leaders' \? CASCADE_UI_ART_KEYS\.leaderboardPanelBg/);
  assert.equal(existsSync('public/assets/ui/art/home-leaders-bg.webp'), true);
});
