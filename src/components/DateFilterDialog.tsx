import { useState } from 'react';
import {
  MONTH_NAMES, describeDateFilter, monthFilter, parseDateFilter, presetFilter, rangeFilter, yearFilter,
  type DateBucket,
} from '../domain/dates';
import { Dialog } from './Dialog';

type Mode = 'preset' | 'year' | 'month' | 'range';
const MODES: [Mode, string][] = [['year', 'שנה'], ['month', 'חודש'], ['range', 'בין תאריכים'], ['preset', 'מהיר']];
const PRESETS: [DateBucket, string, string][] = [['past', 'עבר', 'תאריכים שכבר חלפו'], ['d90', 'עד 90 יום', 'ב־90 הימים הקרובים'], ['y1', 'עד שנה', 'בשנה הקרובה']];

interface Props {
  /** Column name, e.g. "שחרור". */
  title: string;
  /** Current filter string ('' = none). */
  value: string;
  /** Years that appear in the column (newest first); used for the year / month pickers. */
  years: number[];
  onApply: (filter: string) => void;
  onClose: () => void;
}

/** Floating window: filter a date column by year, month, a range between two dates, or a quick preset. */
export function DateFilterDialog({ title, value, years, onApply, onClose }: Props) {
  const parsed = parseDateFilter(value);
  const [mode, setMode] = useState<Mode>(parsed?.mode ?? 'year');
  const defYear = String(parsed && 'year' in parsed ? parsed.year : years[0] ?? new Date().getFullYear());
  const [year, setYear] = useState(defYear);
  const [month, setMonth] = useState(parsed?.mode === 'month' ? String(Number(parsed.month)) : '1');
  const [from, setFrom] = useState(parsed?.mode === 'range' ? parsed.from : '');
  const [to, setTo] = useState(parsed?.mode === 'range' ? parsed.to : '');
  const [preset, setPreset] = useState<DateBucket>(parsed?.mode === 'preset' ? parsed.value : 'd90');
  const [error, setError] = useState<string | null>(null);

  const yearList = Array.from(new Set([...years, Number(defYear)])).sort((a, b) => b - a);

  const current = (): string | null => {
    if (mode === 'year') return yearFilter(year);
    if (mode === 'month') return monthFilter(year, month);
    if (mode === 'preset') return presetFilter(preset);
    if (!from && !to) { setError('יש למלא לפחות תאריך אחד.'); return null; }
    if (from && to && from > to) { setError('תאריך ההתחלה חייב להיות לפני תאריך הסיום.'); return null; }
    return rangeFilter(from, to);
  };
  const apply = () => { const f = current(); if (f !== null) { onApply(f); onClose(); } };

  return (
    <Dialog
      title={`סינון לפי תאריך — ${title}`}
      width={460}
      onClose={onClose}
      footer={<>
        {value && <button type="button" className="btn h-[38px] me-auto" onClick={() => { onApply(''); onClose(); }}>נקה סינון</button>}
        <button type="button" className="btn h-[38px]" onClick={onClose}>ביטול</button>
        <button type="button" className="btn btn-primary h-[38px] px-5" onClick={apply}>החלה</button>
      </>}
    >
      <div className="flex flex-col gap-3.5">
        {value && <p className="m-0 text-[13px] text-muted">סינון פעיל: <strong className="text-ink">{describeDateFilter(value)}</strong></p>}
        <div role="tablist" aria-label="סוג סינון" className="flex gap-1 rounded bg-soft p-[3px]">
          {MODES.map(([m, label]) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(null); }}
              className={`h-8 flex-1 rounded text-[13px] font-semibold ${mode === m ? 'bg-surface text-ink shadow' : 'text-muted'}`}>{label}</button>
          ))}
        </div>

        {(mode === 'year' || mode === 'month') && (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="df-year" className="label">שנה</label>
              <select id="df-year" className="input input-lg" value={year} onChange={(e) => setYear(e.target.value)}>
                {yearList.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            {mode === 'month' && (
              <div className="flex flex-col gap-1">
                <label htmlFor="df-month" className="label">חודש</label>
                <select id="df-month" className="input input-lg" value={month} onChange={(e) => setMonth(e.target.value)}>
                  {MONTH_NAMES.map((n, i) => <option key={n} value={i + 1}>{n}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        {mode === 'range' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="df-from" className="label">מתאריך</label>
              <input id="df-from" type="date" className="input input-lg" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setError(null); }} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="df-to" className="label">עד תאריך (כולל)</label>
              <input id="df-to" type="date" className="input input-lg" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setError(null); }} />
            </div>
            <p className="col-span-2 m-0 text-xs text-muted">אפשר למלא תאריך אחד בלבד: רק "מתאריך" = מאותו יום והלאה; רק "עד תאריך" = עד אותו יום.</p>
          </div>
        )}

        {mode === 'preset' && (
          <div role="radiogroup" aria-label="סינון מהיר" className="flex flex-col gap-1.5">
            {PRESETS.map(([v, label, sub]) => (
              <button key={v} type="button" role="radio" aria-checked={preset === v} onClick={() => setPreset(v)}
                className={`flex min-h-11 items-center gap-2.5 rounded border-[1.5px] px-3 text-start ${preset === v ? 'border-primary bg-tint' : 'border-line2 hover:bg-soft'}`}>
                <span className={`h-4 w-4 shrink-0 rounded-full border-line2 ${preset === v ? 'border-[5px] border-primary' : 'border-2'}`} />
                <span className="flex flex-col"><span className="text-sm font-bold">{label}</span><span className="text-xs text-muted">{sub}</span></span>
              </button>
            ))}
          </div>
        )}
        {error && <p role="alert" className="m-0 text-[13px] font-semibold text-danger">{error}</p>}
      </div>
    </Dialog>
  );
}
