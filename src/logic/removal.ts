import type { AppData, ISODate, Person } from '../domain/types';

/** What deleting a person for good would remove. Shown to the user before they confirm. */
export interface Impact {
  notes: number;
  grants: number;
  /** Billet assignments (past and present) — these disappear from the billets' history too. */
  assignments: number;
  sectionPeriods: number;
  /** The billet the person holds now, if any (it becomes vacant). */
  openBillet: number | null;
}

export type Result = { ok: true; data: AppData } | { ok: false; error: string };

const find = (d: AppData, id: number): Person | undefined => d.people.find((p) => p.id === id);

/** A commander cannot be removed: first appoint someone else (so no unit is left without a commander by accident). */
export function removalBlocker(d: AppData, id: number): string | null {
  if (d.commanders.org === id) return 'האדם הוא רע"ן. יש למנות רע"ן אחר לפני הסרה.';
  const sec = Object.entries(d.commanders.sections).find(([, c]) => c === id)?.[0];
  if (sec) return `האדם הוא מפקד ${d.sections.find((s) => s.id === sec)?.name ?? 'מדור'}. יש למנות מפקד אחר לפני הסרה.`;
  return null;
}

export function removalImpact(d: AppData, id: number): Impact {
  return {
    notes: d.notes.filter((n) => n.personId === id).length,
    grants: d.grants.filter((g) => g.personId === id).length,
    assignments: d.assignments.filter((a) => a.personId === id).length,
    sectionPeriods: d.sectionHistory.filter((h) => h.personId === id).length,
    openBillet: d.assignments.find((a) => a.personId === id && a.end === null)?.billetId ?? null,
  };
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/**
 * The person left the unit: they leave the active list but keep all their history.
 * Their billet (if any) is closed on the day they left. Sections, grants, notes and the log are untouched.
 */
export function markLeft(d: AppData, id: number, leftAt: ISODate, note: string, today: ISODate): Result {
  const p = find(d, id);
  if (!p) return { ok: false, error: 'האדם לא נמצא.' };
  if (p.leftAt) return { ok: false, error: 'האדם כבר הוסר מהיחידה.' };
  if (!isDate(leftAt)) return { ok: false, error: 'יש להזין תאריך עזיבה תקין.' };
  if (leftAt > today) return { ok: false, error: 'תאריך העזיבה אינו יכול להיות בעתיד. הסרה מתבצעת לאחר שהאדם כבר עזב.' };
  const blocker = removalBlocker(d, id);
  if (blocker) return { ok: false, error: blocker };
  const text = note.trim().slice(0, 200);
  return {
    ok: true,
    data: {
      ...d,
      people: d.people.map((x) => (x.id === id ? { ...x, leftAt, leftNote: text || null } : x)),
      assignments: d.assignments
        .map((a) => (a.personId === id && a.end === null ? { ...a, end: leftAt } : a))
        .filter((a) => !(a.end !== null && a.end <= a.start)), // never served: no zero-length period
    },
  };
}

/** Back in the unit. They return without a billet (על תקני for keva); nothing else changes. */
export function restoreLeft(d: AppData, id: number): Result {
  const p = find(d, id);
  if (!p) return { ok: false, error: 'האדם לא נמצא.' };
  if (!p.leftAt) return { ok: false, error: 'האדם פעיל ביחידה.' };
  return { ok: true, data: { ...d, people: d.people.map((x) => (x.id === id ? { ...x, leftAt: null, leftNote: null } : x)) } };
}

/** Delete for good (entered by mistake): the person and everything that belongs to them. */
export function deletePerson(d: AppData, id: number): Result {
  if (!find(d, id)) return { ok: false, error: 'האדם לא נמצא.' };
  const blocker = removalBlocker(d, id);
  if (blocker) return { ok: false, error: blocker };
  return {
    ok: true,
    data: {
      ...d,
      people: d.people.filter((p) => p.id !== id),
      notes: d.notes.filter((n) => n.personId !== id),
      grants: d.grants.filter((g) => g.personId !== id),
      assignments: d.assignments.filter((a) => a.personId !== id),
      sectionHistory: d.sectionHistory.filter((h) => h.personId !== id),
    },
  };
}
