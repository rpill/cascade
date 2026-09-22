import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

function walk(root) {
  const out = [];
  if (!existsSync(root)) return out;
  for (const name of readdirSync(root)) {
    const path = join(root, name);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

test('Supabase runtime and package dependency are gone', () => {
  assert.equal(existsSync('supabase'), false);
  assert.equal(pkg.dependencies?.supabase, undefined);
  assert.equal(pkg.devDependencies?.supabase, undefined);
  for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
    assert.doesNotMatch(`${name} ${command}`, /supabase/i);
  }
});

test('active runtime source does not reference Supabase APIs or paths', () => {
  const files = [
    ...walk('src'),
    ...walk('server'),
    ...walk('scripts'),
    ...walk('.github'),
  ].filter((path) => /\.(?:ts|js|mjs|cjs|json|ya?ml|ps1)$/.test(path));

  for (const path of files) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /supabase|SUPABASE_|\/rest\/v1\/|\/rpc\//i, path);
  }
});
