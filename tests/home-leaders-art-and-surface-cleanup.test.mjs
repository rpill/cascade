import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const actionCard = readFileSync('src/ui/components/ActionCard.ts', 'utf8');
const uiSurface = readFileSync('src/ui/components/UiSurface.ts', 'utf8');
const cascadeUiArt = readFileSync('src/ui/assets/CascadeUiArt.ts', 'utf8');
const uiAssets = readFileSync('src/ui/assets/UiAssets.ts', 'utf8');

test('home leaders card uses a bespoke illustrated art asset instead of a flat trophy icon', () => {
  assert.match(cascadeUiArt, /homeLeaders: 'cascade\.ui\.home\.leaders'/);
  assert.match(cascadeUiArt, /homeLeaders: '\.\/assets\/ui\/art\/home-leaders\.webp'/);
  assert.match(uiAssets, /CASCADE_UI_ART_KEYS\.homeLeaders/);
  assert.match(actionCard, /state\.artwork === 'leaders' \? CASCADE_UI_ART_KEYS\.homeLeaders/);
  assert.equal(existsSync('public/assets/ui/art/home-leaders.webp'), true);
});

test('ui surface no longer draws the custom corner flourishes', () => {
  assert.doesNotMatch(uiSurface, /fillEllipse\(x!/);
  assert.doesNotMatch(uiSurface, /strokePath\(\);/);
});
