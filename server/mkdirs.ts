import fs from 'node:fs';
import path from 'node:path';

/**
 * Create a folder and any missing parents, one level at a time, at most `maxDepth` levels.
 * (Node's own `recursive` option can loop forever on unusual paths or file systems; this always finishes
 * and throws a clear error instead.)
 */
export function mkdirs(dir: string, maxDepth = 12): void {
  const missing: string[] = [];
  let cur = path.resolve(dir);
  while (!fs.existsSync(cur)) {
    missing.push(cur);
    const parent = path.dirname(cur);
    if (parent === cur || missing.length > maxDepth) throw new Error(`cannot create ${dir}: no existing parent folder found within ${maxDepth} levels`);
    cur = parent;
  }
  if (!fs.statSync(cur).isDirectory()) throw new Error(`${cur} exists but is not a folder`);
  for (const d of missing.reverse()) {
    try { fs.mkdirSync(d); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; }
  }
}
