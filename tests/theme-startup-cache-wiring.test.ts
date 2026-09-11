import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const boot = readFileSync(new URL('../src/game/scenes/BootScene.ts', import.meta.url), 'utf8');
const scene = readFileSync(new URL('../src/game/scenes/GameScene.ts', import.meta.url), 'utf8');

function extractMethod(source: string, name: string): string {
  const direct = source.indexOf(`private ${name}`);
  const asyncStart = source.indexOf(`private async ${name}`);
  const start = direct === -1 ? asyncStart : direct;
  assert.notEqual(start, -1, `missing method ${name}`);
  const next = source.indexOf('\n  private ', start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

test('boot and game scene use the last equipped local theme as startup cache', () => {
  assert.match(boot, /readStartupThemeId/);
  assert.match(boot, /resolveThemeId\([^)]*readStartupThemeId\(\)/s);
  assert.match(scene, /readStartupThemeId/);
  assert.match(scene, /resolveThemeId\([^)]*readStartupThemeId\(\)/s);
});

test('cloud-confirmed and newly equipped themes refresh startup cache', () => {
  const loadProfile = extractMethod(scene, 'loadMetaProfile');
  const equipTheme = extractMethod(scene, 'equipOwnedTheme');
  assert.match(loadProfile, /writeStartupThemeId/);
  assert.match(equipTheme, /writeStartupThemeId/);
});

test('startup theme cache ignores invalid ids and storage failures', async () => {
  const { readStartupThemeId, writeStartupThemeId, STARTUP_THEME_CACHE_KEY } = await import('../src/theme/ThemeStartupCache.ts');
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };

  writeStartupThemeId('navy_study', storage);
  assert.equal(values.get(STARTUP_THEME_CACHE_KEY), 'navy_study');
  assert.equal(readStartupThemeId(storage), 'navy_study');

  writeStartupThemeId('not-a-theme', storage);
  assert.equal(values.get(STARTUP_THEME_CACHE_KEY), 'navy_study');

  values.set(STARTUP_THEME_CACHE_KEY, 'broken-theme');
  assert.equal(readStartupThemeId(storage), null);

  const blocked = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
  };
  assert.equal(readStartupThemeId(blocked), null);
  assert.doesNotThrow(() => writeStartupThemeId('walnut_study', blocked));
});
