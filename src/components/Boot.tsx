import { useEffect, useState, type ReactNode } from 'react';
import { emptyData } from '../domain/data';
import { parseBackup } from '../logic/backup';
import { seedData } from '../store/seed';
import { useStore } from '../store/store';
import { bootstrap, initializeServer } from '../sync/sync';

export function ActorForm({ initial, onDone, submitLabel }: { initial: string; onDone: (name: string) => void; submitLabel: string }) {
  const [name, setName] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (n.length < 2) { setError('יש להזין שם (לפחות 2 תווים).'); return; }
    onDone(n.slice(0, 40));
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label htmlFor="actor-name" className="label">השם שלך</label>
      <input id="actor-name" className="input input-lg" autoFocus value={name} maxLength={40} placeholder="למשל: דנה כהן"
        onChange={(e) => { setName(e.target.value); setError(null); }} />
      <p className="m-0 text-xs leading-relaxed text-muted">השם נרשם ביומן השינויים ליד כל שינוי שתבצע/י. אין כניסה עם סיסמה — זהו תיעוד בלבד.</p>
      {error && <p role="alert" className="m-0 text-[13px] font-semibold text-danger">{error}</p>}
      <button type="submit" className="btn btn-primary h-[42px]">{submitLabel}</button>
    </form>
  );
}

function Screen({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div dir="rtl" className="flex h-full items-center justify-center bg-bg p-6">
      <div className="flex w-[480px] max-w-full flex-col gap-4 rounded border border-line bg-surface p-6 shadow">
        <h1 className="m-0 text-xl font-bold">{title}</h1>
        {children}
      </div>
    </div>
  );
}

/** First screens of the app: connect to the server, ask for the user name, first-run data choice. */
export function Boot({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'init'>('loading');
  const [fatal, setFatal] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const actor = useStore((s) => s.actor);
  const setActor = useStore((s) => s.setActor);

  useEffect(() => {
    bootstrap().then((r) => setPhase(r.needsInit ? 'init' : 'ready')).catch((e: unknown) => setFatal(e instanceof Error ? e.message : 'שגיאה לא ידועה'));
  }, []);

  if (fatal) {
    return (
      <Screen title="לא ניתן להתחבר לשרת">
        <p role="alert" className="m-0 text-sm text-danger">{fatal}</p>
        <button type="button" className="btn btn-primary h-[42px]" onClick={() => window.location.reload()}>ניסיון חוזר</button>
      </Screen>
    );
  }
  if (phase === 'loading') return <Screen title="טוען…"><p role="status" className="m-0 text-sm text-muted">מתחבר לשרת ומעדכן נתונים</p></Screen>;
  if (!actor) return <Screen title="ברוכים הבאים"><ActorForm initial="" submitLabel="המשך" onDone={setActor} /></Screen>;

  if (phase === 'init') {
    const start = async (data: ReturnType<typeof emptyData>, summary: string) => {
      setBusy(true); setInitError(null);
      try { await initializeServer(data, summary); setPhase('ready'); } catch (e) { setInitError(e instanceof Error ? e.message : 'שגיאה'); } finally { setBusy(false); }
    };
    const fromFile = async (file: File | undefined) => {
      if (!file) return;
      const r = parseBackup(await file.text());
      if (!r.ok || !r.data) { setInitError(`קובץ הגיבוי אינו תקין: ${r.errors.slice(0, 3).join(' · ')}`); return; }
      void start(r.data, `המערכת הוקמה משחזור קובץ גיבוי (${r.counts?.people ?? 0} אנשים)`);
    };
    return (
      <Screen title="הקמת המערכת">
        <p className="m-0 text-sm leading-relaxed text-muted">השרת עדיין ריק. בחר/י כיצד להתחיל. אפשר לשחזר מגיבוי או לייבא אנשים ותקנים מקובצי Excel לאחר מכן.</p>
        <button type="button" disabled={busy} className="btn btn-primary h-[42px]" onClick={() => void start(emptyData(), 'המערכת הוקמה ריקה')}>התחלה ריקה</button>
        <label className={`btn h-[42px] cursor-pointer ${busy ? 'opacity-50' : ''}`}>
          שחזור מקובץ גיבוי
          <input type="file" accept=".json,application/json" className="sr-only" disabled={busy} onChange={(e) => { void fromFile(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
        <button type="button" disabled={busy} className="btn h-[42px]" onClick={() => void start(seedData(), 'המערכת הוקמה עם נתוני הדגמה')}>התחלה עם נתוני הדגמה (לניסוי בלבד)</button>
        {initError && <p role="alert" className="m-0 text-[13px] font-semibold text-danger">{initError}</p>}
      </Screen>
    );
  }
  return <>{children}</>;
}
