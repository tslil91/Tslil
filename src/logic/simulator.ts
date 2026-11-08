import { daysBetween } from '../domain/dates';
import { degreeIndex } from '../domain/rules';
import type { Billet, BilletAssignment, Commanders, ISODate, Person, Section, SectionPeriod } from '../domain/types';
import { sectionAt } from './history';

/**
 * A what-if change, kept apart from the real data.
 * - assign: from `date`, the person sits on the billet (leaving any billet they held).
 * - release: from `date`, the person leaves their billet and becomes על תקני.
 */
export type ScenarioOp =
  | { id: number; kind: 'assign'; personId: number; billetId: number; date: ISODate }
  | { id: number; kind: 'release'; personId: number; date: ISODate };

export type NewScenarioOp = Omit<Extract<ScenarioOp, { kind: 'assign' }>, 'id'> | Omit<Extract<ScenarioOp, { kind: 'release' }>, 'id'>;

/** Half-open interval [start, end). */
export const isActive = (a: BilletAssignment, d: ISODate): boolean => a.start <= d && (a.end === null || d < a.end);

/** In the organization on date d: not yet released, and (for keva) already entered keva. */
export const isPresent = (p: Person, d: ISODate): boolean =>
  (p.releaseDate === null || d < p.releaseDate) && !(p.pop === 'keva' && p.entryDate !== null && p.entryDate > d);

const SCENARIO_ID_BASE = 1_000_000;

/** Close the person's assignment that is active on d (an assignment starting on d disappears). */
function closeAt(list: BilletAssignment[], personId: number, d: ISODate): BilletAssignment[] {
  return list
    .map((a) => (a.personId === personId && isActive(a, d) ? { ...a, end: d } : a))
    .filter((a) => !(a.end !== null && a.end <= a.start));
}

/** Real assignments with the scenario applied in date order. Scenario rows get ids ≥ 1,000,000. */
export function applyScenario(assignments: BilletAssignment[], ops: ScenarioOp[], nameOf: (personId: number) => string): BilletAssignment[] {
  let list = [...assignments];
  const ordered = [...ops].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
  for (const op of ordered) {
    list = closeAt(list, op.personId, op.date);
    if (op.kind === 'assign') {
      // whoever holds the billet on that date leaves it (no double booking)
      list = list
        .map((a) => (a.billetId === op.billetId && isActive(a, op.date) ? { ...a, end: op.date } : a))
        .filter((a) => !(a.end !== null && a.end <= a.start));
      // the new period ends where the billet or the person already has something later
      const later = list
        .filter((a) => (a.billetId === op.billetId || a.personId === op.personId) && a.start > op.date)
        .map((a) => a.start)
        .sort()[0] ?? null;
      list.push({ id: SCENARIO_ID_BASE + op.id, billetId: op.billetId, personId: op.personId, personName: nameOf(op.personId), start: op.date, end: later });
    }
  }
  return list;
}

export interface SimData {
  people: Person[];
  billets: Billet[];
  assignments: BilletAssignment[];
  sections: Section[];
  commanders: Commanders;
  /** Dated section membership; without it everyone is shown in their current section. */
  sectionHistory?: SectionPeriod[];
}

export interface BilletAtDate {
  billet: Billet;
  occupant: BilletAssignment | null;
  occupantName: string | null;
  /** Next occupant after d, if any. */
  next: BilletAssignment | null;
  fromScenario: boolean;
}

export interface PersonAtDate {
  person: Person;
  billet: number | null;
  /** Days until release when it is within 60 days. */
  releaseInDays: number | null;
  isCommander: boolean;
  fromScenario: boolean;
}

export interface Snapshot {
  date: ISODate;
  billets: BilletAtDate[];
  groups: { id: string; name: string; people: PersonAtDate[] }[];
  /** Keva people present on d without a billet (על תקני). */
  bench: PersonAtDate[];
  released: Person[];
  notYetJoined: Person[];
  kpis: { billets: number; filled: number; vacant: number; bench: number; present: number };
}

