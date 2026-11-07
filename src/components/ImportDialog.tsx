import { useState } from 'react';
import { downloadWorkbook, readSheet } from '../io/excel';
import type { ImportPlan, Table } from '../logic/cells';
import type { SheetSpec } from '../logic/sheets';
import { Dialog } from './Dialog';

interface Props<T> {
  title: string;
  /** Sheet name to read (falls back to the first sheet). */
  sheetName: string;
  /** What the rows describe, e.g. "אנשים". */
  noun: string;
  rulesHint: string;
  plan: (t: Table) => ImportPlan<T>;
  apply: (plan: ImportPlan<T>) => void;
  template: () => SheetSpec[];
  templateFile: string;
  onClose: () => void;
}

/** Choose an .xlsx file → preview what will be created / updated and every row error → apply the valid rows. */
export function ImportDialog<T>({ title, sheetName, noun, rulesHint, plan, apply, template, templateFile, onClose }: Props<T>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportPlan<T> | null>(null);
  const [fileName, setFileName] = useState('');

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError(null); setResult(null); setFileName(file.name);
    try {
      setResult(plan(await readSheet(file, sheetName)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה בקריאת הקובץ');
    } finally {
      setBusy(false);
    }
  };

  const changes = result ? result.creates.length + result.updates.length : 0;

  return (
    <Dialog
      title={title}
      width={640}
      onClose={onClose}
      footer={<>
        <button type="button" className="btn h-[38px]" onClick={onClose}>ביטול</button>
        <button type="button" className="btn btn-primary h-[38px] px-5" disabled={!result || changes === 0} aria-disabled={!result || changes === 0}
          onClick={() => { if (result) { apply(result); onClose(); } }}>
          {result && result.errors.length > 0 ? `ייבוא ${changes} שורות תקינות` : `ייבוא ${changes} שינויים`}
        </button>
      </>}
    >
      <div className="flex flex-col gap-3.5">
        <p className="m-0 text-sm leading-relaxed text-muted">{rulesHint}</p>
        <div className="flex items-center gap-2.5">
          <label className="btn btn-primary cursor-pointer">
            בחירת קובץ Excel
            <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
          </label>
          <button type="button" className="btn" onClick={() => void downloadWorkbook(templateFile, template())}>הורדת תבנית / הנתונים הנוכחיים</button>
          {fileName && <span className="truncate text-[13px] text-muted">{fileName}</span>}
        </div>
        {busy && <p role="status" className="m-0 text-sm">קורא את הקובץ…</p>}
        {error && <p role="alert" className="m-0 rounded bg-danger-soft px-3 py-2 text-[13px] font-semibold text-danger">{error}</p>}
        {result && (
          <>
            <div className="grid grid-cols-4 gap-2">
              {[['חדשים', result.creates.length], ['עדכונים', result.updates.length], ['ללא שינוי', result.unchanged], ['שגיאות', result.errors.length]].map(([l, n]) => (
                <div key={l} className={`rounded px-3 py-2 ${l === 'שגיאות' && Number(n) > 0 ? 'bg-danger-soft text-danger' : 'bg-soft'}`}>
                  <div className="text-xl font-bold">{n}</div>
                  <div className="text-xs font-semibold">{l} ({noun})</div>
                </div>
              ))}
            </div>
            {result.errors.length > 0 && (
              <div className="max-h-[240px] overflow-y-auto rounded border border-line">
                <table className="w-full border-collapse text-[13px]">
                  <thead className="sticky top-0 bg-head"><tr><th className="w-20 px-2 py-1.5 text-start">שורה</th><th className="px-2 py-1.5 text-start">שגיאה</th></tr></thead>
                  <tbody>
                    {result.errors.map((e, i) => (
                      <tr key={i} className="border-t border-line"><td className="px-2 py-1.5 font-semibold">{e.row}</td><td className="px-2 py-1.5">{e.message}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {changes === 0 && result.errors.length === 0 && <p className="m-0 text-sm text-muted">אין שינויים לייבוא — הקובץ זהה לנתונים הקיימים.</p>}
          </>
        )}
      </div>
    </Dialog>
  );
}
