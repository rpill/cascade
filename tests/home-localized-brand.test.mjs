import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const home = readFileSync('src/ui/scenes/HomeScene.ts', 'utf8');
const english = readFileSync('src/localization/English.ts', 'utf8');

test('Home brand uses the official localized game title', () => {
  assert.match(home, /t\('Пасьянс Каскад'\)/);
  assert.match(home, /document\.title\s*=\s*t\('Пасьянс Каскад'\)/);
  assert.match(home, /setAttribute\('aria-label',\s*t\('Пасьянс Каскад'\)\)/);
  assert.doesNotMatch(home, /add\.text\(0,0,'CASCADE'/);
  assert.match(english, /'Пасьянс Каскад':\s*'Cascade: Solitaire Puzzle'/);
});
