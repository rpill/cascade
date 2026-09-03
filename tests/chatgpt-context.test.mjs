import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  buildContextBundle,
  getBundlePath,
  generateProjectTree,
  isBundleExcludedPath,
  isEmbeddableTextPath,
} from '../scripts/chatgpt-context-lib.mjs';

const execFileAsync = promisify(execFile);

async function git(root, ...args) {
  return execFileAsync('git', args, { cwd: root });
}

async function initRepo(root) {
  await git(root, 'init');
  await git(root, 'config', 'user.email', 'context@example.com');
  await git(root, 'config', 'user.name', 'Context Test');
}

async function writeTruthDocs(root) {
  await writeFile(path.join(root, 'PROJECT.md'), '# Project\nStable rules.\n');
  await writeFile(path.join(root, 'CURRENT_STATE.md'), '# Current\nImplemented now.\n');
  await writeFile(path.join(root, 'TECH.md'), '# Tech\nArchitecture.\n');
  await writeFile(path.join(root, 'TREE.txt'), 'old tree\n');
}

test('classifies source text while excluding generated, archived, and binary contents', () => {
  assert.equal(isEmbeddableTextPath('src/game/model/cards.ts'), true);
  assert.equal(isEmbeddableTextPath('docs/superpowers/specs/design.md'), true);
  assert.equal(isEmbeddableTextPath('public/assets/cards/AS.png'), false);
  assert.equal(isBundleExcludedPath('docs/archive/old.md'), true);
  assert.equal(isBundleExcludedPath('_chatgpt_bundle/out.txt'), true);
  assert.equal(isBundleExcludedPath('dist/index.js'), true);
});

test('tree keeps code structure but collapses runtime and source card decks', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cascade-tree-'));
  await mkdir(path.join(root, 'src', 'game'), { recursive: true });
  await mkdir(path.join(root, 'public', 'assets', 'cards'), { recursive: true });
  await mkdir(path.join(root, 'Decks', 'Horizontal2', 'pngs'), { recursive: true });
  await writeFile(path.join(root, 'src', 'game', 'main.ts'), 'export {};\n');
  await writeFile(path.join(root, 'public', 'assets', 'cards', 'AS.png'), 'binary');
  await writeFile(path.join(root, 'Decks', 'Horizontal2', 'pngs', 'clubAce.png'), 'binary');

  const tree = await generateProjectTree(root);

  assert.match(tree, /src[\s\S]*game[\s\S]*main\.ts/);
  assert.match(tree, /public[\s\S]*cards\/ \[contents omitted\]/);
  assert.match(tree, /Decks\/ \[contents omitted\]/);
  assert.doesNotMatch(tree, /AS\.png/);
  assert.doesNotMatch(tree, /Horizontal2|clubAce\.png/);
});

test('working-tree bundle embeds truth docs and changed source but only lists changed PNGs', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cascade-context-'));
  await initRepo(root);
  await writeTruthDocs(root);
  await mkdir(path.join(root, 'src'), { recursive: true });
  await mkdir(path.join(root, 'public', 'assets', 'cards'), { recursive: true });
  await mkdir(path.join(root, 'docs', 'archive'), { recursive: true });
  await writeFile(path.join(root, 'src', 'main.ts'), 'export const value = 1;\n');
  await writeFile(path.join(root, 'public', 'assets', 'cards', 'AS.png'), 'png-one');
  await writeFile(path.join(root, 'docs', 'archive', 'old.md'), 'old history\n');
  await git(root, 'add', '.');
  await git(root, 'commit', '-m', 'baseline');

  await writeFile(path.join(root, 'src', 'main.ts'), 'export const value = 2;\n');
  await writeFile(path.join(root, 'public', 'assets', 'cards', 'AS.png'), 'png-two');
  await writeFile(path.join(root, 'docs', 'archive', 'old.md'), 'changed history\n');

  const result = await buildContextBundle({
    rootDir: root,
    mode: 'working-tree',
    now: new Date('2026-09-03T12:00:00Z'),
  });

  assert.match(result.text, /CASCADE SOLITAIRE - CHATGPT CONTEXT/);
  assert.match(result.text, /===== FILE: PROJECT\.md =====/);
  assert.match(result.text, /===== FILE: CURRENT_STATE\.md =====/);
  assert.match(result.text, /===== FILE: TECH\.md =====/);
  assert.match(result.text, /===== FILE: src\/main\.ts =====/);
  assert.match(result.text, /public\/assets\/cards\/AS\.png/);
  assert.doesNotMatch(result.text, /===== FILE: public\/assets\/cards\/AS\.png =====/);
  assert.doesNotMatch(result.text, /===== FILE: docs\/archive\/old\.md =====/);
});

test('last-commit bundle reports the latest commit files', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cascade-last-'));
  await initRepo(root);
  await writeTruthDocs(root);
  await mkdir(path.join(root, 'src'), { recursive: true });
  await writeFile(path.join(root, 'src', 'main.ts'), 'export const value = 1;\n');
  await git(root, 'add', '.');
  await git(root, 'commit', '-m', 'baseline');

  await writeFile(path.join(root, 'src', 'main.ts'), 'export const value = 2;\n');
  await git(root, 'add', 'src/main.ts');
  await git(root, 'commit', '-m', 'change source');

  const result = await buildContextBundle({
    rootDir: root,
    mode: 'last-commit',
    now: new Date('2026-09-03T12:00:00Z'),
  });

  assert.match(result.text, /Mode: last-commit/);
  assert.match(result.text, /M\s+src\/main\.ts/);
  assert.match(result.text, /export const value = 2/);
});


test('bundle path is stable so each generation replaces CHATGPT_CONTEXT.txt', async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'cascade-output-'));

  const first = getBundlePath(outputDir);
  assert.equal(path.basename(first), 'CHATGPT_CONTEXT.txt');
  await writeFile(first, 'first');

  const second = getBundlePath(outputDir);
  assert.equal(second, first);
});

test('CLI outside Git fails clearly instead of producing a misleading bundle', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'cascade-nogit-'));
  const scriptPath = path.resolve('scripts/chatgpt-context.mjs');

  await assert.rejects(
    execFileAsync(process.execPath, [scriptPath], { cwd: root }),
    (error) => {
      assert.match(String(error.stderr), /must be run inside a Git working tree/i);
      return true;
    },
  );
});
