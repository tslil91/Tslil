import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AppData, AuditEntry, AuditKind } from '../src/domain/types';
import { filterAudit, type AuditFilter } from '../src/logic/auditFilter';
import { mkdirs } from './mkdirs';

/**
 * File-based store designed for a shared NFS directory:
 *  - state.json is replaced atomically (write a temp file, flush it, rename over the old one);
 *  - audit.jsonl is append-only;
 *  - a lock file guarantees that only ONE server process writes to the directory at a time
 *    (two writers on NFS would corrupt it), with a heartbeat so a crashed server's lock expires;
 *  - timestamped backups of state.json are kept and pruned.
 * No database, no native modules, no network access.
 */

export interface StoreOptions {
  dataDir: string;
  /** Minimum time between automatic backups. */
  backupEveryMs?: number;
  keepBackups?: number;
  /** A lock whose heartbeat is older than this is considered abandoned. Must exceed the NFS attribute cache (~60 s). */
  staleLockMs?: number;
  heartbeatMs?: number;
  forceUnlock?: boolean;
  now?: () => number;
  log?: (msg: string) => void;
}

export class LockError extends Error {}

export type CommitInput = {
  baseVersion: number;
  data: AppData;
  entries: AuditDraft[];
  actor: string;
  /** Keep a copy of the previous state first (used before a restore). */
  backupBefore?: boolean;
};
export type AuditDraft = Omit<AuditEntry, 'id' | 'at' | 'actor'>;
export type CommitResult = { ok: true; version: number } | { ok: false; reason: 'conflict'; version: number } | { ok: false; reason: 'lock-lost' };

const KINDS: AuditKind[] = ['person', 'section', 'billet', 'grant', 'note', 'commander', 'system'];
const DATA_ARRAYS = ['sections', 'people', 'billets', 'assignments', 'grants', 'notes', 'sectionHistory'] as const;

/** Structural check only (the full validation happens in the browser before a restore). */
export function validateData(d: unknown): d is AppData {
  if (typeof d !== 'object' || d === null) return false;
  const o = d as Record<string, unknown>;
  if (!DATA_ARRAYS.every((k) => Array.isArray(o[k]))) return false;
  const c = o.commanders as Record<string, unknown> | undefined;
  return !!c && typeof c === 'object' && (c.org === null || typeof c.org === 'number') && typeof c.sections === 'object' && c.sections !== null;
}

const clean = (s: unknown, max: number): string => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);

export function validateEntries(list: unknown): AuditDraft[] | null {
  if (!Array.isArray(list) || list.length > 5000) return null;
  const out: AuditDraft[] = [];
  for (const e of list) {
    if (typeof e !== 'object' || e === null) return null;
    const r = e as Record<string, unknown>;
    if (!KINDS.includes(r.kind as AuditKind)) return null;
    if (!(r.personId === null || Number.isInteger(r.personId))) return null;
    const details = Array.isArray(r.details) ? r.details.slice(0, 60) : [];
    out.push({
      kind: r.kind as AuditKind,
      entityId: clean(r.entityId, 60),
      personId: r.personId as number | null,
      summary: clean(r.summary, 600),
      details: details.map((d) => ({ label: clean((d as Record<string, unknown>)?.label, 80), from: clean((d as Record<string, unknown>)?.from, 300), to: clean((d as Record<string, unknown>)?.to, 300) })),
    });
  }
  return out;
}

/** Is there a running process with this id on this machine? (EPERM = exists but belongs to someone else.) */
export function processAlive(pid: number): boolean {
  try { process.kill(pid, 0); } catch (e) { return (e as NodeJS.ErrnoException).code === 'EPERM'; }
  // A killed process that nobody has collected yet (a "zombie") still answers kill(0) but is not running.
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    return stat.slice(stat.lastIndexOf(')') + 2, stat.lastIndexOf(')') + 3) !== 'Z';
  } catch { return true; } // no /proc (not Linux): trust kill(0)
}

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
const stamp = (t: number) => {
  const d = new Date(t);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
};

export class DataStore {
  version = 0;
  data: AppData | null = null;
  audit: AuditEntry[] = [];
  readonly startedAt: number;

