import { parseDateFilter } from '../domain/dates';
import { FIELDS } from './fields';
import type { Filters, SortState } from './people';

/** A named combination of filters, sorting and columns on the people table. */
export interface ViewState {
  query: string;
  filters: Filters;
  sort: SortState;
  showEdu: boolean;
  showDmah: boolean;
  view: 'table' | 'tree';
}
export interface SavedView extends ViewState { id: string; name: string }

const FIELD_KEYS = new Set<string>([...FIELDS.map((f) => f.key), 'name']);
const FILTER_KEYS = new Set<string>([...FIELDS.map((f) => f.key), 'section']);
const DATE_KEYS = new Set<string>(FIELDS.filter((f) => f.type === 'date').map((f) => f.key));
const MAX_CODE = 4000;

const toBase64Url = (s: string): string => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromBase64Url = (s: string): string => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
};

/** Compact text form of a view, safe to put in a link. */
export const encodeView = (v: ViewState): string => toBase64Url(JSON.stringify(v));

/** Parse and validate a view from a link or file. Returns null for anything that is not a valid view. */
export function decodeView(code: string): ViewState | null {
  if (!code || code.length > MAX_CODE || !/^[A-Za-z0-9_-]+$/.test(code)) return null;
  let raw: unknown;
  try { raw = JSON.parse(fromBase64Url(code)); } catch { return null; }
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const filters: Filters = {};
  if (typeof r.filters === 'object' && r.filters !== null) {
    for (const [k, v] of Object.entries(r.filters as Record<string, unknown>)) {
      if (!FILTER_KEYS.has(k) || typeof v !== 'string' || v.length === 0 || v.length > 120) continue;
      if (DATE_KEYS.has(k) && !parseDateFilter(v)) continue;
      (filters as Record<string, string>)[k] = v;
    }
  }
  const s = r.sort as Record<string, unknown> | undefined;
  const sort: SortState = s && typeof s.key === 'string' && FIELD_KEYS.has(s.key) && (s.dir === 1 || s.dir === -1)
    ? { key: s.key as SortState['key'], dir: s.dir } : { key: 'degree', dir: -1 };
  return {
    query: typeof r.query === 'string' ? r.query.slice(0, 100) : '',
    filters, sort,
    showEdu: r.showEdu !== false,
    showDmah: r.showDmah === true,
    view: r.view === 'tree' ? 'tree' : 'table',
  };
}

export const MAX_VIEWS = 50;

export function validateViewName(name: string, views: SavedView[]): string | null {
  const n = name.trim();
  if (!n) return 'יש להזין שם לתצוגה.';
  if (n.length > 40) return 'שם התצוגה ארוך מדי (עד 40 תווים).';
  if (views.some((v) => v.name === n)) return 'כבר קיימת תצוגה בשם זה.';
  if (views.length >= MAX_VIEWS) return `אפשר לשמור עד ${MAX_VIEWS} תצוגות.`;
  return null;
}

export function describeFilterCount(v: ViewState): string {
  const n = Object.values(v.filters).filter(Boolean).length + (v.query.trim() ? 1 : 0);
  return n === 0 ? 'ללא סינון' : n === 1 ? 'סינון אחד' : `${n} סינונים`;
}

/** Saved views live in this browser only (they are personal, not shared data). */
const KEY = 'personnel-billets-views';
export function loadViews(): SavedView[] {
  try {
    const arr = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(arr)) return [];
    return arr.flatMap((x): SavedView[] => {
      const v = decodeView(encodeView(x as ViewState)); // re-validate everything we read back
      return v && typeof x.id === 'string' && typeof x.name === 'string' ? [{ ...v, id: x.id, name: x.name.slice(0, 40) }] : [];
    });
  } catch { return []; }
}
export function storeViews(views: SavedView[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(views)); } catch { /* storage unavailable: views last for this session only */ }
}
