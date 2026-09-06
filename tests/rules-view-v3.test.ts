import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const rulesUrl = new URL('../src/game/view/RulesView.ts', import.meta.url);
const slidesUrl = new URL('../src/game/view/RulesSlides.ts', import.meta.url);
const rulesSource = existsSync(rulesUrl) ? readFileSync(rulesUrl, 'utf8') : '';
const slidesSource = existsSync(slidesUrl) ? readFileSync(slidesUrl, 'utf8') : '';
const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

const screenshotAssets = [
  'foundation.png',
  'stock-draw-three.png',
  'empty-column.png',
  'free-stock-cell.png',
  'alternating-colors.png',
] as const;

test('Rules v3 uses the five supplied gameplay screenshots as the visual source of truth', () => {
  for (const asset of screenshotAssets) {
    assert.match(slidesSource, new RegExp(`assets/rules/${asset.replaceAll('.', '\\.')}`));
    assert.equal(
      existsSync(new URL(`../public/assets/rules/${asset}`, import.meta.url)),
      true,
      `${asset} must be shipped as a Rules screenshot asset`,
    );
  }

  assert.doesNotMatch(rulesSource, /RULE_CARD_ASSETS/);
  assert.doesNotMatch(rulesSource, /createCard\(|createStack\(|createFan\(|createSlot\(/);
  assert.doesNotMatch(stylesSource, /\.rules-demo-card\b/);
  assert.doesNotMatch(stylesSource, /\.rules-stack-/);
});

test('Rules screenshot stage preserves screenshot composition and adds only overlay guidance', () => {
  assert.match(rulesSource, /rules-screenshot-image/);
  assert.match(rulesSource, /rules-screenshot-cursor/);
  assert.match(rulesSource, /slide\.cursor\.x/);
  assert.match(rulesSource, /slide\.cursor\.y/);

  assert.match(
    stylesSource,
    /\.rules-screenshot-image\s*\{[\s\S]*object-fit:\s*contain;/s,
  );
  assert.match(
    stylesSource,
    /\.rules-screenshot-cursor\s*\{[\s\S]*position:\s*absolute;/s,
  );
});
