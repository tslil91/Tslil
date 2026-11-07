import { useMemo, useState } from 'react';
import { LogRow } from '../../components/LogRow';
import { PageHeader, SearchBox } from '../../components/PageHeader';
import { downloadWorkbook } from '../../io/excel';
import { AUDIT_KINDS, AUDIT_KIND_LABELS, type AuditFilter } from '../../logic/auditFilter';
import { auditSheet } from '../../logic/sheets';
import { todayISO } from '../../domain/dates';
import type { AuditKind } from '../../domain/types';
import { useAudit } from '../../sync/useAudit';

const LIMIT = 500;

/** Who changed what and when. Filters by text, type, user and dates; exportable. */
export function HistoryView() {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('');
  const [actor, setActor] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const filter: AuditFilter = { q: q || undefined, kind: (kind || undefined) as AuditKind | undefined, actor: actor || undefined, from: from || undefined, to: to || undefined, limit: LIMIT };
  const log = useAudit(filter);
  // user names seen so far (so the list does not shrink while a user filter is active)
  const everyone = useAudit({ limit: 2000 });
  const actors = useMemo(() => [...new Set(everyone.entries.map((e) => e.actor))].sort((a, b) => a.localeCompare(b, 'he')), [everyone.entries]);
  const filtered = !!(q || kind || actor || from || to);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader title="יומן שינויים" subtitle={log.loading ? 'טוען…' : `${log.total} רישומים${log.total > log.entries.length ? ` · מוצגים ${log.entries.length} האחרונים` : ''}`}>
        <SearchBox value={q} onChange={setQ} placeholder="חיפוש בתיאור השינוי" />
        <button type="button" className="btn" disabled={log.entries.length === 0} onClick={() => void downloadWorkbook(`change-log-${todayISO()}`, [auditSheet(log.entries)])}>ייצוא ל־Excel</button>
      </PageHeader>

      <div className="flex shrink-0 flex-wrap items-center gap-2.5 px-3.5 py-2">
        <label htmlFor="h-kind" className="text-[13px] font-semibold">סוג:</label>
        <select id="h-kind" className="input w-[130px]" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="">הכל</option>
          {AUDIT_KINDS.map((k) => <option key={k} value={k}>{AUDIT_KIND_LABELS[k]}</option>)}
        </select>
        <label htmlFor="h-actor" className="text-[13px] font-semibold">משתמש:</label>
        <select id="h-actor" className="input w-[150px]" value={actor} onChange={(e) => setActor(e.target.value)}>
          <option value="">כולם</option>
          {actors.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <label htmlFor="h-from" className="text-[13px] font-semibold">מתאריך:</label>
        <input id="h-from" type="date" className="input w-[150px]" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
        <label htmlFor="h-to" className="text-[13px] font-semibold">עד תאריך:</label>
        <input id="h-to" type="date" className="input w-[150px]" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
        {filtered && <button type="button" className="btn" onClick={() => { setQ(''); setKind(''); setActor(''); setFrom(''); setTo(''); }}>נקה סינון</button>}
      </div>

      <div className="mx-3.5 mb-3 min-h-0 flex-1 overflow-y-auto rounded border border-line bg-surface px-4 py-1">
        {log.error && <p role="alert" className="m-0 py-6 text-sm text-danger">לא ניתן לטעון את היומן מהשרת.</p>}
        {!log.loading && !log.error && log.entries.length === 0 && (
          <p className="m-0 py-10 text-center text-[15px] text-muted">{filtered ? 'לא נמצאו רישומים התואמים לסינון.' : 'עדיין לא נרשמו שינויים. כל שינוי בנתונים יופיע כאן.'}</p>
        )}
        <ul className="m-0 list-none p-0">{log.entries.map((e) => <LogRow key={e.id} e={e} showPerson />)}</ul>
      </div>
    </div>
  );
}
