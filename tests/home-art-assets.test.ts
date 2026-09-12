import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const shellSource = readFileSync(new URL('../src/game/view/AppShellView.ts', import.meta.url), 'utf8');
const playSource = readFileSync(new URL('../src/game/view/PlayPageView.ts', import.meta.url), 'utf8');
const stylesSource = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');


test('Home ships authored material and frame assets without pinning a specific art file', () => {
  const requiredFolders = [
    '../public/assets/theme/',
    '../public/assets/ui/',
    '../public/assets/ui/frames/',
    '../public/assets/ui/icons/',
  ];
  for (const folder of requiredFolders) {
    assert.equal(existsSync(new URL(folder, import.meta.url)), true, folder);
  }
});

test('ornamentation uses authored fixed-size corner assets without detached ornament DOM nodes', () => {
  assert.match(shellSource, /app-shell-brand-flourish/);
  assert.doesNotMatch(shellSource, /app-shell-corner-ornament/);
  assert.doesNotMatch(playSource, /main-shell-card-ornament/);
  assert.match(shellSource, /--home-corner-tl/);
  assert.match(stylesSource, /var\(--home-corner-tl\)/);
  assert.match(stylesSource, /var\(--home-corner-br\)/);
});

test('Home paper surfaces are driven by photographed paper textures', () => {
  assert.match(stylesSource, /var\(--app-shell-paper-primary\)/);
  assert.doesNotMatch(stylesSource, /var\(--app-shell-paper-fiber\)/);
  assert.doesNotMatch(stylesSource, /var\(--app-shell-frame\)|var\(--app-shell-mode-frame\)/);
});

test('CSS-backed Home asset URLs are resolved from the document base before entering stylesheet variables', () => {
  assert.match(shellSource, /new URL\(path, document\.baseURI\)\.href/);
  assert.doesNotMatch(shellSource, /setProperty\([^\n]+`url\("\$\{MENU_/);
});
