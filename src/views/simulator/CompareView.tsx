import { useMemo, useState, type ReactNode } from 'react';
import { Card, plural } from '../../components/charts';
import { addDays, formatDate, todayISO } from '../../domain/dates';
import { compareSnapshots } from '../../logic/compare';
import { snapshot } from '../../logic/simulator';
import { personHref } from '../../nav';
import { useStore } from '../../store/store';

const List = ({ empty, children }: { empty: string; children: ReactNode[] }) => (children.length === 0
  ? <p className="m-0 text-[13px] text-muted">{empty}</p>
  : <ul className="m-0 list-none p-0">{children.map((c, i) => <li key={i} className="flex flex-wrap items-baseline gap-1.5 border-b border-line py-1.5 text-[13px]">{c}</li>)}</ul>);

const Person = ({ id, name }: { id: number; name: string }) => <a href={personHref(id)} className="font-bold text-ink underline">{name}</a>;

/** What is different between the organization on two dates. */
export function CompareView() {
  const s = useStore();
  const today = todayISO();
  const [a, setA] = useState(today);
  const [b, setB] = useState(addDays(today, 90));
  const [withScenario, setWithScenario] = useState(true);
  const valid = !!a && !!b;

  const data = { people: s.people, billets: s.billets, assignments: s.assignments, sections: s.sections, commanders: s.commanders, sectionHistory: s.sectionHistory };
  const cmp = useMemo(() => {
    if (!valid) return null;
    const ops = withScenario ? s.scenario : [];
    return compareSnapshots(snapshot(data, ops, a), snapshot(data, ops, b));
  }, [valid, a, b, withScenario, s.people, s.billets, s.assignments, s.sections, s.commanders, s.sectionHistory, s.scenario]); // eslint-disable-line react-hooks/exhaustive-deps

  const preset = (from: string, to: string) => ({ onClick: () => { setA(from); setB(to); } });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-3.5">
        <section aria-label="בחירת תאריכים" className="flex flex-wrap items-end gap-3 rounded border border-line bg-surface p-4">
          <div className="flex flex-col gap-1"><label htmlFor="cmp-a" className="label">תאריך א׳ (מ־)</label><input id="cmp-a" type="date" className="input input-lg w-[170px]" value={a} onChange={(e) => setA(e.target.value)} /></div>
          <div className="flex flex-col gap-1"><label htmlFor="cmp-b" className="label">תאריך ב׳ (עד)</label><input id="cmp-b" type="date" className="input input-lg w-[170px]" value={b} onChange={(e) => setB(e.target.value)} /></div>
          <button type="button" className="btn h-[38px]" onClick={() => { setA(b); setB(a); }}>החלפה ⇄</button>
          <span className="mx-1 h-8 w-px bg-line2" />
          <button type="button" className="btn h-[38px]" {...preset(today, addDays(today, 90))}>היום ← 90 יום</button>
          <button type="button" className="btn h-[38px]" {...preset(today, addDays(today, 365))}>היום ← שנה</button>
          <button type="button" className="btn h-[38px]" {...preset(addDays(today, -365), today)}>לפני שנה ← היום</button>
          <span className="flex-1" />
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" className="h-4 w-4 accent-primary" checked={withScenario} onChange={(e) => setWithScenario(e.target.checked)} />כולל השינויים המתוכננים בתרחיש ({s.scenario.length})</label>
        </section>

        {cmp && (
          <>
            <Card wide title={`${formatDate(a)} ← ${formatDate(b)}`} subtitle={cmp.changes === 0 ? 'אין הבדלים בין שני התאריכים' : `${plural(cmp.changes, 'הבדל אחד', 'הבדלים')}`}>
              <table className="w-full border-collapse text-[13px]">
                <thead><tr className="border-b-2 border-line2 text-start text-xs text-muted"><th className="py-1.5 text-start font-semibold">מדד</th><th className="text-start font-semibold">{formatDate(a)}</th><th className="text-start font-semibold">{formatDate(b)}</th><th className="text-start font-semibold">שינוי</th></tr></thead>
                <tbody>
                  {cmp.kpis.map((k) => (
                    <tr key={k.label} className="border-b border-line">
                      <td className="py-1.5 font-semibold">{k.label}</td><td>{k.a}</td><td>{k.b}</td>
                      <td className={`font-bold ${k.delta === 0 ? 'text-muted' : ''}`} dir="ltr" style={{ textAlign: 'right' }}>{k.delta > 0 ? `+${k.delta}` : k.delta === 0 ? '—' : k.delta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <div className="grid grid-cols-2 gap-3.5">
              <Card title="עברו מדור" subtitle={String(cmp.moved.length)}>
                <List empty="אף אחד לא החליף מדור.">{cmp.moved.map((m) => <><Person id={m.person.id} name={m.person.name} /><span className="text-muted">{m.from} ← {m.to}</span></>)}</List>
              </Card>
              <Card title="שינויים בתקנים" subtitle={String(cmp.billets.length)}>
                <List empty="אין שינוי באיוש התקנים.">{cmp.billets.map((x) => (
                  <><a href={`#/billets?q=${x.billetId}`} className="font-bold text-ink underline">תקן {x.billetId}</a>
                    <span className="text-muted">{x.kind === 'filled' ? `אויש: ${x.to}` : x.kind === 'vacated' ? `התפנה (היה: ${x.from})` : `${x.from} ← ${x.to}`}</span></>))}
                </List>
              </Card>
              <Card title="עזבו את הארגון (שחרור)" subtitle={String(cmp.left.length)}>
                <List empty="אף אחד לא עוזב.">{cmp.left.map((m) => <><Person id={m.person.id} name={m.person.name} /><span className="text-muted">{m.person.degree} · {m.group}</span></>)}</List>
              </Card>
              <Card title="הצטרפו לארגון" subtitle={String(cmp.arrived.length)}>
                <List empty="אף אחד לא מצטרף.">{cmp.arrived.map((m) => <><Person id={m.person.id} name={m.person.name} /><span className="text-muted">{m.person.degree} · {m.group}</span></>)}</List>
              </Card>
              <Card title="נכנסו לעל תקני" subtitle={String(cmp.benchEntered.length)}>
                <List empty="אף אחד לא נכנס לעל תקני.">{cmp.benchEntered.map((p) => <><Person id={p.id} name={p.name} /><span className="text-muted">{p.degree}</span></>)}</List>
              </Card>
              <Card title="יצאו מעל תקני" subtitle={String(cmp.benchLeft.length)}>
                <List empty="אף אחד לא יצא מעל תקני.">{cmp.benchLeft.map((p) => <><Person id={p.id} name={p.name} /><span className="text-muted">{p.degree}</span></>)}</List>
              </Card>
            </div>
            <p className="m-0 text-xs leading-relaxed text-muted">חברות במדורים בעבר נקבעת לפי היסטוריית המדורים שנרשמה במערכת; לפני שהחלה להירשם — לפי המדור הנוכחי. מינויי מפקדים אינם נכללים בהשוואה.</p>
          </>
        )}
      </div>
    </div>
  );
}
