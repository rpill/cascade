import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const lockfile = readFileSync(new URL('../pnpm-lock.yaml', import.meta.url), 'utf8');
const scrollRegion = readFileSync(new URL('../src/ui/components/ScrollRegion.ts', import.meta.url), 'utf8');

function collectTypeScriptFiles(directory) {
  const result = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) result.push(...collectTypeScriptFiles(full));
    else if (entry.endsWith('.ts')) result.push(full);
  }
  return result;
}

const srcDir = new URL('../src/', import.meta.url);
const sourceFiles = collectTypeScriptFiles(fileURLToPath(srcDir));
const allSource = sourceFiles.map((file) => readFileSync(file, 'utf8')).join('\n');

test('project resolves Phaser 4.2.1 in package metadata and pnpm lockfile', () => {
  assert.equal(packageJson.dependencies.phaser, '^4.2.1');
  assert.match(lockfile, /specifier:\s*\^4\.2\.1/);
  assert.match(lockfile, /version:\s*4\.2\.1/);
  assert.match(lockfile, /phaser@4\.2\.1:/);
  assert.doesNotMatch(lockfile, /phaser@3\.90\.0:/);
});

test('Phaser imports use namespace syntax compatible with the v4 ESM package', () => {
  assert.doesNotMatch(allSource, /import\s+Phaser\s+from\s+['"]phaser['"]/);
  assert.doesNotMatch(allSource, /import\s+type\s+Phaser\s+from\s+['"]phaser['"]/);

  const phaserImportingFiles = sourceFiles.filter((file) => /from\s+['"]phaser['"]/.test(readFileSync(file, 'utf8')));
  assert.ok(phaserImportingFiles.length > 0);
  for (const file of phaserImportingFiles) {
    const source = readFileSync(file, 'utf8');
    assert.match(source, /import(?:\s+type)?\s+\*\s+as\s+Phaser\s+from\s+['"]phaser['"]/);
  }
});

test('source does not use Phaser 3 rendering APIs removed by Phaser 4', () => {
  assert.doesNotMatch(allSource, /\.setTintFill\s*\(/);
  assert.doesNotMatch(allSource, /\.(?:preFX|postFX)\b/);
  assert.doesNotMatch(allSource, /Phaser\.Geom\.Point\b/);
  assert.doesNotMatch(allSource, /Phaser\.Structs\.(?:Set|Map)\b/);
  assert.doesNotMatch(allSource, /\.setPipeline\s*\(/);
});

test('scroll clipping uses a Phaser 4 filter mask in WebGL and GeometryMask only as Canvas fallback', () => {
  assert.match(scrollRegion, /renderer\.type\s*===\s*Phaser\.WEBGL/);
  assert.match(scrollRegion, /this\.content\.enableFilters\s*\(\s*\)/);
  assert.match(scrollRegion, /this\.content\.filters!\.internal\.addMask\s*\(/);
  assert.match(scrollRegion, /['"]world['"]/);
  assert.match(scrollRegion, /createGeometryMask\s*\(\s*\)/);
  assert.match(scrollRegion, /\.setMask\s*\(/);
});
