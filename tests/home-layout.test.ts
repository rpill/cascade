import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveUiViewport } from '../src/ui/layout/UiViewport.ts';
import { computeHomeLayout } from '../src/ui/layout/HomeLayout.ts';

for (const env of [
  { width: 1920, height: 1080, touchPrimary: false },
  { width: 1280, height: 720, touchPrimary: true },
  { width: 844, height: 390, touchPrimary: true },
]) {
  test(`home dashboard keeps three illustrated destinations under the Standard module at ${env.width}x${env.height}`, () => {
    const layout = computeHomeLayout(resolveUiViewport(env));
    assert.ok(layout.brand.width < layout.dashboard.width);
    assert.equal(layout.daily.y, layout.mastery.y);
    assert.equal(layout.daily.height, layout.mastery.height);
    assert.equal(layout.continueCard.x, layout.daily.x);
    assert.equal(layout.daily.width, layout.themes.width);
    assert.ok(layout.continueCard.y < layout.daily.y);
    assert.equal(layout.daily.y, layout.themes.y);
    assert.ok(layout.mastery.x + layout.mastery.width < layout.themes.x);
    assert.ok(Math.abs(layout.themes.x + layout.themes.width - layout.dashboard.x - layout.dashboard.width) < 0.01);
    assert.ok(layout.serviceActions.y <= layout.continueCard.y);
    assert.ok(layout.coinPill.x >= layout.dashboard.x);
  });
}

test('desktop home keeps approximately 38/55 brand-dashboard split', () => {
  const layout = computeHomeLayout(resolveUiViewport({ width: 1920, height: 1080, touchPrimary: false }));
  assert.ok(layout.brand.width / 1920 > 0.34 && layout.brand.width / 1920 < 0.42);
  assert.ok(layout.dashboard.width / 1920 > 0.50 && layout.dashboard.width / 1920 < 0.58);
});

test('mobile home keeps approximately 35/65 brand-dashboard split', () => {
  const layout = computeHomeLayout(resolveUiViewport({ width: 1280, height: 720, touchPrimary: true }));
  assert.ok(layout.brand.width / 1280 > 0.31 && layout.brand.width / 1280 < 0.39);
  assert.ok(layout.dashboard.width / 1280 > 0.59 && layout.dashboard.width / 1280 < 0.68);
});

test('mobile Home service controls stay at CSS-scale touch size instead of inverse-scaling to huge buttons', () => {
  const viewport = resolveUiViewport({ width: 844, height: 390, touchPrimary: true });
  const layout = computeHomeLayout(viewport);
  assert.equal(viewport.minTouchTarget, 44);
  assert.ok(layout.serviceActions.height >= 44 && layout.serviceActions.height <= 52);
  assert.ok(layout.coinPill.width <= 140);
});


test('saved-game Standard module reserves a distinct row for difficulty selection and new deal', () => {
  const layout = computeHomeLayout(resolveUiViewport({ width: 1280, height: 720, touchPrimary: true }));
  assert.ok(layout.continuePrimary.height > 0);
  assert.ok(layout.newDealRow.y > layout.continuePrimary.y);
  assert.equal(layout.difficultySelector.y, layout.newDealAction.y);
  assert.ok(layout.difficultySelector.x < layout.newDealAction.x);
  assert.ok(layout.newDealAction.width >= 120);
});
