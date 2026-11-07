import type { AuditEntry, AuditKind } from '../domain/types';

export interface AuditFilter {
  personId?: number;
  kind?: AuditKind;
  actor?: string;
  /** Free text, matched against the summary and the details. */
  q?: string;
  /** Inclusive dates (YYYY-MM-DD) compared with the day of the entry. */
  from?: string;
  to?: string;
  limit?: number;
}

export const AUDIT_KINDS: AuditKind[] = ['person', 'section', 'billet', 'grant', 'note', 'commander', 'system'];
export const AUDIT_KIND_LABELS: Record<AuditKind, string> = {
  person: 'אנשים', section: 'מדורים', billet: 'תקנים', grant: 'מענקים', note: 'הערות', commander: 'מפקדים', system: 'מערכת',
};

/** Newest first. `total` is the number of matches before the limit is applied. Used by both the browser and the server. */
export function filterAudit(entries: AuditEntry[], f: AuditFilter): { entries: AuditEntry[]; total: number } {
  const q = f.q?.trim();
  const matches = entries.filter((e) => {
    if (f.personId !== undefined && e.personId !== f.personId) return false;
    if (f.kind && e.kind !== f.kind) return false;
    if (f.actor && e.actor !== f.actor) return false;
    const day = e.at.slice(0, 10);
    if (f.from && day < f.from) return false;
    if (f.to && day > f.to) return false;
    if (q && !e.summary.includes(q) && !e.details.some((d) => d.label.includes(q) || d.from.includes(q) || d.to.includes(q))) return false;
    return true;
  });
  const limit = Math.max(1, Math.min(f.limit ?? 200, 2000));
  const sorted = matches.sort((a, b) => b.id - a.id);
  return { entries: sorted.slice(0, limit), total: matches.length };
}
