import test from 'node:test';
import assert from 'node:assert/strict';
import { getThemeAssets } from '../src/theme/ThemeAssets.ts';
import { getThemes } from '../src/theme/ThemeRegistry.ts';
import { getBoardTexture } from '../src/game/view/BoardTexture.ts';

test('every rendered surface is included in its preload bundle', () => {
  for (const theme of getThemes()) {
    assert.ok(getThemeAssets(theme).some(asset => asset.key === getBoardTexture(theme)));
  }
});
