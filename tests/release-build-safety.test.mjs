import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const sceneSource = fs.readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');
const envSource = fs.readFileSync(new URL('../.env.yandex-dev', import.meta.url), 'utf8');
const stylesSource = fs.readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('Yandex preview uses the normal production build and cannot enable the coin cheat', () => {
  assert.equal(packageJson.scripts['yandex:dev'], 'pnpm build && node scripts/yandex-dev-proxy.mjs');
  assert.equal(packageJson.scripts['build:yandex-dev'], undefined);
  assert.doesNotMatch(sceneSource, /VITE_DEV_CHEATS/);
  assert.match(sceneSource, /if \(loaded && import\.meta\.env\.DEV\)[\s\S]{0,120}setDevelopmentCoinFloor\(999_999\)/);
  assert.doesNotMatch(envSource, /VITE_DEV_CHEATS\s*=\s*true/i);
});

test('desktop brand uses the original grid flow while compact landscape keeps its mobile flow', () => {
  const desktopBrand = stylesSource.match(/\.app-shell-brand\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(desktopBrand, /grid-column:\s*2/);
  assert.match(desktopBrand, /transform:\s*translateY\(-24px\)/);
  assert.doesNotMatch(desktopBrand, /position:\s*absolute/);
  assert.doesNotMatch(desktopBrand, /left:\s*50%/);
  assert.doesNotMatch(desktopBrand, /top:\s*50%/);
  assert.match(
    stylesSource,
    /@media \(max-height:\s*560px\)[\s\S]*?\.app-shell-brand\s*\{[\s\S]*?transform:\s*none/,
  );
});

test('desktop catalog titles are smaller without changing the compact mobile sizes', () => {
  const desktopTitle = stylesSource.match(/\.app-shell-brand-title\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
  const englishTitle = stylesSource.match(/html\[lang='en'\] \.app-shell-brand-title\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(desktopTitle, /font-size:\s*clamp\(44px,\s*3\.75vw,\s*58px\)/);
  assert.match(englishTitle, /font-size:\s*clamp\(30px,\s*2\.65vw,\s*42px\)/);
  assert.match(stylesSource, /@media \(max-height:\s*560px\)[\s\S]*?\.app-shell-brand-title\s*\{[\s\S]*?font-size:\s*22px/);
  assert.match(stylesSource, /@media \(max-height:\s*560px\)[\s\S]*?html\[lang='en'\] \.app-shell-brand-title\s*\{[\s\S]*?font-size:\s*18px/);
});


test('desktop header centers the brand inside the free space between side controls', () => {
  const topbar = stylesSource.match(/\.app-shell-topbar\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(topbar, /grid-template-columns:\s*auto\s+1fr\s+auto/);
});
