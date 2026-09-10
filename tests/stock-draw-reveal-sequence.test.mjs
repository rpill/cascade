import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/game/view/BoardView.ts', import.meta.url),
  'utf8',
);

function methodBody(name, nextName) {
  const start = source.indexOf(`  private ${name}`);
  const end = source.indexOf(`  private ${nextName}`, start + 1);
  assert.notEqual(start, -1, `${name} method missing`);
  assert.notEqual(end, -1, `${nextName} method missing`);
  return source.slice(start, end);
}

test('draw-three reveals each waste card only when its staggered stock flight starts', () => {
  const animateDraw = methodBody('animateDraw', 'handleCardPointerDown');
  const animateCardTo = methodBody('animateCardTo', 'stopCardFlight');

  assert.match(animateDraw, /\.setVisible\(false\)[\s\S]*index \* STOCK_DRAW_STAGGER,[\s\S]*true/);
  assert.match(animateCardTo, /revealOnStart = false/);
  assert.match(animateCardTo, /onStart:\s*\(\) => \{[\s\S]*if \(revealOnStart\)[\s\S]*image\.setVisible\(true\)/);
});
