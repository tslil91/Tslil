import { useMemo, useState, type ReactNode } from 'react';
import { Card, plural } from '../../components/charts';
import { formatDate, todayISO } from '../../domain/dates';
import { GRANT_TYPE_LABELS } from '../../logic/grants';
import { attentionItems } from '../../logic/attention';
import { dataIssues, type Issue, type IssueTarget } from '../../logic/quality';
import { personHref, sectionHref } from '../../nav';
import { useLocalSetting } from '../../hooks/useLocalSetting';
import { useStore } from '../../store/store';
import { pickData } from '../../domain/data';

const SHOW = 6;

function Group({ title, count, empty, children }: { title: string; count: number; empty: string; children: ReactNode[] }) {
  const [all, setAll] = useState(false);
  return (
    <section aria-label={title} className="flex flex-col gap-1">
      <div className="flex items-center gap-2"><h3 className="m-0 text-[13px] font-bold">{title}</h3><span className={`chip ${count ? 'chip-accent' : 'chip-neutral'}`}>{count}</span></div>
      {count === 0 ? <p className="m-0 text-xs text-muted">{empty}</p> : (
        <ul className="m-0 list-none p-0">
          {(all ? children : children.slice(0, SHOW)).map((c, i) => <li key={i} className="flex items-baseline gap-1.5 border-b border-line py-1 text-[12.5px] leading-snug">{c}</li>)}
        </ul>
      )}
      {count > SHOW && <button type="button" className="w-fit text-xs font-semibold text-accent underline" onClick={() => setAll((v) => !v)}>{all ? 'הצג פחות' : `הצג את כל ${count}`}</button>}
    </section>
  );
}

const PersonLink = ({ id, name }: { id: number; name: string }) => <a href={personHref(id)} className="font-bold text-ink underline">{name}</a>;
const BilletLink = ({ id }: { id: number }) => <a href={`#/billets?q=${id}`} className="font-semibold text-ink underline">תקן {id}</a>;
/** 12 days → "12 ימים"; 200 days → "כ־6 חודשים"; 3750 days → "כ־10 שנים". */
const duration = (days: number) => (days < 60 ? plural(days, 'יום אחד', 'ימים') : days < 730 ? `כ־${Math.round(days / 30)} חודשים` : `כ־${Math.round(days / 365)} שנים`);
const inDays = (d: number) => (d < 0 ? `באיחור של ${plural(-d, 'יום אחד', 'ימים')}` : d === 0 ? 'היום' : `בעוד ${plural(d, 'יום אחד', 'ימים')}`);

