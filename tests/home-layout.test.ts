import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveUiViewport } from '../src/ui/layout/UiViewport.ts';
import { computeHomeLayout } from '../src/ui/layout/HomeLayout.ts';

for (const env of [
  { width: 1920, height: 1080, touchPrimary: false },
  { width: 1280, height: 720, touchPrimary: true },
  { width: 844, height: 390, touchPrimary: true },
]) {
  test(`home dashboard keeps Daily, Mastery and Leaders destinations at ${env.width}x${env.height}`, () => {
    const layout = computeHomeLayout(resolveUiViewport(env));
    assert.ok(layout.brand.width < layout.dashboard.width);
    assert.equal(layout.daily.y, layout.mastery.y);
    assert.equal(layout.daily.y, layout.leaders.y);
    assert.equal(layout.daily.height, layout.mastery.height);
    assert.equal(layout.daily.width, layout.leaders.width);
    assert.ok(layout.mastery.x + layout.mastery.width < layout.leaders.x);
    assert.ok(Math.abs(layout.leaders.x + layout.leaders.width - layout.dashboard.x - layout.dashboard.width) < 0.01);
    assert.ok(layout.serviceActions.y <= layout.continueCard.y);
  });
}

test('desktop home reserves a quiet brand column and generous dashboard', () => {
  const layout = computeHomeLayout(resolveUiViewport({ width: 1920, height: 1080, touchPrimary: false }));
  assert.ok(layout.brand.width / 1920 > 0.27 && layout.brand.width / 1920 < 0.34);
  assert.ok(layout.dashboard.width / 1920 > 0.60 && layout.dashboard.width / 1920 < 0.69);
});

test('landscape home gives the dashboard most of the available width', () => {
  const layout = computeHomeLayout(resolveUiViewport({ width: 1280, height: 720, touchPrimary: true }));
  assert.ok(layout.dashboard.width / 1280 > 0.92);
  assert.ok(layout.brand.y + layout.brand.height <= layout.continuePrimary.y);
});

test('mobile Home service controls stay at CSS-scale touch size', () => {
  const viewport = resolveUiViewport({ width: 844, height: 390, touchPrimary: true });
  const layout = computeHomeLayout(viewport);
  assert.equal(viewport.minTouchTarget, 44);
  assert.ok(layout.serviceActions.height >= 44 && layout.serviceActions.height <= 52);
});

test('saved-game Standard module reserves a distinct row for difficulty selection and new deal', () => {
  const layout = computeHomeLayout(resolveUiViewport({ width: 1280, height: 720, touchPrimary: true }));
  assert.ok(layout.continuePrimary.height > 0);
  assert.ok(layout.newDealRow.y > layout.continuePrimary.y);
  assert.equal(layout.difficultySelector.y, layout.newDealAction.y);
  assert.ok(layout.difficultySelector.x < layout.newDealAction.x);
  assert.ok(layout.newDealAction.width >= 120);
});
