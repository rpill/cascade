import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveUiViewport } from '../src/ui/layout/UiViewport.ts';

test('1920x1080 mouse viewport uses desktop composition', () => {
  const viewport = resolveUiViewport({ width: 1920, height: 1080, touchPrimary: false });
  assert.equal(viewport.profile, 'desktop');
  assert.ok(viewport.safeMargin >= 24);
});

test('1280x720 touch viewport uses mobile-landscape composition', () => {
  const viewport = resolveUiViewport({ width: 1280, height: 720, touchPrimary: true });
  assert.equal(viewport.profile, 'mobile-landscape');
  assert.ok(viewport.safeMargin >= 12);
});

test('844x390 touch viewport stays mobile-landscape', () => {
  assert.equal(resolveUiViewport({ width: 844, height: 390, touchPrimary: true }).profile, 'mobile-landscape');
});

test('touch viewport reports CSS minimum touch target normalized through uiScale', () => {
  const viewport = resolveUiViewport({ width: 844, height: 390, touchPrimary: true });
  assert.equal(viewport.minTouchTarget, 44);
});
