import test from 'node:test';
import assert from 'node:assert/strict';
import { getThemes } from '../src/theme/ThemeRegistry.ts';
import { createSlotFrameSvg, createSlotGlyphSvg } from '../src/theme/SlotArtwork.ts';

test('generated slot frames are fully opaque for every theme', () => {
  for (const theme of getThemes()) {
    const svg = createSlotFrameSvg(theme.slots.palette);
    assert.doesNotMatch(svg, /(?:^|[\s<])(?:opacity|fill-opacity|stroke-opacity|stop-opacity)="?(?:0?\.|\.\d|0(?:"|\s|\/?>))/i, theme.id);
  }
});

test('generated slot glyphs are fully opaque for every theme', () => {
  for (const theme of getThemes()) {
    for (const role of ['clubs', 'diamonds', 'hearts', 'spades', 'stock'] as const) {
      const svg = createSlotGlyphSvg(role, theme.slots.palette);
      assert.doesNotMatch(svg, /(?:^|[\s<])(?:opacity|fill-opacity|stroke-opacity|stop-opacity)="?(?:0?\.|\.\d|0(?:"|\s|\/?>))/i, `${theme.id}:${role}`);
    }
  }
});
