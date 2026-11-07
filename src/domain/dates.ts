import type { ISODate } from './types';

const toUTC = (iso: ISODate): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};

export function todayISO(now: Date = new Date()): ISODate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Days from a to b (positive when b is later). */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86_400_000);
}

export function addMonths(iso: ISODate, months: number): ISODate {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + months, d)).toISOString().slice(0, 10);
}

/** dd/mm/yyyy, or an em dash for empty values. */
export function formatDate(iso: ISODate | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export type DateBucket = 'past' | 'd90' | 'y1';

export function inDateBucket(iso: ISODate | null | undefined, bucket: DateBucket, today: ISODate): boolean {
  if (!iso) return false;
  const d = daysBetween(today, iso);
  if (bucket === 'past') return d < 0;
  if (bucket === 'd90') return d >= 0 && d <= 90;
  return d >= 0 && d <= 365;
}

const money = new Intl.NumberFormat('he-IL', { maximumFractionDigits: 0 });
export function formatMoney(n: number): string {
  return '₪' + money.format(n);
}

export function addDays(iso: ISODate, days: number): ISODate {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// ---------- Date column filters ----------
// A filter is a string so it fits the generic filter state:
//   'past' | 'd90' | 'y1'        quick presets
//   'y:2027'                       a calendar year
//   'm:2027-03'                    a calendar month
//   'r:2026-01-01..2026-03-31'     inclusive range, either side may be empty

export type DateFilter =
  | { mode: 'preset'; value: DateBucket }
  | { mode: 'year'; year: string }
  | { mode: 'month'; year: string; month: string }
  | { mode: 'range'; from: ISODate | ''; to: ISODate | '' };

export const presetFilter = (b: DateBucket): string => b;
export const yearFilter = (year: string): string => `y:${year}`;
export const monthFilter = (year: string, month: string): string => `m:${year}-${month.padStart(2, '0')}`;
export const rangeFilter = (from: ISODate | '', to: ISODate | ''): string => `r:${from}..${to}`;

export function parseDateFilter(f: string): DateFilter | null {
  if (f === 'past' || f === 'd90' || f === 'y1') return { mode: 'preset', value: f };
  let m = f.match(/^y:(\d{4})$/);
  if (m) return { mode: 'year', year: m[1] };
  m = f.match(/^m:(\d{4})-(\d{2})$/);
  if (m) return { mode: 'month', year: m[1], month: m[2] };
  m = f.match(/^r:(\d{4}-\d{2}-\d{2})?\.\.(\d{4}-\d{2}-\d{2})?$/);
  if (m && (m[1] || m[2])) return { mode: 'range', from: m[1] ?? '', to: m[2] ?? '' };
  return null;
}

export const MONTH_NAMES = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
const PRESET_LABELS: Record<DateBucket, string> = { past: 'עבר', d90: 'עד 90 יום', y1: 'עד שנה' };

/** Short human text for the filter button. Empty string = no filter. */
export function describeDateFilter(f: string | undefined): string {
  const p = f ? parseDateFilter(f) : null;
  if (!p) return '';
  switch (p.mode) {
    case 'preset': return PRESET_LABELS[p.value];
    case 'year': return p.year;
    case 'month': return `${MONTH_NAMES[Number(p.month) - 1]} ${p.year}`;
    case 'range': return p.from && p.to ? `${formatDate(p.from)} – ${formatDate(p.to)}` : p.from ? `מ־${formatDate(p.from)}` : `עד ${formatDate(p.to)}`;
  }
}

/** Empty / missing dates never match a date filter. An unparseable filter matches nothing. */
export function matchDateFilter(iso: ISODate | null | undefined, filter: string, today: ISODate): boolean {
  if (!iso) return false;
  const p = parseDateFilter(filter);
  if (!p) return false;
  switch (p.mode) {
    case 'preset': return inDateBucket(iso, p.value, today);
    case 'year': return iso.startsWith(`${p.year}-`);
    case 'month': return iso.startsWith(`${p.year}-${p.month}-`);
    case 'range': return (!p.from || iso >= p.from) && (!p.to || iso <= p.to);
  }
}

/** First and last day of a month (month is 1–12). */
export function monthBounds(year: number, month: number): { first: ISODate; last: ISODate } {
  const first = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
  const last = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  return { first, last };
}