export function snapshot(data: SimData, ops: ScenarioOp[], d: ISODate): Snapshot {
  const nameOf = (id: number) => data.people.find((p) => p.id === id)?.name ?? '';
  const all = applyScenario(data.assignments, ops, nameOf);
  const history = data.sectionHistory ?? [];
  const presentIds = new Set(data.people.filter((p) => isPresent(p, d)).map((p) => p.id));
  const active = all.filter((a) => isActive(a, d) && (a.personId === null || presentIds.has(a.personId)));
  const billetOfPerson = new Map<number, BilletAssignment>();
  for (const a of active) if (a.personId !== null) billetOfPerson.set(a.personId, a);

  const billets: BilletAtDate[] = data.billets.map((b) => {
    const occupant = active.find((a) => a.billetId === b.id) ?? null;
    const next = all.filter((a) => a.billetId === b.id && a.start > d).sort((x, y) => (x.start < y.start ? -1 : 1))[0] ?? null;
    return { billet: b, occupant, occupantName: occupant ? (occupant.personId !== null ? nameOf(occupant.personId) : occupant.personName) : null, next, fromScenario: !!occupant && occupant.id >= SCENARIO_ID_BASE };
  });

  const view = (p: Person): PersonAtDate => {
    const a = billetOfPerson.get(p.id);
    const r = p.releaseDate ? daysBetween(d, p.releaseDate) : null;
    const sec = sectionAt(history, p, d);
    const isCommander = data.commanders.org === p.id || (!!sec && data.commanders.sections[sec] === p.id);
    return { person: p, billet: a?.billetId ?? null, releaseInDays: r !== null && r > 0 && r <= 60 ? r : null, isCommander, fromScenario: !!a && a.id >= SCENARIO_ID_BASE };
  };
  const present = data.people.filter((p) => presentIds.has(p.id));
  const order = (a: PersonAtDate, b: PersonAtDate) => Number(b.isCommander) - Number(a.isCommander) || degreeIndex(b.person.degree) - degreeIndex(a.person.degree);
  const groups = [{ id: 'org', name: 'רע"ן וכפופים ישירות' }, ...data.sections].map((g) => ({
    id: g.id,
    name: g.name,
    people: present.filter((p) => (sectionAt(history, p, d) ?? 'org') === g.id).map(view).sort(order),
  }));
  const bench = present.filter((p) => p.pop === 'keva' && !billetOfPerson.has(p.id)).map(view).sort(order);
  const filled = billets.filter((b) => b.occupant).length;

  return {
    date: d,
    billets,
    groups,
    bench,
    released: data.people.filter((p) => p.releaseDate !== null && p.releaseDate <= d),
    notYetJoined: data.people.filter((p) => p.pop === 'keva' && p.entryDate !== null && p.entryDate > d),
    kpis: { billets: billets.length, filled, vacant: billets.length - filled, bench: bench.length, present: present.length },
  };
}

/** Every date on which the organization can change — for slider ticks and previous / next jumps. */
export function changePoints(data: SimData, ops: ScenarioOp[]): ISODate[] {
  const s = new Set<ISODate>();
  for (const a of data.assignments) { s.add(a.start); if (a.end) s.add(a.end); }
  for (const p of data.people) { if (p.releaseDate) s.add(p.releaseDate); if (p.pop === 'keva' && p.entryDate) s.add(p.entryDate); }
  for (const o of ops) s.add(o.date);
  return [...s].sort();
}

/** Why a planned assignment is not possible on this date, or null when it is. */
export function assignError(snap: Snapshot, personId: number, billetId: number): string | null {
  if (!snap.bench.some((b) => b.person.id === personId)) return 'בתאריך זה האדם אינו על תקני.';
  const b = snap.billets.find((x) => x.billet.id === billetId);
  if (!b) return 'התקן אינו קיים.';
  if (b.occupant) return 'בתאריך זה התקן מאויש.';
  return null;
}
