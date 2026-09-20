import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const requiredIcons = [
  'home', 'new-deal', 'undo', 'hint', 'settings',
  'leaderboard', 'how-to-play', 'daily', 'mastery',
] as const;

test('shared Trifold UI icon assets are bundled under public/assets/ui/icons', () => {
  for (const name of requiredIcons) {
    const path = `public/assets/ui/icons/${name}.svg`;
    assert.equal(existsSync(path), true, `${path} must exist`);
    const source = readFileSync(path, 'utf8');
    assert.match(source, /viewBox="0 0 24 24"/);
  }
});

test('Cascade BootScene preloads shared product UI assets without replacing card preload', () => {
  const boot = readFileSync('src/game/scenes/BootScene.ts', 'utf8');
  assert.ok(boot.includes('preloadUiAssets'));
  assert.ok(boot.includes('getCardFaceAsset'));
});

test('Cascade UI art is addressed through semantic keys', () => {
  const source = readFileSync('src/ui/assets/CascadeUiArt.ts', 'utf8');
  for (const key of ['homeBackdrop', 'homeHero', 'paperPanel', 'rank']) {
    assert.ok(source.includes(key), `expected semantic art key ${key}`);
  }
  assert.equal(source.includes('japan'), false);
});


test('every declared Cascade raster asset exists on disk', () => {
  const source = readFileSync('src/ui/assets/CascadeUiArt.ts', 'utf8');
  const matches = [...source.matchAll(/['"](\.\/assets\/ui\/art\/[^'"]+)['"]/g)];
  assert.ok(matches.length > 0, 'expected Cascade raster asset declarations');
  for (const [, relativePath] of matches) {
    const publicPath = `public/${relativePath.replace(/^\.\//, '')}`;
    assert.equal(existsSync(publicPath), true, `${publicPath} must exist`);
  }
});
