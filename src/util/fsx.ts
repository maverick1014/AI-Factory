/** Filesystem helpers for writing factory artifacts. */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, sep } from 'node:path';

/** Write a text file, creating parent directories as needed. */
export async function writeText(root: string, relPath: string, contents: string): Promise<void> {
  const full = safeJoin(root, relPath);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, contents, 'utf8');
}

/** Write a value as pretty-printed JSON. */
export async function writeJson(root: string, relPath: string, value: unknown): Promise<void> {
  await writeText(root, relPath, JSON.stringify(value, null, 2) + '\n');
}

/** Join under `root`, refusing paths that would escape it (path traversal guard). */
export function safeJoin(root: string, relPath: string): string {
  const cleaned = normalize(relPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const full = join(root, cleaned);
  const rootResolved = normalize(root + sep);
  if (!normalize(full + sep).startsWith(rootResolved) && normalize(full) !== normalize(root)) {
    throw new Error(`Refusing to write outside output root: ${relPath}`);
  }
  return full;
}

/** Turn a free-text idea into a filesystem-safe slug. */
export function slugify(text: string, max = 40): string {
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
  return slug || 'game';
}
