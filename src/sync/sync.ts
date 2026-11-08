import { create } from 'zustand';
import { pickData } from '../domain/data';
import type { AppData } from '../domain/types';
import type { AuditDraft } from '../logic/audit';
import { applyRemoteData, setServerHandler } from '../store/changes';
import { runtime, useStore } from '../store/store';

export type SyncStatus = 'online' | 'offline';
interface SyncState {
  mode: 'local' | 'server';
  status: SyncStatus;
  /** Version of the data on the server that this browser has. Changes whenever data is saved or pulled. */
  version: number;
  /** Changes made here that the server has not confirmed yet. */
  unsaved: number;
  server: { host: string; dataDir: string; backups: number; lastBackupAt: string | null; auditCount: number } | null;
}
export const useSync = create<SyncState>(() => ({ mode: 'local', status: 'online', version: 0, unsaved: 0, server: null }));
const set = (p: Partial<SyncState>) => useSync.setState(p);

const POLL_MS = 4000;
const RETRY_MS = 3000;

async function api(path: string, init: { method?: string; body?: unknown; timeoutMs?: number } = {}): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 10_000);
  try {
    return await fetch(path, {
      method: init.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', 'X-Actor': encodeURIComponent(useStore.getState().actor) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: ctrl.signal,
      cache: 'no-store',
    });
  } finally { clearTimeout(timer); }
}

export const apiGetJson = async <T>(path: string): Promise<T> => {
  const r = await api(path);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<T>;
};

// ----- start up

let bootPromise: Promise<{ mode: 'local' | 'server'; needsInit: boolean }> | null = null;

/** Decide between server mode (the page is served by our server) and local mode (demo in the browser). Runs once. */
export function bootstrap() {
  bootPromise ??= (async () => {
    // opened straight from a file (the standalone html): there is no server to ask
    if (window.location.protocol === 'file:') return { mode: 'local' as const, needsInit: false };
    try {
      const h = await api('/api/health', { timeoutMs: 2500 });
      const body = h.ok ? ((await h.json()) as { app?: string }) : null;
      if (body?.app !== 'personnel-billets') return { mode: 'local' as const, needsInit: false };
    } catch { return { mode: 'local' as const, needsInit: false }; }

    runtime.serverMode = true;
    set({ mode: 'server' });
    const { version, data } = await apiGetJson<{ version: number; data: AppData | null }>('/api/state');
    set({ version });
    if (data === null) return { mode: 'server' as const, needsInit: true };
    applyRemoteData(data);
    startSync();
    void refreshInfo();
    return { mode: 'server' as const, needsInit: false };
  })();
  return bootPromise;
}

/** First run of an empty server: store the starting data set. */
export async function initializeServer(data: AppData, summary: string): Promise<void> {
  const r = await api('/api/state', { method: 'PUT', body: { baseVersion: 0, data, entries: [{ kind: 'system', entityId: 'system', personId: null, summary, details: [] }] } });
  if (r.status === 409) throw new Error('השרת כבר אותחל על ידי משתמש אחר. רענן/י את הדף.');
  if (!r.ok) throw new Error(`השמירה בשרת נכשלה (${r.status})`);
  const { version } = (await r.json()) as { version: number };
  set({ version });
  applyRemoteData(data);
  startSync();
  void refreshInfo();
}

export async function refreshInfo(): Promise<void> {
  try { set({ server: await apiGetJson('/api/info') }); } catch { /* shown when the connection returns */ }
}

// ----- saving and polling

const pending: AuditDraft[] = [];
let flushing = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

async function pull(): Promise<void> {
  const { version, data } = await apiGetJson<{ version: number; data: AppData | null }>('/api/state');
  if (data) applyRemoteData(data);
  set({ version, status: 'online' });
}

async function flush(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    while (pending.length > 0) {
      const entries = pending.splice(0);
      const body = { baseVersion: useSync.getState().version, data: pickData(useStore.getState()), entries, backupBefore: entries.some((e) => e.kind === 'system') };
      let res: Response;
      try {
        res = await api('/api/state', { method: 'PUT', body });
      } catch {
        pending.unshift(...entries);
        set({ status: 'offline', unsaved: pending.length });
        scheduleRetry();
        return;
      }
      if (res.ok) {
        set({ version: ((await res.json()) as { version: number }).version, status: 'online', unsaved: pending.length });
      } else if (res.status === 409) {
        // Someone else saved first. Show their version; this change was not applied.
        pending.length = 0;
        await pull();
        set({ unsaved: 0 });
        useStore.getState().showToast('משתמש אחר שמר שינויים לפני כן. הנתונים רועננו והשינוי האחרון שלך לא נשמר — נא לבצע אותו שוב.');
      } else {
        pending.unshift(...entries);
        set({ status: 'offline', unsaved: pending.length });
        useStore.getState().showToast(res.status === 503 ? 'השרת אינו מורשה לכתוב לתיקיית הנתונים (שרת אחר פעיל?)' : `השמירה בשרת נכשלה (${res.status})`);
        scheduleRetry();
        return;
      }
    }
  } finally { flushing = false; }
}

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => { retryTimer = null; void flush(); }, RETRY_MS);
}

async function poll(): Promise<void> {
  if (flushing || pending.length > 0) return;
  try {
    const { version } = await apiGetJson<{ version: number }>('/api/version');
    if (useSync.getState().status === 'offline') set({ status: 'online' });
    if (version !== useSync.getState().version) { await pull(); void refreshInfo(); }
  } catch { set({ status: 'offline' }); }
}

function startSync(): void {
  if (started) return;
  started = true;
  setServerHandler((entries) => { pending.push(...entries); set({ unsaved: pending.length }); void flush(); });
  setInterval(() => void poll(), POLL_MS);
  window.addEventListener('beforeunload', (e) => { if (pending.length > 0 || flushing) { e.preventDefault(); e.returnValue = ''; } });
}

/** For tests and diagnostics. */
export const _internal = { pending };
