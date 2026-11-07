import { useMemo, useState } from 'react';
import { Dialog } from '../../components/Dialog';
import { IconX } from '../../components/Icons';
import { PageHeader } from '../../components/PageHeader';
import { addDays, daysBetween, formatDate, todayISO } from '../../domain/dates';
import { POP_LABELS } from '../../domain/rules';
import { assignError, changePoints, snapshot, type PersonAtDate } from '../../logic/simulator';
import { useStore } from '../../store/store';
import { CompareView } from './CompareView';

const RANGE = 730; // ± two years around today
const WEEKDAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

/** Side tool: see the organization on any date and plan what-if moves in a separate scenario. */
export function SimulatorView() {
  const s = useStore();
  const today = todayISO();
  const [panel, setPanel] = useState<'day' | 'compare'>('day');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [pending, setPending] = useState<{ personId: number; billetId: number } | null>(null);
  const date = addDays(today, offset);

  const data = { people: s.people, billets: s.billets, assignments: s.assignments, sections: s.sections, commanders: s.commanders, sectionHistory: s.sectionHistory };
  const snap = useMemo(() => snapshot(data, s.scenario, date), [s.people, s.billets, s.assignments, s.sections, s.commanders, s.sectionHistory, s.scenario, date]);
  const points = useMemo(() => changePoints(data, s.scenario).map((d) => daysBetween(today, d)).filter((o) => o > -RANGE && o < RANGE), [s.assignments, s.people, s.scenario, today]);

  const selectedOnBench = selected !== null && snap.bench.some((b) => b.person.id === selected) ? selected : null;
  const nameOf = (id: number) => s.people.find((p) => p.id === id)?.name ?? '';
  const vacant = snap.billets.filter((b) => !b.occupant);
  const prev = [...points].reverse().find((o) => o < offset);
  const next = points.find((o) => o > offset);
  const mode = offset < 0 ? 'past' : offset > 0 ? 'future' : 'today';
  const rel = offset === 0 ? 'היום' : offset < 0 ? `לפני ${-offset} ימים` : `בעוד ${offset} ימים`;
  const weekday = WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];

  const goTo = (iso: string) => {
    if (!iso) return;
    setOffset(Math.max(-RANGE, Math.min(RANGE, daysBetween(today, iso))));
  };

  const confirmAssign = () => {
    if (!pending) return;
    const err = assignError(snap, pending.personId, pending.billetId);
    if (err) { s.showToast(err); setPending(null); return; }
    s.addScenarioOp({ kind: 'assign', personId: pending.personId, billetId: pending.billetId, date });
    s.showToast(`בתרחיש: ${nameOf(pending.personId)} ← תקן ${pending.billetId} מ־${formatDate(date)}`);
    setPending(null);
    setSelected(null);
  };

  const release = (p: PersonAtDate) => {
    s.addScenarioOp({ kind: 'release', personId: p.person.id, date });
    s.showToast(`בתרחיש: ${p.person.name} עובר/ת לעל תקני מ־${formatDate(date)}`);
  };

  const pendingNext = pending ? snap.billets.find((b) => b.billet.id === pending.billetId)?.next : null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader title="סימולטור ציר זמן" subtitle="כלי נוסף · התרחיש נשמר בנפרד ואינו משנה את הנתונים האמיתיים">
        <div role="group" aria-label="מצב הסימולטור" className="inline-flex gap-0.5 rounded bg-soft p-[3px]">
          {([['day', 'מצב ביום נבחר'], ['compare', 'השוואת שני תאריכים']] as const).map(([m, l]) => (
            <button key={m} type="button" aria-pressed={panel === m} onClick={() => setPanel(m)}
              className={`h-8 rounded px-3 text-[13px] font-semibold ${panel === m ? 'bg-surface text-ink shadow' : 'text-muted'}`}>{l}</button>
          ))}
        </div>
        <dl className="m-0 flex items-center gap-4 text-[13px] text-muted">
          {[['תקנים', snap.kpis.billets, ''], ['מאוישים', snap.kpis.filled, ''], ['פנויים', snap.kpis.vacant, 'text-danger'], ['על תקני', snap.kpis.bench, 'text-[#3730a3]'], ['בארגון', snap.kpis.present, '']].map(([l, n, c]) => (
            <div key={l} className="flex items-baseline gap-1"><dt>{l}</dt><dd className={`m-0 text-base font-bold text-ink ${c}`}>{n}</dd></div>
          ))}
        </dl>
      </PageHeader>
      {panel === 'compare' ? <CompareView /> : (
        <>

      {/* Time panel */}
      <section aria-label="בחירת תאריך" className="mx-3.5 mt-2.5 flex shrink-0 flex-col gap-0.5 rounded border border-line bg-surface px-4 pt-2.5 pb-1">
        <div className="flex items-center gap-3">
          <button type="button" className="btn" disabled={prev === undefined} onClick={() => prev !== undefined && setOffset(prev)}>‹ שינוי קודם</button>
          <div className="flex items-baseline gap-2.5">
            <span className="text-[22px] font-bold">{weekday} {formatDate(date)}</span>
            <span className="text-sm text-muted">{rel}</span>
          </div>
          <button type="button" className="btn" disabled={next === undefined} onClick={() => next !== undefined && setOffset(next)}>שינוי הבא ›</button>
          <label className="flex items-center gap-1.5 text-[13px] text-muted">
            קפיצה לתאריך
            <input type="date" className="input w-[150px]" value={date} min={addDays(today, -RANGE)} max={addDays(today, RANGE)} onChange={(e) => goTo(e.target.value)} />
          </label>
          <span className="flex-1" />
          {mode === 'past' && <span className="chip h-7 bg-[#fdf0d5] px-3 text-[#6b3f00]">מצב היסטורי</span>}
          {mode === 'future' && <span className="chip h-7 bg-[#e6e9fb] px-3 text-[#2f2a8c]">תחזית</span>}
          <button type="button" className="btn" disabled={offset === 0} onClick={() => setOffset(0)}>חזרה להיום</button>
        </div>
        <div className="relative h-11">
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3.5 left-3.5">
            {points.map((o) => <span key={o} className="absolute top-3 h-5 w-0.5 translate-x-1/2 rounded bg-muted/70" style={{ right: `${((o + RANGE) / (2 * RANGE)) * 100}%` }} />)}
            <span className="absolute top-2 h-7 w-[3px] translate-x-1/2 rounded bg-accent" style={{ right: '50%' }} />
          </div>
          <input type="range" className="sim-slider relative h-11 w-full" dir="rtl" min={-RANGE} max={RANGE} step={1} value={offset}
            aria-label="ציר זמן" aria-valuetext={formatDate(date)} onChange={(e) => setOffset(Number(e.target.value))} />
        </div>
        <div className="flex justify-between px-1 pb-1 text-xs text-muted"><span>עבר ←</span><span>הקווים מסמנים תאריכי שינוי · הקו הכתום = היום</span><span>→ עתיד</span></div>
      </section>

      {selectedOnBench !== null && (
        <div className="mx-3.5 mt-2 flex shrink-0 items-center gap-3 rounded bg-[#14532d] px-3.5 py-2 text-white">
          <span className="flex-1 text-sm font-semibold">משבץ בתרחיש: {nameOf(selectedOnBench)} — בחר/י תקן פנוי ברשימה</span>
          <button type="button" className="btn" onClick={() => setSelected(null)}>ביטול בחירה</button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-3.5 p-3.5">
        {/* sections */}
        <div className="grid min-h-0 min-w-0 flex-1 auto-rows-min gap-3 overflow-y-auto" style={{ gridTemplateColumns: `repeat(${snap.groups.length}, minmax(0, 1fr))` }}>
          {snap.groups.map((g) => (
            <section key={g.id} aria-label={g.name} className="flex flex-col gap-1.5 rounded border border-line bg-surface p-2.5">
              <div className="flex items-center gap-2 pb-1">
                <h2 className="m-0 flex-1 text-[14px] font-bold">{g.name}</h2>
                <span className="chip chip-neutral">{g.people.length}</span>
              </div>
              {g.people.map((p) => (
                <div key={p.person.id} className={`flex items-center gap-1.5 rounded border px-2 py-1.5 ${p.isCommander ? 'border-2 border-primary' : 'border-line'}`}>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px] font-semibold">{p.person.name}</span>
                    <span className="text-xs text-muted">
                      {p.person.degree} · {POP_LABELS[p.person.pop]}
                      {p.releaseInDays !== null && <span className="font-semibold text-[#8a4b00]"> · משתחרר/ת בעוד {p.releaseInDays} ימים</span>}
                    </span>
                  </span>
                  {p.person.pop === 'keva' && (p.billet
                    ? <span className={`chip ${p.fromScenario ? 'bg-[#d9f2e3] text-[#14532d]' : 'chip-neutral'}`}>{p.fromScenario ? 'מתוכנן ' : ''}תקן {p.billet}</span>
                    : <span className="chip chip-bench">על תקני</span>)}
                  {p.billet !== null && (
                    <button type="button" className="icon-btn h-6 w-6" title="העברה לעל תקני בתרחיש" aria-label={`העברת ${p.person.name} לעל תקני בתרחיש`} onClick={() => release(p)}><IconX size={12} /></button>
                  )}
                </div>
              ))}
              {g.people.length === 0 && <p className="m-0 text-[13px] text-muted">אין אנשים בתאריך זה.</p>}
            </section>
          ))}
        </div>

        {/* side column */}
        <aside className="flex w-[300px] shrink-0 flex-col gap-3 overflow-y-auto">
          <section aria-label="על תקני" className="flex flex-col gap-1.5 rounded border border-line bg-surface p-2.5">
            <div className="flex items-center gap-2"><h2 className="m-0 flex-1 text-[14px] font-bold">על תקני</h2><span className="chip chip-bench">{snap.bench.length}</span></div>
            <p className="m-0 text-xs text-muted">בחר/י אדם ואז תקן פנוי כדי לתכנן שיבוץ מהתאריך הנבחר.</p>
            {snap.bench.map((b) => (
              <button key={b.person.id} type="button" aria-pressed={selectedOnBench === b.person.id} onClick={() => setSelected(selectedOnBench === b.person.id ? null : b.person.id)}
                className={`flex min-h-11 items-center gap-2 rounded border-[1.5px] px-2.5 text-start ${selectedOnBench === b.person.id ? 'border-[#15803d] bg-[#ecfdf3]' : 'border-transparent bg-bg hover:bg-soft'}`}>
                <span className="flex flex-1 flex-col"><span className="text-[13px] font-bold">{b.person.name}</span><span className="text-xs text-muted">{b.person.degree} · {s.sections.find((x) => x.id === b.person.sectionId)?.name ?? 'כפוף ישירות'}</span></span>
              </button>
            ))}
            {snap.bench.length === 0 && <p className="m-0 text-[13px] text-muted">אין קבע על תקני בתאריך זה.</p>}
          </section>

          <section aria-label="תקנים פנויים" className="flex flex-col gap-1.5 rounded border border-line bg-surface p-2.5">
            <div className="flex items-center gap-2"><h2 className="m-0 flex-1 text-[14px] font-bold">תקנים פנויים</h2><span className="chip chip-neutral">{vacant.length}</span></div>
            {vacant.map((b) => {
              const target = selectedOnBench !== null;
              return (
                <div key={b.billet.id} className={`flex items-center gap-2 rounded border px-2.5 py-1.5 ${target ? 'border-2 border-[#15803d] bg-[#ecfdf3]' : 'border-dashed border-line2'}`}>
                  <span className="flex flex-1 flex-col">
                    <span className="text-[13px] font-bold">תקן {b.billet.id}</span>
                    <span className="text-xs text-muted">{b.billet.scope === 'int' ? 'פנימי' : 'חיצוני'} · {b.billet.kind === 'fix' ? 'קבוע' : 'זמני'}{b.billet.dmah ? ' · דמ"ח' : ''}</span>
                    {b.next && <span className="text-xs font-medium text-[#3730a3]">מתוכנן: {b.next.personId !== null ? nameOf(b.next.personId) : b.next.personName} מ־{formatDate(b.next.start)}</span>}
                  </span>
                  {target && <button type="button" className="btn btn-primary h-7" onClick={() => setPending({ personId: selectedOnBench!, billetId: b.billet.id })}>שבץ כאן</button>}
                </div>
              );
            })}
            {vacant.length === 0 && <p className="m-0 text-[13px] text-muted">כל התקנים מאוישים בתאריך זה.</p>}
          </section>

          <section aria-label="התרחיש" className="flex flex-col gap-1.5 rounded border border-line bg-surface p-2.5">
            <div className="flex items-center gap-2">
              <h2 className="m-0 flex-1 text-[14px] font-bold">התרחיש ({s.scenario.length} שינויים)</h2>
              {s.scenario.length > 0 && <button type="button" className="btn h-7" onClick={() => { s.clearScenario(); s.showToast('התרחיש נוקה'); }}>ניקוי</button>}
            </div>
            {s.scenario.length === 0 && <p className="m-0 text-[13px] text-muted">עדיין לא תוכננו שינויים. התרחיש אינו משנה את מסכי כוח אדם ותקנים.</p>}
            {[...s.scenario].sort((a, b) => (a.date < b.date ? -1 : 1)).map((o) => (
              <div key={o.id} className="flex items-center gap-2 border-b border-line py-1 text-[13px]">
                <button type="button" className="flex-1 text-start hover:underline" onClick={() => goTo(o.date)} title="מעבר לתאריך">
                  <strong>{formatDate(o.date)}</strong> · {nameOf(o.personId)} {o.kind === 'assign' ? `← תקן ${o.billetId}` : '← על תקני'}
                </button>
                <button type="button" className="icon-btn h-6 w-6" aria-label="הסרת השינוי מהתרחיש" title="הסרה" onClick={() => s.removeScenarioOp(o.id)}><IconX size={12} /></button>
              </div>
            ))}
          </section>
        </aside>
      </div>

        </>
      )}

      {pending && (
        <Dialog title="שיבוץ בתרחיש" width={440} onClose={() => setPending(null)}
          footer={<>
            <button type="button" className="btn h-[38px]" onClick={() => setPending(null)}>ביטול</button>
            <button type="button" className="btn btn-primary h-[38px] px-5" onClick={confirmAssign} data-autofocus>אישור</button>
          </>}>
          <div className="flex flex-col gap-3 text-sm">
            <p className="m-0"><strong>{nameOf(pending.personId)}</strong> ← <strong>תקן {pending.billetId}</strong></p>
            <p className="m-0">מתאריך: <strong>{formatDate(date)}</strong></p>
            {pendingNext && (
              <p className="m-0 rounded bg-[#fdf0d5] px-3 py-2 text-[13px] text-[#6b3f00]">
                בתקן מתוכנן מחליף מ־{formatDate(pendingNext.start)} — השיבוץ בתרחיש יסתיים בתאריך זה.
              </p>
            )}
            <p className="m-0 text-xs text-muted">השינוי נשמר בתרחיש בלבד ואינו משנה את הנתונים האמיתיים.</p>
          </div>
        </Dialog>
      )}
    </div>
  );
}
