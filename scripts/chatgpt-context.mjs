import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  buildContextBundle,
  getBundlePath,
  generateProjectTree,
} from './chatgpt-context-lib.mjs';

const execFileAsync = promisify(execFile);

const args = process.argv.slice(2);
const allowed = new Set(['--last-commit']);
const unknown = args.filter((arg) => !allowed.has(arg));
if (unknown.length > 0) {
  console.error(`Unknown argument(s): ${unknown.join(', ')}`);
  process.exit(2);
}

const mode = args.includes('--last-commit') ? 'last-commit' : 'working-tree';

async function resolveRepoRoot() {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], {
      cwd: process.cwd(),
    });
    return stdout.trim();
  } catch {
    throw new Error('ChatGPT context generator must be run inside a Git working tree.');
  }
}

try {
  const rootDir = await resolveRepoRoot();
  const treePath = path.join(rootDir, 'TREE.txt');
  const newTree = await generateProjectTree(rootDir);
  let previousTree = null;
  try {
    previousTree = await readFile(treePath, 'utf8');
  } catch {
    // First generated tree.
  }
  const treeChanged = previousTree !== newTree;
  await writeFile(treePath, newTree, 'utf8');

  const now = new Date();
  const bundle = await buildContextBundle({ rootDir, mode, now, treeChanged });
  const outputDir = path.join(rootDir, '_chatgpt_bundle');
  await mkdir(outputDir, { recursive: true });
  const outputPath = getBundlePath(outputDir);
  await writeFile(outputPath, bundle.text, 'utf8');
  console.log(path.relative(rootDir, outputPath));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
