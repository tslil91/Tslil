import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type http from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emptyData } from '../src/domain/data';
import { seedData } from '../src/store/seed';
import { DataStore, LockError, processAlive } from './datastore';
import { createApp } from './http';

let dir: string;
let pub: string;
const stores: DataStore[] = [];
const servers: http.Server[] = [];
const quiet = () => {};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-data-'));
  pub = fs.mkdtempSync(path.join(os.tmpdir(), 'pb-pub-'));
  fs.mkdirSync(path.join(pub, 'assets'));
  fs.writeFileSync(path.join(pub, 'index.html'), '<!doctype html><title>x</title>');
  fs.writeFileSync(path.join(pub, 'assets', 'app-abc.js'), 'console.log(1)');
  fs.writeFileSync(path.join(dir, '..', 'pb-secret.txt'), 'secret');
});
afterEach(async () => {
  for (const s of servers.splice(0)) await new Promise((r) => s.close(r));
  for (const s of stores.splice(0)) s.close();
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(pub, { recursive: true, force: true });
  fs.rmSync(path.join(dir, '..', 'pb-secret.txt'), { force: true });
});

const open = (o: Partial<Parameters<typeof DataStore.open>[0]> = {}) => {
  const s = DataStore.open({ dataDir: dir, log: quiet, ...o });
  stores.push(s);
  return s;
};
const start = async (store = open(), maxBodyBytes?: number) => {
  const app = createApp({ store, publicDir: pub, log: quiet, maxBodyBytes });
  servers.push(app);
  await new Promise<void>((r) => app.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
  const put = (body: unknown, headers: Record<string, string> = {}) =>
    fetch(`${base}/api/state`, { method: 'PUT', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
  return { store, base, put };
};
const entry = (summary: string, personId: number | null = null, kind = 'person') => ({ kind, entityId: '1', personId, summary, details: [{ label: 'דרגה', from: 'סרן', to: 'רס"ן' }] });

describe('state and change log over HTTP', () => {
  it('starts empty, saves, and returns what was saved', async () => {
    const { base, put } = await start();
    expect(await (await fetch(`${base}/api/health`)).json()).toMatchObject({ ok: true, app: 'personnel-billets', version: 0 });
    expect(await (await fetch(`${base}/api/state`)).json()).toEqual({ version: 0, data: null });
    const data = seedData();
    const r = await put({ baseVersion: 0, data, entries: [entry('נוסף')] }, { 'x-actor': encodeURIComponent('דנה') });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ version: 1 });
    const got = await (await fetch(`${base}/api/state`)).json();
    expect(got.version).toBe(1);
    expect(got.data.people).toHaveLength(16);
    expect((await (await fetch(`${base}/api/version`)).json()).version).toBe(1);
  });

  it('rejects a save based on an old version (someone else saved first) and keeps the data', async () => {
    const { base, put } = await start();
    await put({ baseVersion: 0, data: seedData(), entries: [] });
    const mine = seedData(); mine.people = mine.people.slice(0, 3);
    const r = await put({ baseVersion: 0, data: mine, entries: [entry('should not be saved')] });
    expect(r.status).toBe(409);
    expect(await r.json()).toEqual({ error: 'conflict', version: 1 });
    const got = await (await fetch(`${base}/api/state`)).json();
    expect(got.data.people).toHaveLength(16);
    const log = await (await fetch(`${base}/api/audit`)).json();
    expect(log.total).toBe(0);
  });

  it('records who made each change (Hebrew names), with increasing ids and server time', async () => {
    const { base, put } = await start();
    await put({ baseVersion: 0, data: seedData(), entries: [entry('א', 1), entry('ב', 2)] }, { 'x-actor': encodeURIComponent('דנה כהן') });
    await put({ baseVersion: 1, data: seedData(), entries: [entry('ג', 1, 'billet')] }, { 'x-actor': encodeURIComponent('יוסי') });
    const log = await (await fetch(`${base}/api/audit`)).json();
    expect(log.entries.map((e: { summary: string }) => e.summary)).toEqual(['ג', 'ב', 'א']); // newest first
    expect(log.entries.map((e: { id: number }) => e.id)).toEqual([3, 2, 1]);
    expect(log.entries[2].actor).toBe('דנה כהן');
    expect(log.entries[0].actor).toBe('יוסי');
    expect(Number.isNaN(Date.parse(log.entries[0].at))).toBe(false);
  });

  it('filters the log by person, kind, text, actor and limit', async () => {
    const { base, put } = await start();
    await put({ baseVersion: 0, data: seedData(), entries: [entry('דנה עודכנה', 1), entry('תקן שונה', null, 'billet'), entry('יוסי עודכן', 2)] }, { 'x-actor': encodeURIComponent('דנה') });
    const get = async (qs: string) => (await (await fetch(`${base}/api/audit?${qs}`)).json());
    expect((await get('personId=2')).entries).toHaveLength(1);
    expect((await get('kind=billet')).entries[0].summary).toBe('תקן שונה');
    expect((await get(`q=${encodeURIComponent('יוסי')}`)).total).toBe(1);
    expect((await get(`actor=${encodeURIComponent('אחר')}`)).total).toBe(0);
    const lim = await get('limit=2');
    expect(lim.entries).toHaveLength(2);
    expect(lim.total).toBe(3);
  });

  it('survives a restart: state, version and log are read back from disk', async () => {
    let s = await start();
    await s.put({ baseVersion: 0, data: seedData(), entries: [entry('x')] }, { 'x-actor': 'a' });
    await new Promise((r) => servers.pop()!.close(r));
    stores.pop()!.close();
    s = await start(open());
    const got = await (await fetch(`${s.base}/api/state`)).json();
    expect(got.version).toBe(1);
    expect(got.data.people).toHaveLength(16);
    expect((await (await fetch(`${s.base}/api/audit`)).json()).total).toBe(1);
  });

  it('writes atomically: no temp files are left behind', async () => {
    const { put } = await start();
    for (let v = 0; v < 3; v++) await put({ baseVersion: v, data: seedData(), entries: [] });
    expect(fs.readdirSync(dir).filter((f) => f.includes('.tmp'))).toEqual([]);
  });
});

describe('validation and limits', () => {
  it('rejects bad input without changing anything', async () => {
    const { base, put } = await start(undefined, 200_000);
    expect((await put('{broken')).status).toBe(400);
    expect((await put({ data: seedData() })).status).toBe(400); // no baseVersion
    expect((await put({ baseVersion: 0, data: { people: [] } })).status).toBe(400); // not a data set
    expect((await put({ baseVersion: 0, data: emptyData(), entries: [{ kind: 'hack', personId: null }] })).status).toBe(400);
    expect((await put({ baseVersion: 0, data: emptyData(), entries: 'x' })).status).toBe(400);
    const wrongType = await fetch(`${base}/api/state`, { method: 'PUT', headers: { 'content-type': 'text/plain' }, body: '{}' });
    expect(wrongType.status).toBe(415);
    const big = { baseVersion: 0, data: { ...emptyData(), notes: Array.from({ length: 5000 }, (_, i) => ({ id: i, personId: 1, text: 'x'.repeat(100), createdAt: '', author: '' })) } };
    expect((await put(big)).status).toBe(413);
    expect((await (await fetch(`${base}/api/state`)).json()).version).toBe(0);
  });
  it('cleans log text (control characters, length) and caps entry counts', async () => {
    const { base, put } = await start();
    await put({ baseVersion: 0, data: emptyData(), entries: [entry('a\u0000b\nc'.padEnd(2000, 'x'))] }, { 'x-actor': '%' }); // bad escape in actor
    const e = (await (await fetch(`${base}/api/audit`)).json()).entries[0];
    expect(e.summary).not.toMatch(/[\u0000-\u001f]/);
    expect(e.summary.length).toBeLessThanOrEqual(600);
    expect(e.actor).toBe('לא ידוע');
    expect((await put({ baseVersion: 1, data: emptyData(), entries: Array.from({ length: 5001 }, () => entry('x')) })).status).toBe(400);
  });
  it('unknown API routes and wrong methods', async () => {
    const { base } = await start();
    expect((await fetch(`${base}/api/nope`)).status).toBe(404);
    expect((await fetch(`${base}/api/health`, { method: 'POST' })).status).toBe(405);
    expect((await fetch(`${base}/api/state`, { method: 'DELETE' })).status).toBe(405);
  });
});

describe('static files', () => {
  it('serves the app with security headers and caching rules', async () => {
    const { base } = await start();
    const index = await fetch(`${base}/`);
    expect(index.status).toBe(200);
    expect(index.headers.get('content-type')).toContain('text/html');
    expect(index.headers.get('cache-control')).toBe('no-cache');
    expect(index.headers.get('content-security-policy')).toContain("default-src 'self'");
    expect(index.headers.get('content-security-policy')).not.toMatch(/https?:/);
    expect(index.headers.get('x-content-type-options')).toBe('nosniff');
    const asset = await fetch(`${base}/assets/app-abc.js`);
    expect(asset.headers.get('cache-control')).toContain('immutable');
    expect(asset.headers.get('content-type')).toContain('javascript');
    expect(await asset.text()).toBe('console.log(1)');
  });
  it('does not leak files outside the web folder', async () => {
    const { base } = await start();
    for (const p of ['/..%2fpb-secret.txt', '/%2e%2e/pb-secret.txt', '/assets/..%2f..%2fpb-secret.txt', '/..%5c..%5cetc%5cpasswd', '/%00']) {
      const r = await fetch(base + p);
      expect([400, 403, 404]).toContain(r.status);
      expect(await r.text()).not.toContain('secret');
    }
    expect((await fetch(`${base}/missing.js`)).status).toBe(404);
    expect((await fetch(`${base}/`, { method: 'POST' })).status).toBe(405);
  });
});

describe('single writer lock (shared NFS safety)', () => {
  it('a second server on the same folder is refused with a clear message', () => {
    open();
    expect(() => DataStore.open({ dataDir: dir, log: quiet })).toThrow(LockError);
    expect(() => DataStore.open({ dataDir: dir, log: quiet })).toThrow(/in use by another server/);
  });
  it('the lock is released on close, so a new server can start', () => {
    const a = open(); a.close();
    expect(fs.existsSync(path.join(dir, 'server.lock'))).toBe(false);
    expect(() => open()).not.toThrow();
  });
  it('an abandoned lock (no heartbeat) is taken over; a fresh one is not', () => {
    let t = Date.now();
    open({ now: () => t, staleLockMs: 120_000 });
    const lock = path.join(dir, 'server.lock');
    const old = new Date(t - 10 * 60_000);
    // crashed server: heartbeat stopped 10 minutes ago
    fs.utimesSync(lock, old, old);
    expect(() => DataStore.open({ dataDir: dir, log: quiet, now: () => t, staleLockMs: 120_000 })).not.toThrow();
    // a fresh lock is respected
    t += 1000;
    expect(() => DataStore.open({ dataDir: dir, log: quiet, now: () => t, staleLockMs: 120_000 })).toThrow(LockError);
  });
  it('processAlive: this process is alive, a made-up id is not', () => {
    expect(processAlive(process.pid)).toBe(true);
    expect(processAlive(2 ** 22 - 3)).toBe(false);
  });
  it('a lock left by a dead process on this machine is taken over immediately (automatic restart after a crash)', () => {
    const lock = path.join(dir, 'server.lock');
    fs.writeFileSync(lock, JSON.stringify({ id: 'crashed', pid: 2 ** 22 - 3, host: os.hostname() })); // fresh mtime, but no such process
    expect(() => open()).not.toThrow();
  });
  it('a fresh lock from another machine, or from a live process here, is respected', () => {
    const lock = path.join(dir, 'server.lock');
    fs.writeFileSync(lock, JSON.stringify({ id: 'other-host', pid: 1234, host: 'some-other-machine' }));
    expect(() => DataStore.open({ dataDir: dir, log: quiet })).toThrow(/some-other-machine/);
    fs.writeFileSync(lock, JSON.stringify({ id: 'alive', pid: process.pid, host: os.hostname() }));
    expect(() => DataStore.open({ dataDir: dir, log: quiet })).toThrow(LockError);
  });
  it('FORCE_UNLOCK takes over a live-looking lock', () => {
    open();
    expect(() => DataStore.open({ dataDir: dir, log: quiet, forceUnlock: true })).not.toThrow();
  });
  it('a server that lost its lock refuses to write (503) instead of corrupting data', async () => {
    const { base, put, store } = await start();
    await put({ baseVersion: 0, data: emptyData(), entries: [] });
    fs.writeFileSync(path.join(dir, 'server.lock'), JSON.stringify({ id: 'someone-else', pid: 1, host: 'other' }));
    const r = await put({ baseVersion: 1, data: seedData(), entries: [] });
    expect(r.status).toBe(503);
    expect((await (await fetch(`${base}/api/state`)).json()).data.people).toHaveLength(0);
    expect(store.version).toBe(1);
  });
});

describe('backups and damaged files', () => {
  const backups = () => fs.readdirSync(path.join(dir, 'backups')).filter((f) => f.endsWith('.json')).sort();
  it('writes a backup at startup when data exists, then on schedule, and prunes old ones', async () => {
    let t = Date.UTC(2026, 10, 7, 8, 0, 0);
    let s = open({ now: () => t, backupEveryMs: 3600_000, keepBackups: 3 });
    const { put } = await start(s);
    await put({ baseVersion: 0, data: seedData(), entries: [] });
    expect(backups()).toHaveLength(1); // first save has no previous state to copy... the commit itself triggers a scheduled one
    for (let v = 1; v <= 6; v++) { t += 2 * 3600_000; await put({ baseVersion: v, data: seedData(), entries: [] }); }
    expect(backups().length).toBe(3); // pruned
    expect(backups().at(-1)).toMatch(/^state-20261107-\d{6}-v7\.json$/);
    stores.pop()!.close(); await new Promise((r) => servers.pop()!.close(r));
    t += 3 * 3600_000;
    s = open({ now: () => t, backupEveryMs: 3600_000, keepBackups: 3 }); // restart: another one at startup
    expect(backups().at(-1)).toMatch(/-v7\.json$/);
  });
  it('backupBefore keeps the previous state before a restore overwrites it', async () => {
    const { put } = await start(open({ backupEveryMs: 1e12 }));
    await put({ baseVersion: 0, data: seedData(), entries: [] });
    await put({ baseVersion: 1, data: emptyData(), entries: [entry('שוחזר', null, 'system')], backupBefore: true });
    const all = backups().map((f) => JSON.parse(fs.readFileSync(path.join(dir, 'backups', f), 'utf8')));
    expect(all.some((b) => b.data.people.length === 16)).toBe(true); // the state from before the restore is on disk
    expect(JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8')).data.people).toHaveLength(0);
  });
  it('a damaged state file stops the server with a pointer to the backups instead of starting empty', () => {
    fs.writeFileSync(path.join(dir, 'state.json'), '{"version": 3, "data": {"people": 5}}');
    expect(() => DataStore.open({ dataDir: dir, log: quiet })).toThrow(/damaged/);
    expect(fs.existsSync(path.join(dir, 'server.lock'))).toBe(false); // lock released after the failed start
  });
  it('skips an unreadable line in the log without losing the rest', () => {
    fs.writeFileSync(path.join(dir, 'audit.jsonl'), `${JSON.stringify({ id: 1, at: '2026-01-01T00:00:00Z', actor: 'a', kind: 'person', entityId: '1', personId: 1, summary: 's', details: [] })}\n{broken\n`);
    expect(open().audit).toHaveLength(1);
  });
});
