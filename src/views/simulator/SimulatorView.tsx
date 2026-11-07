import { PageHeader } from '../../components/PageHeader';

/** Side feature. The snapshot engine and time slider are the next development phase (see docs/ARCHITECTURE.md §3). */
export function SimulatorView() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <PageHeader title="סימולטור ציר זמן" subtitle="כלי נוסף · אינו משנה נתונים אמיתיים" />
      <div className="m-3.5 rounded border border-dashed border-line2 bg-surface p-8">
        <h2 className="m-0 mb-2 text-lg font-bold">בפיתוח — השלב הבא</h2>
        <p className="m-0 max-w-[640px] text-sm leading-relaxed text-muted">
          הסימולטור יאפשר לבחור תאריך בעבר או בעתיד ולראות את מצב המדורים, התקנים והעל־תקניים באותו יום,
          ולתכנן שיבוצים בתרחיש נפרד שאינו משנה את הנתונים. העיצוב המאושר מופיע באב־הטיפוס.
        </p>
      </div>
    </div>
  );
}
