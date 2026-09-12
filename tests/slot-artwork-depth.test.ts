import test from 'node:test';
import assert from 'node:assert/strict';
import { getTheme } from '../src/theme/ThemeRegistry.ts';
import { createSlotFrameSvg } from '../src/theme/SlotArtwork.ts';

test('slot frame uses one simple outline with no inset double-frame effect', () => {
  const svg = createSlotFrameSvg(getTheme('walnut_study').slots.palette);

  assert.equal((svg.match(/<rect\b/g) ?? []).length, 1, 'slot frame should have one rectangular outline');
  assert.equal((svg.match(/<path\b/g) ?? []).length, 0, 'slot frame should not draw inset shadow/highlight paths');
  assert.doesNotMatch(svg, /data-depth=/, 'slot frame should not contain recessed double-frame decoration');
  assert.doesNotMatch(svg, /<linearGradient\b/, 'slot frame should use a flat theme fill');
});
