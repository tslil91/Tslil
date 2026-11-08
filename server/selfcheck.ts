import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { mkdirs } from './mkdirs';

export interface CheckResult { name: string; ok: boolean; detail: string }

/**
 * `server.mjs --check`: tries, on THIS machine and THIS data folder, every file operation the server relies on,
 * and says in plain words what works. Run it before the first start, especially when the folder is a network share.
 */
export async function selfCheck(opts: { dataDir: string; publicDir: string; port: number; host: string }): Promise<CheckResult[]> {
  const out: CheckResult[] = [];
  const add = (name: string, ok: boolean, detail = '') => out.push({ name, ok, detail });
  const run = async (name: string, f: () => void | Promise<void | string>) => {
    try { const d = await f(); add(name, true, typeof d === 'string' ? d : ''); } catch (e) { add(name, false, (e as Error).message); }
  };

  const major = Number(process.versions.node.split('.')[0]);
  add(`Node.js version ${process.versions.node}`, major >= 20, major >= 20 ? '' : 'version 20 or newer is required');
  add(`Operating system: ${os.platform()} ${os.arch()}, computer name ${os.hostname()}`, true);

  await run('The web app files are present', () => {
    if (!fs.existsSync(path.join(opts.publicDir, 'index.html'))) throw new Error(`index.html not found in ${opts.publicDir}`);
  });

  const dir = path.join(opts.dataDir, '.selfcheck-' + process.pid);
  await run(`Data folder can be created and written: ${opts.dataDir}`, () => { mkdirs(dir); fs.writeFileSync(path.join(dir, 'w.txt'), 'x'); });
  await run('Files can be replaced safely (write, flush, rename over the old file, 20 times)', () => {
    const target = path.join(dir, 'state.json');
    for (let i = 0; i < 20; i++) {
      const tmp = `${target}.tmp-${i}`;
      const fd = fs.openSync(tmp, 'w'); try { fs.writeFileSync(fd, String(i)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
      fs.renameSync(tmp, target);
    }
    if (fs.readFileSync(target, 'utf8') !== '19') throw new Error('the file did not contain the last write');
  });
  await run('The "only one server" lock works (a second exclusive create must be refused)', () => {
    const lock = path.join(dir, 'server.lock');
    fs.writeFileSync(lock, '1', { flag: 'wx' });
    try { fs.writeFileSync(lock, '2', { flag: 'wx' }); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'EEXIST') return; throw e; }
    throw new Error('the file system allowed two exclusive creates: two servers could write at once. Do not use this folder.');
  });
  await run('The lock heartbeat (updating a file time) works', () => {
    const lock = path.join(dir, 'server.lock');
    const t = new Date(Date.now() - 60_000);
    fs.utimesSync(lock, t, t);
    if (Math.abs(fs.statSync(lock).mtimeMs - t.getTime()) > 2000) throw new Error('the file time did not change');
  });
  await run('The change log can be appended to', () => {
    const f = path.join(dir, 'audit.jsonl');
    fs.appendFileSync(f, '{"a":1}\n'); fs.appendFileSync(f, '{"a":2}\n');
    if (fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).length !== 2) throw new Error('appended lines were not read back');
  });
  await run('Backups can be copied and old ones deleted', () => {
    fs.copyFileSync(path.join(dir, 'state.json'), path.join(dir, 'copy.json'));
    fs.unlinkSync(path.join(dir, 'copy.json'));
  });
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* leave it: harmless */ }

  await run(`The port ${opts.port} is free`, () => new Promise<void>((resolve, reject) => {
    const s = net.createServer();
    s.once('error', (e: NodeJS.ErrnoException) => reject(new Error(e.code === 'EADDRINUSE' ? 'it is already used by another program: set PORT to another number' : e.message)));
    s.listen(opts.port, opts.host, () => s.close(() => resolve()));
  }));
  return out;
}

export function printCheck(results: CheckResult[], log: (m: string) => void = console.log): boolean {
  for (const r of results) log(`${r.ok ? 'OK    ' : 'FAILED'} ${r.name}${r.ok || !r.detail ? '' : `\n         -> ${r.detail}`}`);
  const bad = results.filter((r) => !r.ok).length;
  log(bad === 0 ? '\nAll checks passed. This machine and folder are suitable.' : `\n${bad} check(s) failed. Fix them before starting the server.`);
  return bad === 0;
}
