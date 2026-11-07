import type { Billet, BilletAssignment, ISODate } from '../domain/types';

export const nextId = (items: { id: number }[]): number => items.reduce((m, x) => Math.max(m, x.id), 0) + 1;

export function openAssignment(assignments: BilletAssignment[], billetId: number): BilletAssignment | null {
  return assignments.find((a) => a.billetId === billetId && a.end === null) ?? null;
}

/** personId → current billet id. */
export function billetByPerson(assignments: BilletAssignment[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const a of assignments) if (a.end === null && a.personId !== null) m.set(a.personId, a.billetId);
  return m;
}

/** History of a billet, latest first. */
export function billetHistory(assignments: BilletAssignment[], billetId: number): BilletAssignment[] {
  return assignments.filter((a) => a.billetId === billetId).sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0));
}

/**
 * Put a person on a billet (or on על תקני when billetId is null) from `today`.
 * Closes the person's open assignment instead of deleting it, so history is kept.
 * An assignment that would end on the day it started is removed (no zero-length periods).
 */
export function setPersonBillet(
  assignments: BilletAssignment[],
  person: { id: number; name: string },
  billetId: number | null,
  today: ISODate,
): BilletAssignment[] {
  const current = assignments.find((a) => a.personId === person.id && a.end === null);
  if ((current?.billetId ?? null) === billetId) return assignments;
  let next = assignments
    .map((a) => (a === current ? { ...a, end: today } : a))
    .filter((a) => !(a.end !== null && a.end <= a.start));
  if (billetId !== null) {
    next = [...next, { id: nextId(assignments), billetId, personId: person.id, personName: person.name, start: today, end: null }];
  }
  return next;
}

export function validateNewBillet(idText: string, billets: Billet[]): string | null {
  if (!/^\d{1,9}$/.test(idText.trim())) return 'יש להזין מספר תקן (ספרות בלבד).';
  if (billets.some((b) => b.id === Number(idText))) return 'מספר תקן זה כבר קיים.';
  return null;
}

/** Deleting a billet removes it and its history; its occupant becomes על תקני. */
export function removeBillet(billets: Billet[], assignments: BilletAssignment[], billetId: number) {
  return {
    billets: billets.filter((b) => b.id !== billetId),
    assignments: assignments.filter((a) => a.billetId !== billetId),
  };
}
