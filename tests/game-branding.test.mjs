import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const shellSource = fs.readFileSync(new URL('../src/game/view/AppShellView.ts', import.meta.url), 'utf8');
const stylesSource = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
const sceneSource = fs.readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');
const englishSource = fs.readFileSync(new URL('../src/localization/English.ts', import.meta.url), 'utf8');

test('Russian branding is the default and the in-game logo is localized', () => {
  assert.match(indexHtml, /<title>Пасьянс Каскад<\/title>/);
  assert.match(indexHtml, /aria-label="Пасьянс Каскад"/);
  assert.match(shellSource, /t\('Пасьянс Каскад'\)/);
  assert.doesNotMatch(shellSource, /t\('КАСКАД'\)/);
  assert.doesNotMatch(shellSource, /\(\)\s*=>\s*'CASCADE'/);
});

test('English branding uses the full catalog title everywhere', () => {
  assert.match(englishSource, /'Пасьянс Каскад':\s*'Cascade: Solitaire Puzzle'/);
  assert.doesNotMatch(englishSource, /'КАСКАД':\s*'CASCADE'/);
});

test('switching language refreshes the browser title and game aria label', () => {
  assert.match(sceneSource, /document\.title\s*=\s*t\('Пасьянс Каскад'\)/);
  assert.match(sceneSource, /setAttribute\('aria-label',\s*t\('Пасьянс Каскад'\)\)/);
});


test('visible brand stays on one line and gives the longer English title a compact treatment', () => {
  const baseTitle = stylesSource.match(/\.app-shell-brand-title\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(baseTitle, /white-space:\s*nowrap/);
  assert.match(stylesSource, /html\[lang=['"]en['"]\]\s+\.app-shell-brand-title\s*\{[\s\S]*?font-size:/);
  assert.match(stylesSource, /@media \(max-height:\s*560px\)[\s\S]*?html\[lang=['"]en['"]\]\s+\.app-shell-brand-title\s*\{[\s\S]*?font-size:/);
});
