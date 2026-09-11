import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const shellSource = fs.readFileSync(new URL('../src/game/view/AppShellView.ts', import.meta.url), 'utf8');
const sceneSource = fs.readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');
const englishSource = fs.readFileSync(new URL('../src/localization/English.ts', import.meta.url), 'utf8');

test('Russian branding is the default and the in-game logo is localized', () => {
  assert.match(indexHtml, /<title>Пасьянс Каскад<\/title>/);
  assert.match(indexHtml, /aria-label="Пасьянс Каскад"/);
  assert.match(shellSource, /t\('КАСКАД'\)/);
  assert.match(shellSource, /t\('Пасьянс Каскад'\)/);
  assert.doesNotMatch(shellSource, /\(\)\s*=>\s*'CASCADE'/);
});

test('English branding translates both the catalog title and compact logo', () => {
  assert.match(englishSource, /'Пасьянс Каскад':\s*'Cascade: Solitaire Puzzle'/);
  assert.match(englishSource, /'КАСКАД':\s*'CASCADE'/);
});

test('switching language refreshes the browser title and game aria label', () => {
  assert.match(sceneSource, /document\.title\s*=\s*t\('Пасьянс Каскад'\)/);
  assert.match(sceneSource, /setAttribute\('aria-label',\s*t\('Пасьянс Каскад'\)\)/);
});
