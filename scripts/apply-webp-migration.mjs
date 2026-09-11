import { readdir, unlink, access } from 'node:fs/promises';
import { join, extname } from 'node:path';

const root = new URL('../public/assets/', import.meta.url);
let deleted = 0;
let skipped = 0;

async function walk(dirUrl) {
  const entries = await readdir(dirUrl, { withFileTypes: true });
  for (const entry of entries) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dirUrl);
    if (entry.isDirectory()) {
      await walk(child);
      continue;
    }
    if (extname(entry.name).toLowerCase() !== '.png') continue;

    const webp = new URL(entry.name.replace(/\.png$/i, '.webp'), dirUrl);
    try {
      await access(webp);
      await unlink(child);
      deleted += 1;
    } catch {
      skipped += 1;
      console.warn(`[webp-migration] kept ${child.pathname}: matching WebP not found`);
    }
  }
}

await walk(root);
console.log(`[webp-migration] deleted ${deleted} migrated PNG file(s); kept ${skipped} unmatched PNG file(s).`);
