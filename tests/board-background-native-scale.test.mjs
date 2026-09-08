import test from 'node:test';
import assert from 'node:assert/strict';
import { getSurfaceTransform } from '../src/game/view/BoardTexture.ts';

test('tile textures retain native scale at any viewport size', () => {
  for (const [width, height] of [[844, 390], [1920, 1080]]) {
    assert.deepEqual(getSurfaceTransform('tile', width, height, 1024, 1024), {scale: 1, x: 0, y: 0});
  }
});

test('wide cover crops vertically, without stretching or repeating the surface', () => {
  assert.deepEqual(getSurfaceTransform('cover', 1920, 960, 1536, 1024), {scale: 1.25, x: 0, y: 128});
});

test('tall cover crops horizontally and centers the material', () => {
  assert.deepEqual(getSurfaceTransform('cover', 768, 1024, 1536, 1024), {scale: 1, x: 384, y: 0});
});
