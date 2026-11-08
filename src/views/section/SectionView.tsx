import { useMemo } from 'react';
import { Bar, Card, ReleaseChart, plural } from '../../components/charts';
import { PageHeader } from '../../components/PageHeader';
import { rangeFilter, todayISO } from '../../domain/dates';
import { LADDER, POP_LABELS, RANK_LABELS, degreeIndex } from '../../domain/rules';
import type { PersonRow } from '../../domain/types';
import { downloadWorkbook } from '../../io/excel';
import { billetByPerson } from '../../logic/billets';
import { releasesByMonth } from '../../logic/overview';
import { comparePeople, DEFAULT_SORT } from '../../logic/people';
import { peopleSheet } from '../../logic/sheets';
import { go, personHref } from '../../nav';
import { useStore } from '../../store/store';

/** One page per section (or for those directly under the head of the organization, id "org"). */
export function SectionView({ id }: { id?: string | null }) {
  const s = useStore();
  const today = todayISO();
  const sectionId = id === 'org' ? null : id ?? null;
  const section = sectionId ? s.sections.find((x) => x.id === sectionId) ?? null : null;
  const isOrg = id === 'org';
  const exists = isOrg || !!section;
  const name = isOrg ? 'רע"ן וכפופים ישירות' : section?.name ?? '';

  const billetOf = useMemo(() => billetByPerson(s.assignments), [s.assignments]);
  const members: PersonRow[] = useMemo(() => s.people.filter((p) => p.sectionId === sectionId).map((p) => ({ ...p, billet: billetOf.get(p.id) ?? null })), [s.people, sectionId, billetOf]);
  const cmdId = isOrg ? s.commanders.org : sectionId ? s.commanders.sections[sectionId] ?? null : null;
  const sorted = useMemo(() => {
    const list = [...members].sort(comparePeople(DEFAULT_SORT));
    return [...list.filter((m) => m.id === cmdId), ...list.filter((m) => m.id !== cmdId)];
  }, [members, cmdId]);
  const commander = s.people.find((p) => p.id === cmdId) ?? null;

  const releases = useMemo(() => releasesByMonth(members, today, 12), [members, today]);
  const degreeCounts = useMemo(() => LADDER.map((d) => ({ d, n: members.filter((m) => m.degree === d).length })).filter((x) => x.n > 0).reverse(), [members]);
  const maxDegree = Math.max(1, ...degreeCounts.map((x) => x.n));
  const pops = (['keva', 'hova', 'civ'] as const).map((p) => ({ p, n: members.filter((m) => m.pop === p).length }));
  const bench = members.filter((m) => m.pop === 'keva' && m.billet === null);
  const onBillets = members.filter((m) => m.billet !== null);
  const soon = releases.reduce((a, m) => a + m.count, 0);

  if (!exists) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader title="מדור" subtitle="לא נמצא" />
        <div className="m-3.5 rounded border border-line bg-surface p-8 text-sm"><p className="m-0 mb-3">המדור לא נמצא (ייתכן שנמחק).</p><a href="#/people" className="btn btn-primary no-underline">חזרה לכוח אדם</a></div>
      </div>
    );
  }

  const showInTable = () => { s.setPendingPeopleFilter({ filters: { section: sectionId ?? 'none' }, message: `מוצגים אנשי ${name}` }); go('#/people'); };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader title={name} subtitle={`${plural(members.length, 'אדם אחד', 'אנשים')} · ${commander ? `${isOrg ? 'רע"ן' : 'מפקד המדור'}: ${commander.degree} ${commander.name}` : isOrg ? 'לא מונה רע"ן' : 'לא מונה מפקד מדור'}`}>
        <a href="#/people" className="btn no-underline">‹ חזרה לכוח אדם</a>
        <button type="button" className="btn" onClick={showInTable}>פתיחה בטבלה</button>
        <button type="button" className="btn" onClick={() => void downloadWorkbook(`section-${today}`, [peopleSheet(sorted, s.sections, s.commanders)])}>ייצוא ל־Excel</button>
      </PageHeader>

      <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
        <div className="mx-auto grid max-w-[1180px] grid-cols-2 gap-3.5">
          <Card wide title="סיכום">
            <dl className="m-0 grid grid-cols-5 gap-3">
              {[['אנשים', members.length], ...pops.map(({ p, n }) => [POP_LABELS[p], n]), ['על תקני (קבע)', bench.length]].map(([l, n]) => (
                <div key={l as string} className="rounded bg-bg px-3 py-2"><dt className="text-xs text-muted">{l}</dt><dd className="m-0 text-xl font-bold">{n}</dd></div>
              ))}
            </dl>
          </Card>

          <Card title="חברי המדור" subtitle="המפקד ראשון, אחריו לפי דרגה (גבוה → נמוך)">
            {sorted.length === 0 ? <p className="m-0 text-sm text-muted">אין אנשים במדור.</p> : (
              <ul className="m-0 list-none p-0">
                {sorted.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 border-b border-line py-1.5 text-[13px]">
                    <a href={personHref(m.id)} className="min-w-[110px] font-bold text-ink underline">{m.name}</a>
                    {m.id === cmdId && <span className="chip chip-cmd">{isOrg ? 'רע"ן' : 'מפקד המדור'}</span>}
                    <span className="flex-1 text-muted">{m.degree} · {RANK_LABELS[m.rank]}</span>
                    <span className={`chip chip-${m.pop}`}>{POP_LABELS[m.pop]}</span>
                    {m.pop === 'keva' && (m.billet ? <a className="chip chip-neutral no-underline" href={`#/billets?q=${m.billet}`}>תקן {m.billet}</a> : <span className="chip chip-bench">על תקני</span>)}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="התפלגות דרגות">
            {degreeCounts.length === 0 ? <p className="m-0 text-sm text-muted">אין נתונים.</p> : (
              <div className="flex flex-col gap-0.5">
                {degreeCounts.map(({ d, n }) => <Bar key={d} label={d} value={n} max={maxDegree} text={plural(n, 'אחד', 'אנשים')} labelWidth={70} textWidth={80} />)}
              </div>
            )}
          </Card>

          <Card wide title="שחרורים קרובים במדור — 12 החודשים הבאים" subtitle={`${plural(soon, 'אדם אחד', 'אנשים')} · לחיצה על עמודה פותחת את הטבלה מסוננת`}>
            <ReleaseChart months={releases} height={150}
              onPick={(m) => { s.setPendingPeopleFilter({ filters: { section: sectionId ?? 'none', releaseDate: rangeFilter(m.from, m.to) }, message: `משתחררים ב${m.label} — ${name}` }); go('#/people'); }} />
          </Card>

          <Card wide title="תקנים של חברי המדור" subtitle={`${onBillets.length} משובצים בתקן · ${bench.length} על תקני`}>
            {onBillets.length === 0 ? <p className="m-0 text-sm text-muted">אף אחד מחברי המדור אינו משובץ בתקן.</p> : (
              <div className="grid grid-cols-3 gap-x-6">
                {[...onBillets].sort((a, b) => (a.billet ?? 0) - (b.billet ?? 0)).map((m) => (
                  <div key={m.id} className="flex items-center gap-2 border-b border-line py-1.5 text-[13px]">
                    <a href={`#/billets?q=${m.billet}`} className="font-bold text-ink underline">תקן {m.billet}</a>
                    <a href={personHref(m.id)} className="flex-1 text-muted underline">{m.name}</a>
                  </div>
                ))}
              </div>
            )}
            {bench.length > 0 && <p className="m-0 text-[13px] text-muted">על תקני: {bench.sort((a, b) => degreeIndex(b.degree) - degreeIndex(a.degree)).map((m) => m.name).join(' · ')}</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
