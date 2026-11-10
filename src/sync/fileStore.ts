// Shared data in ONE file on a network drive, for the standalone html opened straight from the drive.
// Uses the browser's File System Access API (Chrome / Edge). The sync layer talks to this through
// `fileApi`, which answers the same /api/* routes as the real server, so polling, conflicts and the log work unchanged.
import type { AppData, AuditEntry } from '../domain/types';
import { filterAudit, type AuditFilter } from '../logic/auditFilter';

interface Writable { write(data: string): Promise<void>; close(): Promise<void> }
export interface FileHandle {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<Writable>;
  queryPermission?(o: { mode: 'readwrite' }): Promise<string>;
  requestPermission?(o: { mode: 'readwrite' }): Promise<string>;
}
type Picker = { showOpenFilePicker?: (o?: unknown) => Promise<FileHandle[]>; showSaveFilePicker?: (o?: unknown) => Promise<FileHandle> };
const w = () => window as unknown as Picker;

export const FILE_HOST = 'קובץ משותף';
export const fileSupported = (): boolean => typeof w().showOpenFilePicker === 'function';

interface Doc { version: number; savedAt: string; data: AppData | null; audit: AuditEntry[] }
const AUDIT_CAP = 5000;

let handle: FileHandle | null = null;
let cache: { stamp: string; doc: Doc } | null = null;

// ----- remembering the chosen file in this browser (a handle survives in IndexedDB; permission may need one click again)

const idb = (): Promise<IDBDatabase> => new Promise((res, rej) => {
  const r = indexedDB.open('personnel-billets-file', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('h');
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const idbOp = async <T,>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
  const db = await idb();
  return new Promise((res, rej) => { const r = f(db.transaction('h', mode).objectStore('h')); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
};
export const rememberedFile = async (): Promise<FileHandle | null> => { try { return (await idbOp<FileHandle | undefined>('readonly', (s) => s.get('file'))) ?? null; } catch { return null; } };
const remember = async (h: FileHandle) => { try { await idbOp('readwrite', (s) => s.put(h, 'file')); } catch { /* not storable: the user picks the file again next time */ } };

export const pickExistingFile = async (): Promise<FileHandle> => (await w().showOpenFilePicker!({ types: [{ description: 'קובץ נתונים', accept: { 'application/json': ['.json'] } }] }))[0];
export const pickNewFile = (): Promise<FileHandle> => w().showSaveFilePicker!({ suggestedName: 'personnel-data.json', types: [{ description: 'קובץ נתונים', accept: { 'application/json': ['.json'] } }] });

/** Ask for read/write access (must run from a click). */
export async function grantAccess(h: FileHandle, ask: boolean): Promise<boolean> {
  if (!h.queryPermission) return true;
  if ((await h.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
  return ask && !!h.requestPermission && (await h.requestPermission({ mode: 'readwrite' })) === 'granted';
}

export async function useFile(h: FileHandle): Promise<void> { handle = h; cache = null; await remember(h); await read(); }
export const fileConnected = (): boolean => handle !== null;

// ----- reading and writing

async function read(): Promise<Doc> {
  const f = await handle!.getFile();
  const stamp = `${f.lastModified}:${f.size}`;
  if (cache?.stamp === stamp) return cache.doc;
  const text = await f.text();
  let doc: Doc;
  if (!text.trim()) doc = { version: 0, savedAt: '', data: null, audit: [] };
  else {
    const p = JSON.parse(text) as Partial<Doc>;
    if (!Number.isInteger(p.version) || !p.data || typeof p.data !== 'object') throw new Error('הקובץ שנבחר אינו קובץ נתונים של המערכת');
    doc = { version: p.version as number, savedAt: p.savedAt ?? '', data: p.data, audit: Array.isArray(p.audit) ? p.audit : [] };
  }
  cache = { stamp, doc };
  return doc;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

interface Init { method?: string; body?: unknown; actor: string }
type Draft = Omit<AuditEntry, 'id' | 'at' | 'actor'>;

/** Answers the same routes as the server (health is not needed: the sync layer knows it is in file mode). */
export async function fileApi(path: string, init: Init): Promise<Response> {
  const url = new URL(path, 'http://x');
  const method = init.method ?? 'GET';
  try {
    const doc = await read();
    if (url.pathname === '/api/version') return json(200, { version: doc.version });
    if (url.pathname === '/api/info') return json(200, { version: doc.version, auditCount: doc.audit.length, backups: 0, lastBackup: null, lastBackupAt: null, startedAt: '', dataDir: handle!.name, host: FILE_HOST });
    if (url.pathname === '/api/audit') {
      const q = url.searchParams;
      const f: AuditFilter = {};
      if (q.has('personId') && Number.isInteger(Number(q.get('personId')))) f.personId = Number(q.get('personId'));
      if (q.get('kind')) f.kind = q.get('kind') as AuditFilter['kind'];
      if (q.get('actor')) f.actor = q.get('actor')!;
      if (q.get('q')) f.q = q.get('q')!;
      if (q.get('from')) f.from = q.get('from')!;
      if (q.get('to')) f.to = q.get('to')!;
      if (q.has('limit') && Number.isInteger(Number(q.get('limit')))) f.limit = Number(q.get('limit'));
      return json(200, { ...filterAudit([...doc.audit], f), version: doc.version });
    }
    if (url.pathname === '/api/state') {
      if (method === 'GET') return json(200, { version: doc.version, data: doc.data });
      const b = init.body as { baseVersion: number; data: AppData; entries: Draft[] };
      // Someone saved since we last looked: refuse, like the server. (Two saves in the same instant can still collide: shortcut, there is no file lock.)
      if (b.baseVersion !== doc.version) return json(409, { error: 'conflict', version: doc.version });
      const at = new Date().toISOString();
      let id = doc.audit.reduce((m, e) => Math.max(m, e.id), 0) + 1;
      const added = b.entries.map((e) => ({ ...e, id: id++, at, actor: init.actor || 'משתמש' }));
      const next: Doc = { version: doc.version + 1, savedAt: at, data: b.data, audit: [...doc.audit, ...added].slice(-AUDIT_CAP) };
      const out = await handle!.createWritable();
      await out.write(JSON.stringify(next));
      await out.close();
      cache = null;
      return json(200, { version: next.version });
    }
    return json(404, { error: 'Not found' });
  } catch (e) {
    if (e instanceof SyntaxError) return json(500, { error: 'הקובץ פגום' });
    throw e; // an unreachable file looks like an unreachable server: the sync layer shows "no connection" and retries
  }
}
