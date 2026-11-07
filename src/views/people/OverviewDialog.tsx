import { useMemo, useState, type ReactNode } from 'react';
import { Dialog } from '../../components/Dialog';
import { rangeFilter } from '../../domain/dates';
import type { Billet, BilletAssignment, Person } from '../../domain/types';
import { billetTurnover, officerPrograms, officerProgress, releasesByMonth } from '../../logic/overview';
import type { Filters } from '../../logic/people';

interface Props {
  people: Person[];
  billets: Billet[];
  assignments: BilletAssignment[];
  today: string;
  /** Replace the table filters with these and show the table. */
  onShowInTable: (filters: Filters, message: string) => void;
  onClose: () => void;
}

/** Hebrew singular / plural: one → "קצין אחד"-style text, otherwise "N קצינים". */
const plural = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);

function Card({ title, subtitle, action, children, wide }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <section aria-label={title} className={`flex flex-col gap-3 rounded border border-line bg-surface p-3.5 ${wide ? 'col-span-2' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="flex flex-1 flex-col">
          <h3 className="m-0 text-[15px] font-bold">{title}</h3>
          {subtitle && <span className="text-xs text-muted">{subtitle}</span>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A horizontal bar: label, track with fill, value text. */
function Bar({ label, value, max, text, muted, onClick, hint }: { label: string; value: number; max: number; text: string; muted?: boolean; onClick?: () => void; hint?: string }) {
  const pct = max > 0 ? Math.max(value > 0 ? 3 : 0, (value / max) * 100) : 0;
  const inner = (
    <>
      <span className="w-[104px] shrink-0 truncate text-start text-[13px] font-semibold">{label}</span>
      <span className="relative h-5 flex-1 overflow-hidden rounded-sm bg-soft" aria-hidden="true">
        <span className={`absolute inset-y-0 start-0 rounded-sm ${muted ? 'bg-line2' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="w-[120px] shrink-0 text-start text-[13px] font-bold">{text}</span>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} title={hint} className="flex min-h-8 w-full items-center gap-2 rounded px-1 hover:bg-soft">{inner}</button>
  ) : (
    <div className="flex min-h-8 items-center gap-2 px-1">{inner}</div>
  );
}

