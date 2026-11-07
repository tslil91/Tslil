import { useState } from 'react';
import type { AuditEntry } from '../domain/types';
import { personHref } from '../nav';

export const when = (iso: string) => new Date(iso).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' });

export function LogRow({ e, showPerson = false }: { e: AuditEntry; showPerson?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b border-line py-2">
      <div className="flex items-start gap-2">
        <span className="w-[116px] shrink-0 text-xs text-muted">{when(e.at)}</span>
        <span className="min-w-0 flex-1 text-[13px] leading-snug">{e.summary}{showPerson && e.personId !== null && <a href={personHref(e.personId)} className="ms-2 text-xs font-semibold text-accent underline">לדף האדם</a>}</span>
        <span className="shrink-0 text-xs font-semibold text-muted">{e.actor}</span>
        {e.details.length > 0 && (
          <button type="button" className="shrink-0 text-xs font-semibold text-accent underline" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? 'הסתר' : 'פרטים'}</button>
        )}
      </div>
      {open && (
        <ul className="m-0 mt-1.5 list-none rounded bg-bg p-2 ps-3">
          {e.details.map((d, i) => (
            <li key={i} className="text-xs"><strong>{d.label}:</strong> {d.from ? `${d.from} ← ` : ''}{d.to || '—'}</li>
          ))}
        </ul>
      )}
    </li>
  );
}

