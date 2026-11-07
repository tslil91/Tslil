import { dataChanged, pickData } from '../domain/data';
import type { AppData } from '../domain/types';
import { diffData, type AuditDraft } from '../logic/audit';
import { runtime, trackerHooks, useStore } from './store';

/**
 * Watches the shared data. After every change it works out a readable list of what changed:
 * - local mode: appended to the local change log;
 * - server mode: handed to the sync layer, which sends it to the server together with the new data.
 */
type Handler = (entries: AuditDraft[]) => void;

let baseline: AppData = pickData(useStore.getState());
let suppress = false;
let installed = false;
let serverHandler: Handler | null = null;

export function installChangeTracking(): void {
  if (installed) return;
  installed = true;
  useStore.subscribe((state) => {
    const next = pickData(state);
    if (!dataChanged(baseline, next)) return;
    const before = baseline;
    baseline = next;
    if (suppress) return;
    const entries = trackerHooks.override ?? diffData(before, next);
    trackerHooks.override = null;
    if (entries.length === 0) return;
    if (runtime.serverMode && serverHandler) serverHandler(entries);
    else useStore.getState().appendAudit(entries);
  });
}

/** Connect (or disconnect) the server sync layer. */
export function setServerHandler(h: Handler | null): void { serverHandler = h; }

/** Load data that came from outside (the server): replaces local data without logging a change. */
export function applyRemoteData(data: AppData): void {
  suppress = true;
  try {
    useStore.setState({ ...data });
    baseline = pickData(useStore.getState());
  } finally {
    suppress = false;
  }
}

/** Forget the current baseline (after a bulk replace that should not be logged). */
export function resetBaseline(): void { baseline = pickData(useStore.getState()); }
