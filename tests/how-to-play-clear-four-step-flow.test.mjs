import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const slides = readFileSync('src/game/view/RulesSlides.ts', 'utf8');
const illustration = readFileSync('src/ui/components/RulesIllustration.ts', 'utf8');

test('HowToPlay is a four-step flow: goal, tableau, free spaces, stock', () => {
  const ids = [...slides.matchAll(/id: '([^']+)'/g)].map(match => match[1]);
  assert.deepEqual(ids, ['foundations', 'alternating-colors', 'free-spaces', 'stock']);
  assert.match(slides, /Соберите все карты в четыре основания/);
  assert.match(slides, /по убыванию, чередуя цвет/);
  assert.match(slides, /пустой столбец/);
  assert.match(slides, /место колоды становится/);
  assert.match(slides, /открыть следующие три карты/);
});

test('RulesIllustration has a dedicated combined free-spaces diagram', () => {
  assert.match(illustration, /slide === 'free-spaces'/);
  assert.doesNotMatch(illustration, /slide === 'free-cell'/);
});
