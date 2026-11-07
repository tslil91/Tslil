import { useMemo, type ReactNode } from 'react';
import { PageHeader } from '../../components/PageHeader';
import { rangeFilter, todayISO } from '../../domain/dates';
import { billetTurnover, educationProgress, officerPrograms, releasesByMonth } from '../../logic/overview';
import type { Filters } from '../../logic/people';
import { useStore } from '../../store/store';

/** Hebrew singular / plural: one → "קצין אחד", otherwise "N קצינים". */
const plural = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);

function Card({ title, subtitle, children, wide }: { title: string; subtitle?: string; children: ReactNode; wide?: boolean }) {
  return (
    <section aria-label={title} className={`flex flex-col gap-3 rounded border border-line bg-surface p-4 ${wide ? 'col-span-2' : ''}`}>
      <div className="flex flex-col">
        <h2 className="m-0 text-[15px] font-bold">{title}</h2>
        {subtitle && <span className="text-xs text-muted">{subtitle}</span>}
      </div>
      {children}
    </section>
  );
}

/** A horizontal bar: label, track with fill, value text. */
function Bar({ label, sub, value, max, text, muted, onClick, hint }: { label: string; sub?: string; value: number; max: number; text: string; muted?: boolean; onClick?: () => void; hint?: string }) {
  const pct = max > 0 ? Math.max(value > 0 ? 3 : 0, (value / max) * 100) : 0;
  const inner = (
    <>
      <span className="flex w-[118px] shrink-0 flex-col text-start">
        <span className="truncate text-[13px] font-semibold">{label}</span>
        {sub && <span className="truncate text-[11px] text-muted">{sub}</span>}
      </span>
      <span className="relative h-5 flex-1 overflow-hidden rounded-sm bg-soft" aria-hidden="true">
        <span className={`absolute inset-y-0 start-0 rounded-sm ${muted ? 'bg-line2' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="w-[150px] shrink-0 text-start text-[13px] font-bold">{text}</span>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} title={hint} className="flex min-h-9 w-full items-center gap-2 rounded px-1 hover:bg-soft">{inner}</button>
  ) : (
    <div className="flex min-h-9 items-center gap-2 px-1">{inner}</div>
  );
}

/** Separate screen: summary charts. Clicking a bar opens the personnel table already filtered. */
export function OverviewView() {
  const { people, billets, assignments, setPendingPeopleFilter } = useStore();
  const today = todayISO();

  const releases = useMemo(() => releasesByMonth(people, today, 12), [people, today]);
  const education = useMemo(() => educationProgress(people), [people]);
  const programs = useMemo(() => officerPrograms(people), [people]);
  const turnover = useMemo(() => billetTurnover(billets, assignments, today, 10), [billets, assignments, today]);

  const officerCount = people.filter((p) => p.rank === 'officer').length;
  const maxRelease = Math.max(1, ...releases.map((m) => m.count));
  const maxProgram = Math.max(1, ...programs.map((p) => p.count));
  const maxTurnover = Math.max(1, ...turnover.map((t) => t.occupants));
  const totalReleases = releases.reduce((s, m) => s + m.count, 0);

  /** Go to the personnel screen with these filters applied. */
  const show = (filters: Filters, message: string) => {
    setPendingPeopleFilter({ filters, message });
    window.location.hash = '#/people';
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader title="תמונת מצב" subtitle={`${people.length} אנשים · ${billets.length} תקנים · לחיצה על גרף פותחת את טבלת כוח האדם מסוננת`} />
      <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
        <div className="mx-auto grid max-w-[1180px] grid-cols-2 gap-3.5">
          <Card wide title="שחרורים קרובים — 12 החודשים הבאים (כל כוח האדם)" subtitle={`${plural(totalReleases, 'אדם אחד', 'אנשים')} · לחיצה על עמודה מציגה את המשתחררים באותו חודש`}>
            <div className="flex h-[190px] items-end gap-1.5 border-b border-line2 px-1">
              {releases.map((m) => {
                const h = m.count === 0 ? 0 : Math.max(8, (m.count / maxRelease) * 136);
                return (
                  <button key={m.key} type="button" disabled={m.count === 0}
                    aria-label={`${m.label}: ${plural(m.count, 'שחרור אחד', 'שחרורים')}${m.count ? ' — הצג בטבלה' : ''}`}
                    onClick={() => show({ releaseDate: rangeFilter(m.from, m.to) }, `מוצגים השחרורים של ${m.label}`)}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-1 rounded-t enabled:hover:bg-soft disabled:cursor-default">
                    <span className="text-[13px] font-bold">{m.count || ''}</span>
                    <span className={`w-full max-w-[48px] rounded-t-sm ${m.count ? 'bg-primary' : ''}`} style={{ height: h }} />
                  </button>
                );
              })}
            </div>
            <div className="flex gap-1.5 px-1" aria-hidden="true">
              {releases.map((m) => <span key={m.key} className="flex-1 text-center text-[11px] text-muted">{m.label}</span>)}
            </div>
          </Card>

          <Card title="השכלה והסמכות" subtitle="כל מי שהשדה רלוונטי עבורו · לחיצה מציגה מי שעדיין חסר/ה">
            <div className="flex flex-col gap-0.5">
              {education.map((p) => (
                <Bar key={p.key} label={p.label} sub={p.who} value={p.yes} max={p.total}
                  text={`${p.yes} מתוך ${p.total}${p.total ? ` (${Math.round((p.yes / p.total) * 100)}%)` : ''}`}
                  onClick={p.total - p.yes > 0 ? () => show({ [p.key]: 'no' }, `מי שעדיין חסרה לו ${p.label}`) : undefined}
                  hint={p.total - p.yes > 0 ? `הצג את ${p.total - p.yes} שחסר/ה להם` : undefined} />
              ))}
            </div>
          </Card>

          <Card title="תוכניות — קצינים בלבד" subtitle={`${plural(officerCount, 'קצין אחד', 'קצינים')} · עתודה, אקדמזיציה, פיון, תלפיות, פסגות · לחיצה מסננת את הטבלה`}>
            <div className="flex flex-col gap-0.5">
              {programs.map((p) => (
                <Bar key={p.label} label={p.label} value={p.count} max={maxProgram} text={plural(p.count, 'קצין אחד', 'קצינים')} muted={p.program === null}
                  onClick={p.count > 0 ? () => show({ rank: 'officer', program: p.program ?? 'none' }, `קצינים: ${p.label}`) : undefined} />
              ))}
            </div>
          </Card>

          <Card wide title="תחלופת תקנים" subtitle="כמה אנשים כיהנו בכל תקן לאורך ההיסטוריה (10 התקנים עם התחלופה הגבוהה ביותר) וממוצע שנות הכהונה">
            {turnover.length === 0 ? <p className="m-0 text-sm text-muted">אין עדיין היסטוריית שיבוץ.</p> : (
              <div className="grid grid-cols-2 gap-x-8 gap-y-0.5">
                {turnover.map((t) => (
                  <Bar key={t.billetId} label={`תקן ${t.billetId}`} value={t.occupants} max={maxTurnover}
                    text={`${plural(t.occupants, 'מכהן אחד', 'מכהנים')} · ממוצע ${t.avgYears.toFixed(1)} שנים${t.vacantNow ? ' · פנוי' : ''}`} muted={t.vacantNow} />
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
