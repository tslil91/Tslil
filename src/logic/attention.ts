import { daysBetween } from '../domain/dates';
import { isActivePerson } from '../domain/rules';
import type { AppData, Billet, Grant, ISODate, Person } from '../domain/types';

export interface AttentionOptions {
  /** Window (days ahead) for releases and דמ"ח eligibility. */
  windowDays: number;
  /** A keva person without a billet for at least this many days is listed. */
  benchDays: number;
  /** Window (days ahead) for grant signing periods that end. */
  grantDays: number;
}
export const DEFAULT_ATTENTION: AttentionOptions = { windowDays: 90, benchDays: 60, grantDays: 180 };

export interface AttentionResult {
  /** Will leave the organization soon while still on a billet — the billet is about to open. */
  releasing: { person: Person; days: number; billetId: number }[];
  /** Vacant billets with nobody planned after today. `sinceDays` = how long vacant (null = never occupied). */
  vacant: { billet: Billet; sinceDays: number | null }[];
  /** Keva people on על תקני for a long time. */
  benchLong: { person: Person; days: number }[];
  /** Officers whose דמ"ח eligibility date is near or already past, and who have not completed it. */
  dmah: { person: Person; level: 'ג׳' | 'ב׳' | 'א׳'; date: ISODate; days: number }[];
  /** Grant signing periods that end soon. */
  grants: { grant: Grant; person: Person | null; end: ISODate; days: number }[];
  total: number;
}

const LEVELS = [
  { level: 'ג׳' as const, done: 'dmahC' as const, elig: 'dmahCElig' as const },
  { level: 'ב׳' as const, done: 'dmahB' as const, elig: 'dmahBElig' as const },
  { level: 'א׳' as const, done: 'dmahA' as const, elig: 'dmahAElig' as const },
];

export function attentionItems(all: AppData, today: ISODate, opts: AttentionOptions = DEFAULT_ATTENTION): AttentionResult {
  // people who left the unit are not part of the live picture
  const data: AppData = { ...all, people: all.people.filter(isActivePerson) };
  const open = new Map<number, number>(); // personId → billetId
  for (const a of data.assignments) if (a.end === null && a.personId !== null) open.set(a.personId, a.billetId);
  const present = (p: Person) => (p.releaseDate === null || p.releaseDate > today) && !(p.pop === 'keva' && p.entryDate && p.entryDate > today);

  const releasing = data.people
    .filter((p) => p.releaseDate && open.has(p.id))
    .map((p) => ({ person: p, days: daysBetween(today, p.releaseDate!), billetId: open.get(p.id)! }))
    .filter((x) => x.days >= 0 && x.days <= opts.windowDays)
    .sort((a, b) => a.days - b.days);

  const vacant = data.billets
    .filter((b) => !data.assignments.some((a) => a.billetId === b.id && (a.end === null || a.start > today)))
    .map((b) => {
      const ends = data.assignments.filter((a) => a.billetId === b.id && a.end).map((a) => a.end!);
      const last = ends.sort().at(-1);
      return { billet: b, sinceDays: last ? Math.max(0, daysBetween(last, today)) : null };
    })
    .sort((a, b) => (b.sinceDays ?? -1) - (a.sinceDays ?? -1) || a.billet.id - b.billet.id);

  const benchLong = data.people
    .filter((p) => p.pop === 'keva' && present(p) && !open.has(p.id))
    .map((p) => {
      const ends = data.assignments.filter((a) => a.personId === p.id && a.end).map((a) => a.end!);
      const since = ends.sort().at(-1) ?? p.entryDate;
      return since ? { person: p, days: Math.max(0, daysBetween(since, today)) } : null;
    })
    .filter((x): x is { person: Person; days: number } => x !== null && x.days >= opts.benchDays)
    .sort((a, b) => b.days - a.days);

  const dmah = data.people
    .filter((p) => p.rank === 'officer' && present(p))
    .flatMap((p) => LEVELS.flatMap((l) => {
      const date = p[l.elig];
      if (p[l.done] === true || !date) return [];
      const days = daysBetween(today, date);
      return days <= opts.windowDays ? [{ person: p, level: l.level, date, days }] : [];
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const byId = new Map(data.people.map((p) => [p.id, p]));
  const grants = data.grants
    .filter((g) => g.signingEnd)
    .map((g) => ({ grant: g, person: byId.get(g.personId) ?? null, end: g.signingEnd!, days: daysBetween(today, g.signingEnd!) }))
    .filter((x) => x.days >= 0 && x.days <= opts.grantDays)
    .sort((a, b) => a.days - b.days);

  return { releasing, vacant, benchLong, dmah, grants, total: releasing.length + vacant.length + benchLong.length + dmah.length + grants.length };
}