export function OverviewDialog({ people, billets, assignments, today, onShowInTable, onClose }: Props) {
  const [officersOnly, setOfficersOnly] = useState(true);
  const releases = useMemo(() => releasesByMonth(people, today, 12, officersOnly), [people, today, officersOnly]);
  const progress = useMemo(() => officerProgress(people), [people]);
  const programs = useMemo(() => officerPrograms(people), [people]);
  const turnover = useMemo(() => billetTurnover(billets, assignments, today, 10), [billets, assignments, today]);

  const officerCount = progress[0]?.total ?? 0;
  const maxRelease = Math.max(1, ...releases.map((m) => m.count));
  const maxProgram = Math.max(1, ...programs.map((p) => p.count));
  const maxTurnover = Math.max(1, ...turnover.map((t) => t.occupants));
  const totalReleases = releases.reduce((s, m) => s + m.count, 0);

  return (
    <Dialog title="תמונת מצב" width={1020} onClose={onClose}
      footer={<button type="button" className="btn btn-primary h-[38px] px-5" onClick={onClose}>סגירה</button>}>
      <div className="grid grid-cols-2 gap-3.5">
        <Card wide title="שחרורים קרובים — 12 החודשים הבאים"
          subtitle={`${officersOnly ? plural(totalReleases, 'קצין אחד', 'קצינים') : plural(totalReleases, 'אדם אחד', 'אנשים')} · לחיצה על עמודה מסננת את הטבלה לאותו חודש`}
          action={
            <div role="group" aria-label="אוכלוסיית הגרף" className="inline-flex gap-0.5 rounded bg-soft p-[3px]">
              {([[true, 'קצינים בלבד'], [false, 'כל כוח האדם']] as const).map(([v, l]) => (
                <button key={l} type="button" aria-pressed={officersOnly === v} onClick={() => setOfficersOnly(v)}
                  className={`h-7 rounded px-3 text-xs font-semibold ${officersOnly === v ? 'bg-surface text-ink shadow' : 'text-muted'}`}>{l}</button>
              ))}
            </div>
          }>
          <div className="flex h-[170px] items-end gap-1.5 border-b border-line2 px-1">
            {releases.map((m) => {
              const h = m.count === 0 ? 0 : Math.max(8, (m.count / maxRelease) * 120);
              return (
                <button key={m.key} type="button" disabled={m.count === 0}
                  aria-label={`${m.label}: ${plural(m.count, 'שחרור אחד', 'שחרורים')}${m.count ? ' — הצג בטבלה' : ''}`}
                  onClick={() => onShowInTable({ releaseDate: rangeFilter(m.from, m.to), ...(officersOnly ? { rank: 'officer' } : {}) }, `מוצגים השחרורים של ${m.label}`)}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-1 rounded-t enabled:hover:bg-soft disabled:cursor-default">
                  <span className="text-[13px] font-bold">{m.count || ''}</span>
                  <span className={`w-full max-w-[44px] rounded-t-sm ${m.count ? 'bg-primary' : ''}`} style={{ height: h }} />
                </button>
              );
            })}
          </div>
          <div className="flex gap-1.5 px-1" aria-hidden="true">
            {releases.map((m) => <span key={m.key} className="flex-1 text-center text-[11px] text-muted">{m.label}</span>)}
          </div>
        </Card>

        <Card title="השכלה והסמכות — קצינים" subtitle={`${plural(officerCount, 'קצין אחד', 'קצינים')} · לחיצה מציגה מי שעדיין חסר/ה`}>
          <div className="flex flex-col gap-0.5">
            {progress.map((p) => (
              <Bar key={p.key} label={p.label} value={p.yes} max={p.total} text={`${p.yes} מתוך ${p.total}${p.total ? ` (${Math.round((p.yes / p.total) * 100)}%)` : ''}`}
                onClick={p.total - p.yes > 0 ? () => onShowInTable({ rank: 'officer', [p.key]: 'no' }, `קצינים שעדיין חסרה להם ${p.label}`) : undefined}
                hint={p.total - p.yes > 0 ? `הצג את ${p.total - p.yes} שחסר/ה להם` : undefined} />
            ))}
          </div>
        </Card>

        <Card title="תוכניות — קצינים" subtitle="עתודה, אקדמזיציה, פיון, תלפיות, פסגות · לחיצה מסננת את הטבלה">
          <div className="flex flex-col gap-0.5">
            {programs.map((p) => (
              <Bar key={p.label} label={p.label} value={p.count} max={maxProgram} text={plural(p.count, 'קצין אחד', 'קצינים')} muted={p.program === null}
                onClick={p.count > 0 ? () => onShowInTable({ rank: 'officer', program: p.program ?? 'none' }, `קצינים: ${p.label}`) : undefined} />
            ))}
          </div>
        </Card>

        <Card wide title="תחלופת תקנים" subtitle="כמה אנשים כיהנו בכל תקן לאורך ההיסטוריה (10 התקנים עם התחלופה הגבוהה ביותר) וממוצע שנות הכהונה">
          {turnover.length === 0 ? <p className="m-0 text-sm text-muted">אין עדיין היסטוריית שיבוץ.</p> : (
            <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
              {turnover.map((t) => (
                <Bar key={t.billetId} label={`תקן ${t.billetId}`} value={t.occupants} max={maxTurnover}
                  text={`${plural(t.occupants, 'מכהן אחד', 'מכהנים')} · ממוצע ${t.avgYears.toFixed(1)} שנים${t.vacantNow ? ' · פנוי' : ''}`} muted={t.vacantNow} />
              ))}
            </div>
          )}
        </Card>
      </div>
    </Dialog>
  );
}
