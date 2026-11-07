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
