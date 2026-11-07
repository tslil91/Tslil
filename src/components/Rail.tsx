import { useMemo, useState, type ReactNode } from 'react';
import { pickData } from '../domain/data';
import { todayISO } from '../domain/dates';
import { dataIssues } from '../logic/quality';
import type { Route } from '../nav';
import { useStore } from '../store/store';
import { useSync } from '../sync/sync';
import { DataDialog } from './DataDialog';
import { Dialog } from './Dialog';
import { ActorForm } from './Boot';
import { IconBillet, IconChart, IconClock, IconDatabase, IconGift, IconHistory, IconPeople, IconUser } from './Icons';

const MAIN: { route: Route; label: string; icon: ReactNode }[] = [
  { route: 'people', label: 'כוח אדם', icon: <IconPeople size={20} /> },
  { route: 'billets', label: 'תקנים', icon: <IconBillet size={20} /> },
  { route: 'grants', label: 'מענקים ותמריצים', icon: <IconGift size={20} /> },
  { route: 'overview', label: 'תמונת מצב', icon: <IconChart size={20} /> },
  { route: 'history', label: 'יומן שינויים', icon: <IconHistory size={20} /> },
];

function NavLink({ route, label, icon, active, badge }: { route: Route; label: string; icon: ReactNode; active: boolean; badge?: number }) {
  return (
    <a
      href={`#/${route}`}
      aria-label={badge ? `${label} (${badge} שגיאות נתונים)` : label}
      title={badge ? `${label} · ${badge} שגיאות נתונים` : label}
      aria-current={active ? 'page' : undefined}
      className={`relative flex h-12 w-12 items-center justify-center rounded-md text-white no-underline hover:bg-white/10 ${active ? 'bg-white/15' : ''}`}
    >
      {icon}
      {badge ? <span aria-hidden="true" className="absolute top-1 left-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold">{badge}</span> : null}
    </a>
  );
}

/** Narrow icon rail on the right (RTL inline-start). */
export function Rail({ current }: { current: Route }) {
  const actor = useStore((s) => s.actor);
  const setActor = useStore((s) => s.setActor);
  const { mode, status, unsaved } = useSync();
  const s = useStore();
  const errorCount = useMemo(() => dataIssues(pickData(s), todayISO()).filter((i) => i.severity === 'error').length, [s.sections, s.people, s.commanders, s.billets, s.assignments, s.grants, s.notes]); // eslint-disable-line react-hooks/exhaustive-deps
  const [data, setData] = useState(false);
  const [who, setWho] = useState(false);
  // a person or section page belongs to the "people" item of the menu
  const group: Route = current === 'person' || current === 'section' ? 'people' : current;
  const state = mode === 'local' ? { c: 'bg-white/40', t: 'מצב מקומי: הנתונים נשמרים בדפדפן זה בלבד' }
    : status === 'online' ? { c: 'bg-[#4ade80]', t: unsaved ? 'שומר…' : 'מחובר לשרת · הנתונים נשמרים' } : { c: 'bg-[#f87171]', t: 'אין חיבור לשרת' };
  return (
    <nav aria-label="ניווט ראשי" className="flex w-[72px] shrink-0 flex-col items-center gap-1.5 bg-nav px-2 py-3.5 text-white">
      <span className="pb-3 text-center text-[13px] font-bold">גדוד 51</span>
      {MAIN.map((m) => <NavLink key={m.route} {...m} active={group === m.route} badge={m.route === 'overview' ? errorCount : undefined} />)}
      <div className="my-2.5 h-px w-10 bg-white/20" />
      <NavLink route="simulator" label="סימולטור (כלי נוסף)" icon={<IconClock size={20} />} active={group === 'simulator'} />
      <span className="flex-1" />
      <span role="status" title={state.t} aria-label={state.t} className="flex h-6 items-center"><span className={`h-2.5 w-2.5 rounded-full ${state.c}`} /></span>
      <button type="button" title="ניהול נתונים: גיבוי ושחזור" aria-label="ניהול נתונים: גיבוי ושחזור" onClick={() => setData(true)}
        className="flex h-10 w-10 items-center justify-center rounded-md text-white/80 hover:bg-white/10"><IconDatabase size={18} /></button>
      <button type="button" title={`משתמש: ${actor || 'לא הוגדר'} (לחיצה לשינוי)`} aria-label={`משתמש: ${actor || 'לא הוגדר'}. שינוי שם`} onClick={() => setWho(true)}
        className="flex h-10 w-10 flex-col items-center justify-center rounded-md text-white/80 hover:bg-white/10"><IconUser size={18} /></button>
      {data && <DataDialog onClose={() => setData(false)} />}
      {who && (
        <Dialog title="שינוי שם משתמש" width={420} onClose={() => setWho(false)} footer={<button type="button" className="btn h-[38px]" onClick={() => setWho(false)}>סגירה</button>}>
          <ActorForm initial={actor} submitLabel="שמירה" onDone={(n) => { setActor(n); setWho(false); }} />
        </Dialog>
      )}
    </nav>
  );
}
