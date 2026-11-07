import { matchDateFilter } from '../domain/dates';
import { applicable, degreeIndex } from '../domain/rules';
import type { Billet, Commanders, ISODate, Person, PersonRow, Section, SectionId } from '../domain/types';
import { FIELDS, type FieldDef, type FieldKey } from './fields';

export type Filters = Partial<Record<FieldKey | 'section', string>>;
export type SortState = { key: FieldKey; dir: 1 | -1 };
export const DEFAULT_SORT: SortState = { key: 'degree', dir: -1 };

const fieldByKey = new Map<string, FieldDef>(FIELDS.map((f) => [f.key, f]));

/** The comparable filter value of a row for a field; null = not applicable (never matches). */
export function filterValue(row: PersonRow, key: FieldKey | 'section'): string | null {
  if (key === 'section') return row.sectionId ?? 'none';
  if (!applicable(key, row)) return null;
  if (key === 'billet') return row.billet ? 'has' : 'bench';
  if (key === 'program') return row.program ?? 'none';
  const f = fieldByKey.get(key);
  const v = row[key];
  if (f?.type === 'bool') return v ? 'yes' : 'no';
  return v === undefined || v === null ? null : String(v);
}

export function matchesFilters(row: PersonRow, filters: Filters, query: string, today: ISODate): boolean {
  const q = query.trim();
  if (q && !row.name.includes(q) && !String(row.mid).includes(q)) return false;
  return (Object.entries(filters) as [FieldKey | 'section', string][]).every(([key, want]) => {
    if (!want) return true;
    const f = fieldByKey.get(key);
    if (f?.type === 'date') return applicable(key, row) && matchDateFilter(row[key as FieldKey] as string | null, want, today);
    return filterValue(row, key) === want;
  });
}

const RANK_ORDER = ['civilian', 'soldier', 'ncos', 'officer'];
const POP_ORDER = ['civ', 'hova', 'keva'];

function sortValue(row: PersonRow, key: FieldKey): string | number | null {
  if (!applicable(key, row)) return null;
  switch (key) {
    case 'degree': return degreeIndex(row.degree);
    case 'rank': return RANK_ORDER.indexOf(row.rank);
    case 'pop': return POP_ORDER.indexOf(row.pop);
    case 'billet': return row.billet ?? Number.MAX_SAFE_INTEGER;
  }
  const v = row[key];
  if (typeof v === 'boolean') return v ? 1 : 0;
  return v === undefined || v === null ? null : (v as string | number);
}

/** Comparator; empty / not-applicable values always last; ties broken by degree (high first). */
export function comparePeople(sort: SortState) {
  return (a: PersonRow, b: PersonRow): number => {
    const x = sortValue(a, sort.key);
    const y = sortValue(b, sort.key);
    if (x === null && y !== null) return 1;
    if (y === null && x !== null) return -1;
    let r = 0;
    if (x !== null && y !== null) {
      r = typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y, 'he') : x < y ? -1 : x > y ? 1 : 0;
      r *= sort.dir;
    }
    if (r === 0) r = degreeIndex(b.degree) - degreeIndex(a.degree);
    if (r === 0) r = a.name.localeCompare(b.name, 'he');
    return r;
  };
}

export interface PeopleGroup {
  id: SectionId | 'org';
  name: string;
  commanderLabel: string;
  commander: Person | null;
  rows: PersonRow[];
}

/** Org level first, then each section. Inside each group the commander is always first. */
export function groupPeople(rows: PersonRow[], sections: Section[], cmd: Commanders, sort: SortState, all: Person[]): PeopleGroup[] {
  const byId = new Map(all.map((p) => [p.id, p]));
  const defs = [
    { id: 'org' as const, name: 'מפקד הארגון וכפופים ישירות', commanderLabel: 'מפקד הארגון', cmdId: cmd.org, match: (r: PersonRow) => r.sectionId === null },
    ...sections.map((s) => ({ id: s.id, name: s.name, commanderLabel: 'מפקד המדור', cmdId: cmd.sections[s.id] ?? null, match: (r: PersonRow) => r.sectionId === s.id })),
  ];
  return defs.map((g) => {
    const list = rows.filter(g.match).sort(comparePeople(sort));
    const first = list.filter((r) => r.id === g.cmdId);
    return {
      id: g.id,
      name: g.name,
      commanderLabel: g.commanderLabel,
      commander: g.cmdId !== null ? byId.get(g.cmdId) ?? null : null,
      rows: [...first, ...list.filter((r) => r.id !== g.cmdId)],
    };
  });
}

// ---------- Location in the organization ----------

export type PlacementKey = 'orgcmd' | 'org' | `sec:${string}` | `cmd:${string}`;

export function placementOf(p: Person, cmd: Commanders): PlacementKey {
  if (cmd.org === p.id) return 'orgcmd';
  if (!p.sectionId) return 'org';
  return cmd.sections[p.sectionId] === p.id ? `cmd:${p.sectionId}` : `sec:${p.sectionId}`;
}

export function placementLabel(key: PlacementKey, sections: Section[]): string {
  if (key === 'orgcmd') return 'מפקד הארגון';
  if (key === 'org') return 'כפוף ישירות למפקד הארגון';
  const [kind, id] = key.split(':');
  const name = sections.find((s) => s.id === id)?.name ?? id;
  return kind === 'cmd' ? `מפקד ${name}` : `איש צוות ב${name}`;
}

/**
 * Move a person to a new placement.
 * - The org commander has no section and never commands a section.
 * - A person commands at most one unit; leaving a unit clears that command.
 * - Appointing a new commander demotes the previous one in place.
 */
export function applyPlacement(people: Person[], cmd: Commanders, personId: number, key: PlacementKey): { people: Person[]; commanders: Commanders } {
  const sections = { ...cmd.sections };
  let org = cmd.org === personId ? null : cmd.org;
  for (const s of Object.keys(sections)) if (sections[s] === personId) sections[s] = null;

  let sectionId: SectionId | null = null;
  if (key === 'orgcmd') org = personId;
  else if (key.startsWith('sec:')) sectionId = key.slice(4);
  else if (key.startsWith('cmd:')) {
    sectionId = key.slice(4);
    sections[sectionId] = personId;
  }
  return {
    people: people.map((p) => (p.id === personId ? { ...p, sectionId } : p)),
    commanders: { org, sections },
  };
}

// ---------- Validation ----------

export type PersonDraft = Omit<PersonRow, 'mid'> & { mid: string };

export function validatePerson(d: PersonDraft, people: Person[], billets: Billet[], occupantOf: (billetId: number) => number | null): string | null {
  if (!d.name.trim()) return 'יש להזין שם.';
  if (!/^\d{5,9}$/.test(d.mid.trim())) return 'מ.א חייב להכיל 5–9 ספרות.';
  const mid = Number(d.mid);
  if (people.some((p) => p.id !== d.id && p.mid === mid)) return 'מ.א זה כבר קיים במערכת.';
  if (d.pop === 'keva' && d.billet !== null) {
    if (!billets.some((b) => b.id === d.billet)) return `תקן ${d.billet} אינו קיים ברשימת התקנים.`;
    const occ = occupantOf(d.billet);
    if (occ !== null && occ !== d.id) return `תקן ${d.billet} כבר מאויש.`;
  }
  return null;
}
