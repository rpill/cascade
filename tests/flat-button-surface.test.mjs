import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const surface = readFileSync('src/ui/components/ButtonSurface.ts', 'utf8');
const art = readFileSync('src/ui/assets/CascadeUiArt.ts', 'utf8');
const assets = readFileSync('src/ui/assets/UiAssets.ts', 'utf8');

test('button surface is graphics-only and does not depend on raster button assets', () => {
  assert.match(surface, /scene\.add\.graphics\(\)/);
  assert.doesNotMatch(surface, /scene\.add\.image/);
  assert.doesNotMatch(surface, /tileSprite/);
  assert.doesNotMatch(surface, /CASCADE_UI_ART_KEYS/);
  assert.doesNotMatch(surface, /setTexture/);
});

test('button surface uses flat fills, rounded corners, and a thin gold border', () => {
  assert.match(surface, /fillRoundedRect/);
  assert.match(surface, /strokeRoundedRect/);
  assert.match(surface, /UI_TOKENS\.color\.gold/);
  assert.doesNotMatch(surface, /shadow/);
  assert.doesNotMatch(surface, /TileSprite/);
});

test('button raster assets are removed from the central asset catalog and preload', () => {
  for (const token of ['buttonJade', 'buttonPaper', 'buttonGold', 'buttonIconJade']) {
    assert.doesNotMatch(art, new RegExp(token));
    assert.doesNotMatch(assets, new RegExp(token));
  }
});
