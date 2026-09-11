import test from 'node:test';
import assert from 'node:assert/strict';
import { planHiDpiCanvas } from '../src/render/HiDpiCanvas.ts';

test('HiDPI plan keeps 1x displays unchanged', () => {
  assert.deepEqual(planHiDpiCanvas(844, 390, 1), {
    logicalWidth: 844,
    logicalHeight: 390,
    renderScale: 1,
    backingWidth: 844,
    backingHeight: 390,
    cssZoom: 1,
  });
});

test('HiDPI plan uses 2x backing pixels on retina mobile while preserving CSS size', () => {
  assert.deepEqual(planHiDpiCanvas(844, 390, 3), {
    logicalWidth: 844,
    logicalHeight: 390,
    renderScale: 2,
    backingWidth: 1688,
    backingHeight: 780,
    cssZoom: 0.5,
  });
});

test('HiDPI plan clamps invalid dimensions and DPR safely', () => {
  assert.deepEqual(planHiDpiCanvas(0, Number.NaN, 0), {
    logicalWidth: 1,
    logicalHeight: 1,
    renderScale: 1,
    backingWidth: 1,
    backingHeight: 1,
    cssZoom: 1,
  });
});