  private lockId = randomUUID();
  private heartbeat: NodeJS.Timeout | null = null;
  private lastBackupAt = 0;
  private closed = false;

  private constructor(private readonly o: Required<Omit<StoreOptions, 'log'>> & { log: (m: string) => void }) {
    this.startedAt = o.now();
  }

  static open(opts: StoreOptions): DataStore {
    const o = {
      backupEveryMs: 6 * 3600_000, keepBackups: 60, staleLockMs: 120_000, heartbeatMs: 15_000, forceUnlock: false,
      now: () => Date.now(), log: (m: string) => console.log(m), ...opts,
    };
    mkdirs(path.join(o.dataDir, 'backups'));
    const s = new DataStore(o);
    s.acquireLock();
    try { s.load(); } catch (e) { s.close(); throw e; }
    return s;
  }

  private get lockPath() { return path.join(this.o.dataDir, 'server.lock'); }
  private get statePath() { return path.join(this.o.dataDir, 'state.json'); }
  private get auditPath() { return path.join(this.o.dataDir, 'audit.jsonl'); }

  private acquireLock(): void {
    const mine = JSON.stringify({ id: this.lockId, pid: process.pid, host: os.hostname(), startedAt: new Date(this.o.now()).toISOString() });
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        fs.writeFileSync(this.lockPath, mine, { flag: 'wx' }); // atomic create: fails if it exists (also on NFS v3+)
        this.heartbeat = setInterval(() => this.beat(), this.o.heartbeatMs);
        this.heartbeat.unref();
        return;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
        let holder = 'unknown';
        let age = Infinity;
        let deadLocal = false;
        try {
          const st = fs.statSync(this.lockPath);
          age = this.o.now() - st.mtimeMs;
          const h = JSON.parse(fs.readFileSync(this.lockPath, 'utf8')) as { host?: string; pid?: number };
          holder = `${h.host ?? '?'} (pid ${h.pid ?? '?'})`;
          // Left by a process on THIS machine that no longer exists (crash / kill): safe to take over at once,
          // so an automatic restart (systemd) does not have to wait for the heartbeat to expire.
          deadLocal = h.host === os.hostname() && Number.isInteger(h.pid) && !processAlive(h.pid as number);
        } catch { /* unreadable lock: treat as stale below */ }
        if (this.o.forceUnlock || deadLocal || age > this.o.staleLockMs) {
          this.o.log(`Removing ${this.o.forceUnlock ? 'lock (forced)' : deadLocal ? `lock left by ${holder}, which is no longer running` : `stale lock held by ${holder}, last heartbeat ${Math.round(age / 1000)}s ago`}`);
          try { fs.unlinkSync(this.lockPath); } catch { /* someone else removed it */ }
          continue;
        }
        throw new LockError(`The data directory is in use by another server: ${holder}, heartbeat ${Math.round(age / 1000)}s ago. `
          + `Stop that server first. If it crashed, wait ${Math.ceil(this.o.staleLockMs / 1000)}s or start with FORCE_UNLOCK=1.`);
      }
    }
    throw new LockError('Could not acquire the data directory lock.');
  }

  private beat(): void {
    try { const t = new Date(this.o.now()); fs.utimesSync(this.lockPath, t, t); } catch (e) { this.o.log(`Lock heartbeat failed: ${(e as Error).message}`); }
  }

  /** Still the lock owner? (Another server may have taken over after a long NFS outage.) */
  private lockIsMine(): boolean {
    try { return (JSON.parse(fs.readFileSync(this.lockPath, 'utf8')) as { id?: string }).id === this.lockId; } catch { return false; }
  }

  private load(): void {
    if (fs.existsSync(this.statePath)) {
      const raw = JSON.parse(fs.readFileSync(this.statePath, 'utf8')) as { version?: number; data?: unknown };
      if (!Number.isInteger(raw.version) || !validateData(raw.data)) throw new Error(`${this.statePath} is damaged. Restore one of the files in ${path.join(this.o.dataDir, 'backups')}.`);
      this.version = raw.version as number;
      this.data = raw.data;
    }
    if (fs.existsSync(this.auditPath)) {
      const lines = fs.readFileSync(this.auditPath, 'utf8').split('\n');
      for (const l of lines) {
        if (!l.trim()) continue;
        try { this.audit.push(JSON.parse(l) as AuditEntry); } catch { this.o.log('Skipped an unreadable line in audit.jsonl'); }
      }
    }
    const existing = fs.readdirSync(path.join(this.o.dataDir, 'backups')).filter((f) => f.endsWith('.json')).sort();
    const last = existing.at(-1);
    this.lastBackupAt = last ? fs.statSync(path.join(this.o.dataDir, 'backups', last)).mtimeMs : 0;
    if (this.data) this.maybeBackup(true);
    this.o.log(`Loaded state version ${this.version}, ${this.audit.length} log entries.`);
  }

  /** Windows can refuse a rename for a moment while an antivirus or the indexer holds the file; retry briefly. */
  private renameWithRetry(from: string, to: string): void {
    for (let attempt = 0; ; attempt++) {
      try { fs.renameSync(from, to); return; } catch (e) {
        const code = (e as NodeJS.ErrnoException).code ?? '';
        if (attempt >= 6 || !['EPERM', 'EBUSY', 'EACCES'].includes(code)) throw e;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 30 * (attempt + 1));
      }
    }
  }

  private writeAtomic(file: string, content: string): void {
    const tmp = `${file}.tmp-${process.pid}`;
    const fd = fs.openSync(tmp, 'w');
    try { fs.writeFileSync(fd, content); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    this.renameWithRetry(tmp, file);
    try { const dfd = fs.openSync(path.dirname(file), 'r'); try { fs.fsyncSync(dfd); } finally { fs.closeSync(dfd); } } catch { /* directory fsync is best effort (not supported everywhere) */ }
  }

  private backup(reason: string): void {
    if (!fs.existsSync(this.statePath)) return;
    const name = `state-${stamp(this.o.now())}-v${this.version}.json`;
    fs.copyFileSync(this.statePath, path.join(this.o.dataDir, 'backups', name));
    this.lastBackupAt = this.o.now();
    this.o.log(`Backup written: ${name} (${reason})`);
    const all = fs.readdirSync(path.join(this.o.dataDir, 'backups')).filter((f) => f.endsWith('.json')).sort();
    for (const old of all.slice(0, Math.max(0, all.length - this.o.keepBackups))) fs.unlinkSync(path.join(this.o.dataDir, 'backups', old));
  }

  private maybeBackup(onStart = false): void {
    if (this.o.now() - this.lastBackupAt >= this.o.backupEveryMs) this.backup(onStart ? 'startup' : 'scheduled');
  }

  commit(input: CommitInput): CommitResult {
    if (this.closed || !this.lockIsMine()) return { ok: false, reason: 'lock-lost' };
    if (input.baseVersion !== this.version) return { ok: false, reason: 'conflict', version: this.version };
    if (input.backupBefore && this.data) this.backup('before restore');
    const version = this.version + 1;
    const at = new Date(this.o.now()).toISOString();
    const state = JSON.stringify({ version, savedAt: at, data: input.data });
    this.writeAtomic(this.statePath, state);
    let nextId = (this.audit.at(-1)?.id ?? 0) + 1;
    const added: AuditEntry[] = input.entries.map((e) => ({ ...e, id: nextId++, at, actor: clean(input.actor, 40) || 'לא ידוע' }));
    if (added.length) fs.appendFileSync(this.auditPath, added.map((e) => JSON.stringify(e)).join('\n') + '\n');
    this.version = version;
    this.data = input.data;
    this.audit.push(...added);
    this.maybeBackup();
    return { ok: true, version };
  }

  readAudit(f: AuditFilter) { return filterAudit([...this.audit], f); }

  info() {
    const dir = path.join(this.o.dataDir, 'backups');
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort() : [];
    return {
      version: this.version, auditCount: this.audit.length, backups: files.length, lastBackup: files.at(-1) ?? null,
      lastBackupAt: this.lastBackupAt ? new Date(this.lastBackupAt).toISOString() : null,
      startedAt: new Date(this.startedAt).toISOString(), dataDir: this.o.dataDir, host: os.hostname(),
    };
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.lockIsMine()) { try { fs.unlinkSync(this.lockPath); } catch { /* already gone */ } }
  }
}
