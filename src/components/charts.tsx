import type { ReactNode } from 'react';
import type { ReleaseMonth } from '../logic/overview';

/** Hebrew singular / plural: one → "קצין אחד", otherwise "N קצינים". */
export const plural = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);

export function Card({ title, subtitle, children, wide, action }: { title: string; subtitle?: string; children: ReactNode; wide?: boolean; action?: ReactNode }) {
  return (
    <section aria-label={title} className={`flex flex-col gap-3 rounded border border-line bg-surface p-4 ${wide ? 'col-span-2' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="flex flex-1 flex-col">
          <h2 className="m-0 text-[15px] font-bold">{title}</h2>
          {subtitle && <span className="text-xs text-muted">{subtitle}</span>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A horizontal bar: label, track with fill, value text. */
export function Bar({ label, sub, value, max, text, muted, onClick, hint, labelWidth = 118, textWidth = 150 }: {
  label: string; sub?: string; value: number; max: number; text: string; muted?: boolean; onClick?: () => void; hint?: string; labelWidth?: number; textWidth?: number;
}) {
  const pct = max > 0 ? Math.max(value > 0 ? 3 : 0, (value / max) * 100) : 0;
  const inner = (
    <>
      <span className="flex shrink-0 flex-col text-start" style={{ width: labelWidth }}>
        <span className="truncate text-[13px] font-semibold">{label}</span>
        {sub && <span className="truncate text-[11px] text-muted">{sub}</span>}
      </span>
      <span className="relative h-5 flex-1 overflow-hidden rounded-sm bg-soft" aria-hidden="true">
        <span className={`absolute inset-y-0 start-0 rounded-sm ${muted ? 'bg-line2' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="shrink-0 text-start text-[13px] font-bold" style={{ width: textWidth }}>{text}</span>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} title={hint} className="flex min-h-9 w-full items-center gap-2 rounded px-1 hover:bg-soft">{inner}</button>
  ) : (
    <div className="flex min-h-9 items-center gap-2 px-1">{inner}</div>
  );
}

/** Column chart of releases per month. Clicking a column calls `onPick`. */
export function ReleaseChart({ months, onPick, height = 190 }: { months: ReleaseMonth[]; onPick?: (m: ReleaseMonth) => void; height?: number }) {
  const max = Math.max(1, ...months.map((m) => m.count));
  const bar = height - 54;
  return (
    <>
      <div className="flex items-end gap-1.5 border-b border-line2 px-1" style={{ height }}>
        {months.map((m) => {
          const h = m.count === 0 ? 0 : Math.max(8, (m.count / max) * bar);
          return (
            <button key={m.key} type="button" disabled={m.count === 0 || !onPick}
              aria-label={`${m.label}: ${plural(m.count, 'שחרור אחד', 'שחרורים')}${m.count && onPick ? ' — הצג בטבלה' : ''}`}
              onClick={() => onPick?.(m)}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1 rounded-t enabled:hover:bg-soft disabled:cursor-default">
              <span className="text-[13px] font-bold">{m.count || ''}</span>
              <span className={`w-full max-w-[48px] rounded-t-sm ${m.count ? 'bg-primary' : ''}`} style={{ height: h }} />
            </button>
          );
        })}
      </div>
      <div className="flex gap-1.5 px-1" aria-hidden="true">
        {months.map((m) => <span key={m.key} className="flex-1 text-center text-[11px] text-muted">{m.label}</span>)}
      </div>
    </>
  );
}
