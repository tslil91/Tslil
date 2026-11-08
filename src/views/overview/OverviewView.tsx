import { useMemo } from 'react';
import { Bar, Card, ReleaseChart, plural } from '../../components/charts';
import { PageHeader } from '../../components/PageHeader';
import { rangeFilter, todayISO } from '../../domain/dates';
import { billetTurnover, educationProgress, officerPrograms, releasesByMonth } from '../../logic/overview';
import type { Filters } from '../../logic/people';
import { useStore } from '../../store/store';
import { AttentionCard, QualityCard } from './Attention';
import { isActivePerson } from '../../domain/rules';

/** Separate screen: summary charts. Clicking a bar opens the personnel table already filtered. */
export function OverviewView() {
  const { people: allPeople, billets, assignments, setPendingPeopleFilter } = useStore();
  const people = useMemo(() => allPeople.filter(isActivePerson), [allPeople]);
  const today = todayISO();

  const releases = useMemo(() => releasesByMonth(people, today, 12), [people, today]);
  const education = useMemo(() => educationProgress(people), [people]);
  const programs = useMemo(() => officerPrograms(people), [people]);
  const turnover = useMemo(() => billetTurnover(billets, assignments, today, 10), [billets, assignments, today]);

  const officerCount = people.filter((p) => p.rank === 'officer').length;
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
          <AttentionCard />
          <QualityCard />
          <Card wide title="שחרורים קרובים — 12 החודשים הבאים (כל כוח האדם)" subtitle={`${plural(totalReleases, 'אדם אחד', 'אנשים')} · לחיצה על עמודה מציגה את המשתחררים באותו חודש`}>
            <ReleaseChart months={releases} onPick={(m) => show({ releaseDate: rangeFilter(m.from, m.to) }, `מוצגים השחרורים של ${m.label}`)} />
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
