import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const rulesUrl = new URL('../src/game/view/RulesView.ts', import.meta.url);
const slidesUrl = new URL('../src/game/view/RulesSlides.ts', import.meta.url);
const rulesSource = existsSync(rulesUrl) ? readFileSync(rulesUrl, 'utf8') : '';
const slidesSource = existsSync(slidesUrl) ? readFileSync(slidesUrl, 'utf8') : '';
const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('Rules is a concise five-slide carousel instead of the old section list', () => {
  assert.equal(slidesSource.length > 0, true, 'RulesSlides.ts must exist');
  const slideIds = [...slidesSource.matchAll(/id:\s*'([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(slideIds, [
    'foundations',
    'stock',
    'empty-column',
    'free-cell',
    'alternating-colors',
  ]);

  assert.doesNotMatch(rulesSource, /main-shell-rules-sections/);
  assert.doesNotMatch(rulesSource, /'auto'|'undo'|'modes'/);
  assert.match(rulesSource, /main-shell-rules-carousel/);
  assert.match(rulesSource, /main-shell-rules-prev/);
  assert.match(rulesSource, /main-shell-rules-next/);
  assert.match(rulesSource, /main-shell-rules-dots/);
});

test('Rules slides use supplied gameplay screenshots and the game wood visual language', () => {
  assert.match(slidesSource, /assets\/rules\/foundation\.png/);
  assert.match(slidesSource, /assets\/rules\/stock-draw-three\.png/);
  assert.match(slidesSource, /assets\/rules\/empty-column\.png/);
  assert.match(slidesSource, /assets\/rules\/free-stock-cell\.png/);
  assert.match(slidesSource, /assets\/rules\/alternating-colors\.png/);

  assert.match(stylesSource, /\.main-shell-rules-stage\s*\{[\s\S]*var\(--app-shell-wood\)/s);
  assert.match(rulesSource, /createScreenshotCursor/);
  assert.match(stylesSource, /\.rules-screenshot-cursor/);
});

test('Rules carousel supports arrows, clickable dots, and keyboard navigation without scroll', () => {
  assert.match(rulesSource, /ArrowLeft/);
  assert.match(rulesSource, /ArrowRight/);
  assert.match(rulesSource, /goToSlide/);
  assert.match(rulesSource, /ruleSlideIndex/);
  assert.match(rulesSource, /'Предыдущее правило'/);
  assert.match(rulesSource, /'Следующее правило'/);

  assert.doesNotMatch(stylesSource, /\.main-shell-rules[^}]*overflow\s*:\s*(?:auto|scroll)/s);
  assert.match(stylesSource, /@media\s*\(max-height:\s*560px\)[\s\S]*\.main-shell-rules-stage/s);
});
