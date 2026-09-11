import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

function collectPngFiles(root: string): string[] {
  const result: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) {
        result.push(relative(root, full).replaceAll('\\', '/'));
      }
    }
  };
  walk(root);
  return result.sort();
}

test('production assets ship without PNG files after WebP optimization', () => {
  const assetsRoot = fileURLToPath(new URL('../public/assets/', import.meta.url));
  assert.deepEqual(collectPngFiles(assetsRoot), []);
});

test('runtime card loader requests WebP card faces', () => {
  const bootScene = readFileSync(
    new URL('../src/game/scenes/BootScene.ts', import.meta.url),
    'utf8',
  );
  assert.match(bootScene, /fileName = `\$\{SUIT_FILE\[suit\]\}\$\{fileRank\}\.webp`/);
});
