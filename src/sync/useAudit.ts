import { useEffect, useMemo, useState } from 'react';
import type { AuditEntry } from '../domain/types';
import { filterAudit, type AuditFilter } from '../logic/auditFilter';
import { useStore } from '../store/store';
import { apiGetJson, useSync } from './sync';

export interface AuditResult { entries: AuditEntry[]; total: number; loading: boolean; error: boolean }

/** The change log: from the browser in local mode, from the server in server mode (refreshed when data changes). */
export function useAudit(filter: AuditFilter): AuditResult {
  const mode = useSync((s) => s.mode);
  const version = useSync((s) => s.version);
  const local = useStore((s) => s.audit);
  const key = JSON.stringify(filter);
  const localResult = useMemo(() => filterAudit([...local], filter), [local, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const [remote, setRemote] = useState<{ entries: AuditEntry[]; total: number; loading: boolean; error: boolean }>({ entries: [], total: 0, loading: true, error: false });

  useEffect(() => {
    if (mode !== 'server') return;
    let cancelled = false;
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filter)) if (v !== undefined && v !== '') qs.set(k, String(v));
    apiGetJson<{ entries: AuditEntry[]; total: number }>(`/api/audit?${qs}`)
      .then((r) => { if (!cancelled) setRemote({ entries: r.entries, total: r.total, loading: false, error: false }); })
      .catch(() => { if (!cancelled) setRemote((p) => ({ ...p, loading: false, error: true })); });
    return () => { cancelled = true; };
  }, [mode, version, key]); // eslint-disable-line react-hooks/exhaustive-deps

  return mode === 'server' ? remote : { ...localResult, loading: false, error: false };
}
