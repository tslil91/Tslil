import type { ISODate, Person, SectionId, SectionPeriod } from '../domain/types';
import { nextId } from './billets';

/** "Since always" — used for the first period of a person whose earlier history is unknown. */
export const SINCE_ALWAYS: ISODate = '1900-01-01';

const isOpenOn = (p: SectionPeriod, d: ISODate) => p.start <= d && (p.end === null || d < p.end);

/** The section a person belonged to on a date. Falls back to the current section when there is no history. */
export function sectionAt(history: SectionPeriod[], person: Person, d: ISODate): SectionId | null {
  const mine = history.filter((h) => h.personId === person.id);
  if (mine.length === 0) return person.sectionId;
  const hit = mine.find((h) => isOpenOn(h, d));
  return hit ? hit.sectionId : person.sectionId;
}

/**
 * Keep the history in step with the people list. For every person whose current section differs from the
 * section of their open period, close that period today and open a new one. A period that would start and end
 * on the same day is removed, so several moves in one day leave a single period.
 */
export function deriveSectionHistory(history: SectionPeriod[], people: Person[], today: ISODate): SectionPeriod[] {
  let list = history;
  let id = nextId(history);
  for (const p of people) {
    const open = list.find((h) => h.personId === p.id && h.end === null);
    if (open && open.sectionId === p.sectionId) continue;
    if (list === history) list = [...history];
    if (open) {
      list = open.start >= today
        ? list.filter((h) => h !== open)
        : list.map((h) => (h === open ? { ...h, end: today } : h));
    }
    list.push({ id: id++, personId: p.id, sectionId: p.sectionId, start: open ? today : SINCE_ALWAYS, end: null });
  }
  return list;
}

/** A person's periods, newest first. */
export const periodsOf = (history: SectionPeriod[], personId: number): SectionPeriod[] =>
  history.filter((h) => h.personId === personId).sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0));
