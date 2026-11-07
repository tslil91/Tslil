import { MONTH_NAMES, daysBetween, monthBounds } from '../domain/dates';
import { PROGRAMS } from '../domain/rules';
import type { Billet, BilletAssignment, ISODate, Person } from '../domain/types';

const isOfficer = (p: Person) => p.rank === 'officer';

// ---------- 3. Upcoming releases ----------

export interface ReleaseMonth {
  key: string; // YYYY-MM
  label: string; // e.g. "נוב׳ 26"
  count: number;
  /** Inclusive range to filter the table with (the current month starts today). */
  from: ISODate;
  to: ISODate;
}

const SHORT_MONTH = MONTH_NAMES.map((n) => (n.length > 4 ? `${n.slice(0, 3)}׳` : n));

/** Releases in each of the next `months` months, starting with the current one (from today on). */
export function releasesByMonth(people: Person[], today: ISODate, months = 12, officersOnly = true): ReleaseMonth[] {
  const [ty, tm] = today.split('-').map(Number);
  const pool = people.filter((p) => p.releaseDate && (!officersOnly || isOfficer(p)));
  return Array.from({ length: months }, (_, i) => {
    const idx = tm - 1 + i;
    const year = ty + Math.floor(idx / 12);
    const month = (idx % 12) + 1;
    const { first, last } = monthBounds(year, month);
    const from = i === 0 ? today : first;
    return {
      key: first.slice(0, 7),
      label: `${SHORT_MONTH[month - 1]} ${String(year).slice(2)}`,
      count: pool.filter((p) => p.releaseDate! >= from && p.releaseDate! <= last).length,
      from,
      to: last,
    };
  });
}

// ---------- 4. Officers' education & certification ----------

export type EduKey = 'bachelor' | 'masters' | 'gamoshA' | 'gamoshB';
export interface Progress { key: EduKey; label: string; yes: number; total: number }

const EDU: [EduKey, string][] = [['bachelor', 'תואר ראשון'], ['masters', 'תואר שני'], ['gamoshA', 'גמו"ש א׳'], ['gamoshB', 'גמו"ש ב׳']];

export function officerProgress(people: Person[]): Progress[] {
  const officers = people.filter(isOfficer);
  return EDU.map(([key, label]) => ({ key, label, yes: officers.filter((p) => p[key] === true).length, total: officers.length }));
}

// ---------- 6. Officers' programs ----------

export interface ProgramCount { program: string | null; label: string; count: number }

/** Officers only: the five officer programs plus officers without a program. */
export function officerPrograms(people: Person[]): ProgramCount[] {
  const officers = people.filter(isOfficer);
  return [
    ...(PROGRAMS.officer ?? []).map((program) => ({ program, label: program, count: officers.filter((p) => p.program === program).length })),
    { program: null, label: 'ללא תוכנית', count: officers.filter((p) => !p.program).length },
  ];
}

// ---------- 9. Billet turnover ----------

export interface Turnover {
  billetId: number;
  occupants: number;
  /** Average years an occupant stayed (open assignments count until today). */
  avgYears: number;
  vacantNow: boolean;
}

export function billetTurnover(billets: Billet[], assignments: BilletAssignment[], today: ISODate, limit = 10): Turnover[] {
  return billets
    .map((b) => {
      const list = assignments.filter((a) => a.billetId === b.id);
      const years = list.map((a) => Math.max(0, daysBetween(a.start, a.end ?? today)) / 365.25);
      return {
        billetId: b.id,
        occupants: list.length,
        avgYears: years.length ? years.reduce((s, y) => s + y, 0) / years.length : 0,
        vacantNow: !list.some((a) => a.end === null),
      };
    })
    .filter((t) => t.occupants > 0)
    .sort((a, b) => b.occupants - a.occupants || a.avgYears - b.avgYears || a.billetId - b.billetId)
    .slice(0, limit);
}