/** Things that need a decision soon, computed from the data. Thresholds are personal settings. */
export function AttentionCard() {
  const s = useStore();
  const today = todayISO();
  const [windowDays, setWindowDays] = useLocalSetting<number>('att-window', 90);
  const [benchDays, setBenchDays] = useLocalSetting<number>('att-bench', 60);
  const r = useMemo(() => attentionItems(pickData(s), today, { windowDays, benchDays, grantDays: 180 }), [s.people, s.billets, s.assignments, s.grants, windowDays, benchDays, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (value: number, set: (n: number) => void, options: number[], label: string) => (
    <label className="flex items-center gap-1.5 text-xs text-muted">{label}
      <select className="input h-7 w-[78px]" value={value} onChange={(e) => set(Number(e.target.value))}>{options.map((o) => <option key={o} value={o}>{o} יום</option>)}</select>
    </label>
  );
  return (
    <Card wide title="דורש תשומת לב" subtitle={r.total === 0 ? 'אין פריטים פתוחים' : `${plural(r.total, 'פריט אחד', 'פריטים')} · מחושב מהנתונים הנוכחיים`}
      action={<div className="flex gap-3">{pick(windowDays, setWindowDays, [30, 60, 90, 180], 'חלון קדימה')}{pick(benchDays, setBenchDays, [30, 60, 90, 120], 'על תקני מעל')}</div>}>
      <div className="grid grid-cols-3 gap-x-6 gap-y-4">
        <Group title="משתחררים בקרוב ועדיין בתקן" count={r.releasing.length} empty="אין משובצים שמשתחררים בחלון הזמן.">
          {r.releasing.map((x) => <><PersonLink id={x.person.id} name={x.person.name} /><span className="text-muted">· <BilletLink id={x.billetId} /> · {inDays(x.days)} ({formatDate(x.person.releaseDate)})</span></>)}
        </Group>
        <Group title="תקנים פנויים" count={r.vacant.length} empty="כל התקנים מאוישים.">
          {r.vacant.map((x) => <><BilletLink id={x.billet.id} /><span className="text-muted">· {x.billet.scope === 'int' ? 'פנימי' : 'חיצוני'} · {x.billet.kind === 'fix' ? 'קבוע' : 'זמני'} · {x.sinceDays === null ? 'לא אויש מעולם' : `פנוי מזה ${duration(x.sinceDays)}`}</span></>)}
        </Group>
        <Group title="על תקני לאורך זמן" count={r.benchLong.length} empty={`אין קבע על תקני מעל ${benchDays} ימים.`}>
          {r.benchLong.map((x) => <><PersonLink id={x.person.id} name={x.person.name} /><span className="text-muted">· {x.person.degree} · {duration(x.days)}</span></>)}
        </Group>
        <Group title={'דמ"ח של קצינים'} count={r.dmah.length} empty={'אין זכאויות דמ"ח קרובות או באיחור.'}>
          {r.dmah.map((x) => <><PersonLink id={x.person.id} name={x.person.name} /><span className="text-muted">· דמ"ח {x.level} · {formatDate(x.date)} · <span className={x.days < 0 ? 'font-semibold text-danger' : ''}>{inDays(x.days)}</span></span></>)}
        </Group>
        <Group title="חתימות מענק שמסתיימות (180 יום)" count={r.grants.length} empty="אין חתימות שמסתיימות בקרוב.">
          {r.grants.map((x) => <>{x.person ? <PersonLink id={x.person.id} name={x.person.name} /> : <span>—</span>}<span className="text-muted">· {GRANT_TYPE_LABELS[x.grant.type]} · {formatDate(x.end)} · {inDays(x.days)}</span></>)}
        </Group>
      </div>
    </Card>
  );
}

const targetHref = (t: IssueTarget): string => (t.kind === 'person' ? personHref(t.id) : t.kind === 'billet' ? `#/billets?q=${t.id}` : t.kind === 'section' ? sectionHref(t.id) : '#/people');

/** Consistency checks over the data: errors (cannot be right) and warnings (worth a look). */
export function QualityCard() {
  const s = useStore();
  const today = todayISO();
  const issues = useMemo(() => dataIssues(pickData(s), today), [s.sections, s.people, s.commanders, s.billets, s.assignments, s.grants, s.notes, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const [filter, setFilter] = useState<'all' | Issue['severity']>('all');
  const [all, setAll] = useState(false);
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warns = issues.length - errors;
  const shown = issues.filter((i) => filter === 'all' || i.severity === filter);
  const list = all ? shown : shown.slice(0, 8);
  return (
    <Card wide title="בדיקות תקינות נתונים" subtitle={issues.length === 0 ? 'לא נמצאו בעיות' : `${plural(errors, 'שגיאה אחת', 'שגיאות')} · ${plural(warns, 'אזהרה אחת', 'אזהרות')}`}
      action={issues.length > 0 && (
        <div role="group" aria-label="סינון לפי חומרה" className="inline-flex gap-0.5 rounded bg-soft p-[3px]">
          {([['all', `הכל (${issues.length})`], ['error', `שגיאות (${errors})`], ['warn', `אזהרות (${warns})`]] as const).map(([v, l]) => (
            <button key={v} type="button" aria-pressed={filter === v} onClick={() => setFilter(v)} className={`h-7 rounded px-3 text-xs font-semibold ${filter === v ? 'bg-surface text-ink shadow' : 'text-muted'}`}>{l}</button>
          ))}
        </div>
      )}>
      {issues.length === 0 && <p className="m-0 text-sm text-[#14532d]">✔ הנתונים עקביים: מפקדים מונו, אין כפל שיבוצים, הדרגות והתאריכים תקינים.</p>}
      <ul className="m-0 list-none p-0">
        {list.map((i) => (
          <li key={i.id} className="flex items-center gap-2 border-b border-line py-1.5 text-[13px]">
            <span className={`chip ${i.severity === 'error' ? 'bg-danger text-white' : 'bg-[#fdf0d5] text-[#6b3f00]'}`}>{i.severity === 'error' ? 'שגיאה' : 'אזהרה'}</span>
            <span className="flex-1">{i.message}</span>
            <a href={targetHref(i.target)} className="text-xs font-semibold text-accent underline">לתיקון</a>
          </li>
        ))}
      </ul>
      {shown.length > 8 && <button type="button" className="w-fit text-xs font-semibold text-accent underline" onClick={() => setAll((v) => !v)}>{all ? 'הצג פחות' : `הצג את כל ${shown.length}`}</button>}
    </Card>
  );
}
