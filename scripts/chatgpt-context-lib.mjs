import { execFile } from 'node:child_process';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const MANDATORY_FILES = [
  'PROJECT.md',
  'CURRENT_STATE.md',
  'TECH.md',
  'TREE.txt',
];

const EMBEDDABLE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
  '.json', '.md', '.txt', '.css', '.html', '.svg',
  '.yaml', '.yml', '.toml', '.xml', '.ini', '.conf',
  '.cpp', '.cc', '.c', '.h', '.hpp',
]);

const EXCLUDED_PREFIXES = [
  '.git/',
  'node_modules/',
  'dist/',
  '_chatgpt_bundle/',
  'docs/archive/',
  'artifacts/',
];

const COLLAPSED_TREE_DIRECTORIES = new Set([
  'Decks',
  'public/assets/cards',
]);

function normalizePath(value) {
  return value.replaceAll('\\', '/').replace(/^\.\//, '');
}

export function isBundleExcludedPath(relativePath) {
  const normalized = normalizePath(relativePath);
  if (['.git', 'node_modules', 'dist', '_chatgpt_bundle', 'artifacts'].includes(normalized)) {
    return true;
  }
  if (normalized === 'docs/archive' || normalized.startsWith('docs/archive/')) {
    return true;
  }
  if (normalized === '.DS_Store' || normalized.endsWith('/.DS_Store')) {
    return true;
  }
  if (normalized === 'Thumbs.db' || normalized.endsWith('/Thumbs.db')) {
    return true;
  }
  return EXCLUDED_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function isEmbeddableTextPath(relativePath) {
  if (isBundleExcludedPath(relativePath)) {
    return false;
  }
  const normalized = normalizePath(relativePath);
  const extension = path.posix.extname(normalized).toLowerCase();
  return EMBEDDABLE_EXTENSIONS.has(extension);
}


function timestampForFilename(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    '-',
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('');
}

export async function chooseUniqueBundlePath(outputDir, now = new Date()) {
  const stamp = timestampForFilename(now);
  const baseName = 'CHATGPT_CONTEXT';
  let attempt = 1;

  while (true) {
    const suffix = attempt === 1 ? '' : `-${attempt}`;
    const candidate = path.join(outputDir, `${baseName}(${stamp}${suffix}).txt`);
    if (!await pathExists(candidate)) {
      return candidate;
    }
    attempt += 1;
  }
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function treeLine(name, prefix, isLast) {
  return `${prefix}${isLast ? '└── ' : '├── '}${name}`;
}

async function buildTreeLines(rootDir, relativeDir = '', prefix = '') {
  const absoluteDir = path.join(rootDir, relativeDir);
  const entries = (await readdir(absoluteDir, { withFileTypes: true }))
    .filter((entry) => {
      const relativePath = normalizePath(path.posix.join(relativeDir, entry.name));
      return !isBundleExcludedPath(relativePath)
        && entry.name !== '.DS_Store'
        && entry.name !== 'Thumbs.db'
        && !entry.name.endsWith('.exe');
    })
    .sort((left, right) => {
      if (left.isDirectory() !== right.isDirectory()) {
        return left.isDirectory() ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });

  const lines = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const isLast = index === entries.length - 1;
    const relativePath = normalizePath(path.posix.join(relativeDir, entry.name));

    if (entry.isDirectory() && COLLAPSED_TREE_DIRECTORIES.has(relativePath)) {
      lines.push(treeLine(`${entry.name}/ [contents omitted]`, prefix, isLast));
      continue;
    }

    lines.push(treeLine(`${entry.name}${entry.isDirectory() ? '/' : ''}`, prefix, isLast));
    if (entry.isDirectory()) {
      lines.push(...await buildTreeLines(
        rootDir,
        relativePath,
        `${prefix}${isLast ? '    ' : '│   '}`,
      ));
    }
  }
  return lines;
}

export async function generateProjectTree(rootDir) {
  const rootName = path.basename(path.resolve(rootDir));
  const lines = await buildTreeLines(rootDir);
  return `${rootName}/\n${lines.join('\n')}\n`;
}

async function git(rootDir, args) {
  const { stdout } = await execFileAsync('git', args, {
    cwd: rootDir,
    maxBuffer: 16 * 1024 * 1024,
  });
  return stdout.trimEnd();
}

function decodeStatusPath(raw) {
  const value = raw.trim();
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value.slice(1, -1);
    }
  }
  const arrow = value.lastIndexOf(' -> ');
  return arrow >= 0 ? value.slice(arrow + 4) : value;
}

export async function collectWorkingTreeChanges(rootDir) {
  const stdout = await git(rootDir, ['status', '--porcelain=v1', '--untracked-files=all']);
  if (!stdout) return [];

  return stdout.split(/\r?\n/).filter(Boolean).map((line) => ({
    status: line.slice(0, 2).trim() || 'M',
    path: normalizePath(decodeStatusPath(line.slice(3))),
  }));
}

export async function collectLastCommitChanges(rootDir) {
  const stdout = await git(rootDir, [
    'diff-tree', '--root', '--no-commit-id', '--name-status', '-r', 'HEAD',
  ]);
  if (!stdout) return [];

  return stdout.split(/\r?\n/).filter(Boolean).map((line) => {
    const parts = line.split('\t');
    return {
      status: parts[0],
      path: normalizePath(parts.at(-1)),
    };
  });
}

async function readIfPresent(rootDir, relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  if (!await pathExists(absolutePath)) return null;
  return readFile(absolutePath, 'utf8');
}

export async function buildContextBundle({ rootDir, mode, now = new Date(), treeChanged = false }) {
  if (mode !== 'working-tree' && mode !== 'last-commit') {
    throw new Error(`Unsupported context mode: ${mode}`);
  }

  const [branchRaw, head, changes] = await Promise.all([
    git(rootDir, ['branch', '--show-current']),
    git(rootDir, ['rev-parse', '--short', 'HEAD']),
    mode === 'working-tree'
      ? collectWorkingTreeChanges(rootDir)
      : collectLastCommitChanges(rootDir),
  ]);
  const branch = branchRaw || '(detached HEAD)';

  const changedLines = changes.length === 0
    ? ['(none)']
    : changes.map(({ status, path: relativePath }) => `${status.padEnd(4)}  ${relativePath}`);

  const pathsToEmbed = [];
  for (const mandatory of MANDATORY_FILES) {
    if (await pathExists(path.join(rootDir, mandatory))) {
      pathsToEmbed.push(mandatory);
    }
  }
  for (const change of changes) {
    if (
      isEmbeddableTextPath(change.path)
      && !pathsToEmbed.includes(change.path)
      && await pathExists(path.join(rootDir, change.path))
    ) {
      pathsToEmbed.push(change.path);
    }
  }

  const sections = [];
  for (const relativePath of pathsToEmbed) {
    const content = await readIfPresent(rootDir, relativePath);
    if (content === null) continue;
    sections.push(`===== FILE: ${relativePath} =====\n${content.trimEnd()}\n===== END FILE: ${relativePath} =====`);
  }

  const timestamp = now.toISOString();
  return {
    treeChanged,
    text: [
      'CASCADE SOLITAIRE - CHATGPT CONTEXT',
      `Generated: ${timestamp}`,
      `Mode: ${mode}`,
      `Branch: ${branch}`,
      `Base HEAD: ${head}`,
      `TREE.txt changed: ${treeChanged ? 'yes' : 'no'}`,
      '',
      'SOURCE OF TRUTH',
      '1. Code and tests are the factual current implementation.',
      '2. PROJECT.md contains stable gameplay/product rules.',
      '3. CURRENT_STATE.md contains the current implementation snapshot and next focus.',
      '4. TECH.md contains architecture and development constraints.',
      '5. TREE.txt contains the generated project structure.',
      '6. docs/archive/** is historical only and must not drive implementation unless explicitly revived.',
      '',
      'CHANGED FILES',
      ...changedLines,
      '',
      'CURRENT FILE CONTENTS',
      '',
      ...sections,
      '',
    ].join('\n'),
  };
}
