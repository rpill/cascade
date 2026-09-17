import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RULE_SLIDES } from '../src/game/view/RulesSlides.ts';

test('tutorial rules expose exactly the four supported procedural illustration ids', () => {
  assert.deepEqual(
    RULE_SLIDES.map(slide => slide.id),
    ['foundations', 'alternating-colors', 'free-spaces', 'stock'],
  );
});

test('RulesIllustration renders every rule procedurally and does not depend on retired rule artwork files', () => {
  const source = readFileSync(new URL('../src/ui/components/RulesIllustration.ts', import.meta.url), 'utf8');

  for (const slide of RULE_SLIDES) {
    if (slide.id === 'stock') {
      assert.match(source, /} else \{[\s\S]*× 3/);
    } else {
      assert.match(source, new RegExp(`slide === '${slide.id}'`));
    }
  }

  assert.doesNotMatch(source, /assets\/rules\//);
  assert.doesNotMatch(source, /\.svg['"]/);
});
