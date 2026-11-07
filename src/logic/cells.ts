import type { ISODate } from '../domain/types';

/** A normalized spreadsheet cell value, independent of the Excel library. */
export type Cell = string | number | boolean | Date | null;

export interface Table {
  headers: string[];
  /** Data rows (without the header row). */
  rows: Cell[][];
  /** 1-based Excel row number of each data row, for error messages. */
  rowNumbers: number[];
}

export class CellError extends Error {}

const isoFromParts = (y: number, m: number, d: number): ISODate | null => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

export const isEmpty = (v: Cell): boolean => v === null || (typeof v === 'string' && v.trim() === '');

export function text(v: Cell): string {
  if (v === null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

/** Accepts Excel dates, Excel serial numbers, dd/mm/yyyy, d.m.yyyy and yyyy-mm-dd. */
export function parseDate(v: Cell): ISODate | null {
  if (isEmpty(v)) return null;
  if (v instanceof Date) return isoFromParts(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  if (typeof v === 'number') {
    if (v < 1 || v > 2958465) throw new CellError('תאריך לא תקין');
    const ms = Math.round((v - 25569) * 86_400_000); // Excel serial (1900 system) → Unix ms
    const d = new Date(ms);
    return isoFromParts(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const s = text(v);
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  let iso: ISODate | null = null;
  if (m) iso = isoFromParts(Number(m[3]), Number(m[2]), Number(m[1]));
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) iso = isoFromParts(Number(m[1]), Number(m[2]), Number(m[3]));
  if (!iso) throw new CellError(`תאריך לא תקין: "${s}" (פורמט נדרש: dd/mm/yyyy)`);
  return iso;
}

export function parseBool(v: Cell): boolean | null {
  if (isEmpty(v)) return null;
  if (typeof v === 'boolean') return v;
  const s = text(v).toLowerCase();
  if (['כן', 'yes', 'true', '1', 'v', '✓'].includes(s)) return true;
  if (['לא', 'no', 'false', '0', 'x'].includes(s)) return false;
  throw new CellError(`ערך לא תקין: "${text(v)}" (נדרש כן / לא)`);
}

export function parseInteger(v: Cell, what: string): number | null {
  if (isEmpty(v)) return null;
  const s = typeof v === 'number' ? String(v) : text(v).replace(/[,\s₪]/g, '');
  if (!/^\d+$/.test(s)) throw new CellError(`${what} חייב להיות מספר שלם: "${text(v)}"`);
  return Number(s);
}

export function parseAmount(v: Cell): number | null {
  if (isEmpty(v)) return null;
  const n = typeof v === 'number' ? v : Number(text(v).replace(/[,\s₪]/g, ''));
  if (!Number.isFinite(n)) throw new CellError(`סכום לא תקין: "${text(v)}"`);
  return n;
}

/** Map a Hebrew label back to its key. */
export function parseLabel<K extends string>(v: Cell, labels: Record<K, string>, what: string): K | null {
  if (isEmpty(v)) return null;
  const s = text(v);
  const hit = (Object.entries(labels) as [K, string][]).find(([, l]) => l === s);
  if (!hit) throw new CellError(`${what} לא מוכר: "${s}" (ערכים אפשריים: ${Object.values(labels).join(', ')})`);
  return hit[0];
}

/** Read rows as objects keyed by header; unknown headers are ignored, header order does not matter. */
export function rowsByHeader(t: Table): { rowNumber: number; get: (h: string) => Cell; has: (h: string) => boolean }[] {
  const index = new Map<string, number>();
  t.headers.forEach((h, i) => { const k = h.trim(); if (k && !index.has(k)) index.set(k, i); });
  return t.rows
    .map((r, i) => ({
      rowNumber: t.rowNumbers[i],
      has: (h: string) => index.has(h),
      get: (h: string) => (index.has(h) ? r[index.get(h)!] ?? null : null),
      empty: r.every(isEmpty),
    }))
    .filter((r) => !r.empty);
}

export function missingHeaders(t: Table, required: string[]): string[] {
  const set = new Set(t.headers.map((h) => h.trim()));
  return required.filter((h) => !set.has(h));
}

export interface RowError { row: number; message: string }

export interface ImportPlan<T> {
  creates: T[];
  updates: T[];
  unchanged: number;
  errors: RowError[];
}
