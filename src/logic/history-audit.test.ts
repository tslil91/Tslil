import { describe, expect, it } from 'vitest';
import type { AppData, Person } from '../domain/types';
import { seedData } from '../store/seed';
import { diffData } from './audit';
import { SINCE_ALWAYS, deriveSectionHistory, sectionAt } from './history';

const base = (): AppData => seedData();
const clone = (d: AppData): AppData => JSON.parse(JSON.stringify(d));

describe('section history', () => {
  it('falls back to the current section when there is no history', () => {
    const p = base().people[0];
    expect(sectionAt([], p, '2020-01-01')).toBe(p.sectionId);
  });
  it('seed demo: past moves are reflected on past dates', () => {
    const d = base();
    const michal = d.people.find((p) => p.id === 3)!;
    expect(sectionAt(d.sectionHistory, michal, '2026-02-01')).toBe('s2');
    expect(sectionAt(d.sectionHistory, michal, '2026-03-01')).toBe('s1'); // half-open: the new period starts on its first day
    expect(sectionAt(d.sectionHistory, michal, '2030-01-01')).toBe('s1');
  });
  it('a move closes the open period today and opens a new one', () => {
    const d = base();
    const people = d.people.map((p) => (p.id === 2 ? { ...p, sectionId: 's2' } : p));
    const h = deriveSectionHistory(d.sectionHistory, people, '2026-11-07');
    const mine = h.filter((x) => x.personId === 2);
    expect(mine).toHaveLength(2);
    expect(mine.find((x) => x.end === '2026-11-07')?.sectionId).toBe('s1');
    expect(mine.find((x) => x.end === null)).toMatchObject({ sectionId: 's2', start: '2026-11-07' });
  });
  it('several moves on the same day leave one period (no zero-length periods)', () => {
    const d = base();
    let people = d.people.map((p) => (p.id === 2 ? { ...p, sectionId: 's2' } : p));
    let h = deriveSectionHistory(d.sectionHistory, people, '2026-11-07');
    people = people.map((p) => (p.id === 2 ? { ...p, sectionId: 's3' } : p));
    h = deriveSectionHistory(h, people, '2026-11-07');
    const mine = h.filter((x) => x.personId === 2);
    expect(mine.map((x) => x.sectionId)).toEqual(['s1', 's3']);
    expect(mine.every((x) => x.end === null || x.end > x.start)).toBe(true);
  });
  it('moving back on the same day restores the original period', () => {
    const d = base();
    let people = d.people.map((p) => (p.id === 2 ? { ...p, sectionId: 's2' } : p));
    let h = deriveSectionHistory(d.sectionHistory, people, '2026-11-07');
    people = d.people;
    h = deriveSectionHistory(h, people, '2026-11-07');
    const mine = h.filter((x) => x.personId === 2);
    expect(mine.find((x) => x.end === null)?.sectionId).toBe('s1');
  });
  it('a new person gets an open period "since always"; no change returns the same array', () => {
    const d = base();
    const np: Person = { ...d.people[0], id: 99, mid: 7999999, name: 'חדש' };
    const h = deriveSectionHistory(d.sectionHistory, [...d.people, np], '2026-11-07');
    expect(h.find((x) => x.personId === 99)).toMatchObject({ start: SINCE_ALWAYS, end: null });
    expect(deriveSectionHistory(d.sectionHistory, d.people, '2026-11-07')).toBe(d.sectionHistory);
  });
});

describe('diffData (audit log)', () => {
  it('no change → no entries', () => {
    const d = base();
    expect(diffData(d, clone(d))).toEqual([]);
  });
  it('person edit lists every changed field in Hebrew, tied to the person', () => {
    const a = base(); const b = clone(a);
    const p = b.people.find((x) => x.id === 4)!; p.degree = 'רס"ן'; p.program = 'עתודה'; p.releaseDate = '2030-01-01';
    const e = diffData(a, b);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ kind: 'person', personId: 4 });
    expect(e[0].details.map((x) => x.label)).toEqual(['דרגה', 'תוכנית', 'שחרור']);
    expect(e[0].details[2]).toEqual({ label: 'שחרור', from: '01/08/2029', to: '01/01/2030' });
    expect(e[0].summary).toContain('אורי לוי');
  });
  it('section move is described with section names', () => {
    const a = base(); const b = clone(a);
    b.people.find((x) => x.id === 2)!.sectionId = 's2';
    const d = diffData(a, b)[0].details[0];
    expect(d).toEqual({ label: 'מיקום בארגון', from: 'מדור מבצעים', to: 'מדור כוח אדם' });
  });
  it('commander appointment and removal', () => {
    const a = base(); const b = clone(a);
    b.commanders.sections.s1 = 3;
    const e = diffData(a, b);
    expect(e.map((x) => x.summary)).toEqual(['יוסי כהן הוסר/ה מתפקיד מפקד מדור מבצעים', 'מיכל ביטון מונה/תה למפקד מדור מבצעים']);
    expect(e.every((x) => x.kind === 'commander')).toBe(true);
  });
  it('sections: add, rename, delete', () => {
    const a = base(); const b = clone(a);
    b.sections[0].name = 'מדור תכנון'; b.sections.push({ id: 's4', name: 'חדש' }); b.sections = b.sections.filter((s) => s.id !== 's3');
    const s = diffData(a, b).map((x) => x.summary);
    expect(s).toContain('שם המדור שונה מ"מדור מבצעים" ל"מדור תכנון"');
    expect(s).toContain('נוסף מדור "חדש"');
    expect(s).toContain('נמחק המדור "מדור לוגיסטיקה"');
  });
  it('billet changes and billet assignment changes show for the person', () => {
    const a = base(); const b = clone(a);
    b.billets.find((x) => x.id === 1002)!.kind = 'tmp';
    const open = b.assignments.find((x) => x.billetId === 1004 && x.end === null)!; open.end = '2026-11-07';
    b.assignments.push({ id: 900, billetId: 1006, personId: 6, personName: 'עמית שפירא', start: '2026-11-07', end: null });
    const e = diffData(a, b);
    expect(e.find((x) => x.summary.startsWith('תקן 1002'))?.details[0]).toMatchObject({ label: 'קבוע / זמני', to: 'זמני' });
    expect(e.find((x) => x.summary.includes('הוסר/ה מתקן 1004'))?.personId).toBe(6);
    expect(e.find((x) => x.summary.includes('שובץ/ה בתקן 1006'))?.personId).toBe(6);
  });
  it('deleting a billet logs only the deletion', () => {
    const a = base(); const b = clone(a);
    b.billets = b.billets.filter((x) => x.id !== 1001); b.assignments = b.assignments.filter((x) => x.billetId !== 1001);
    expect(diffData(a, b).map((x) => x.summary)).toEqual(['נמחק תקן 1001']);
  });
  it('grants: add, edit, delete; notes', () => {
    const a = base(); const b = clone(a);
    b.grants.push({ id: 99, personId: 2, type: 'voucher', signingMonths: null, signingStart: null, signingEnd: null, amount: 500, basis: 'net', enteredAt: '2026-11-07' });
    b.grants.find((g) => g.id === 1)!.amount = 61000;
    b.grants = b.grants.filter((g) => g.id !== 2);
    b.notes.push({ id: 1, personId: 3, text: 'הערה לדוגמה', createdAt: '2026-11-07T10:00:00.000Z', author: 'x' });
    const s = diffData(a, b).map((x) => x.summary);
    expect(s.some((x) => x.startsWith('נוסף ליוסי כהן: שובר'))).toBe(true);
    expect(s.some((x) => x.includes('תוקן מענק') && x.includes('סכום'))).toBe(true);
    expect(s.some((x) => x.startsWith('נמחק מדנה רוזן'))).toBe(true);
    expect(s).toContain('נוספה הערה למיכל ביטון');
  });
  it('a huge change collapses into one system entry', () => {
    const a = base(); const b = clone(a);
    b.people = Array.from({ length: 2100 }, (_, i) => ({ ...a.people[0], id: 1000 + i, mid: 8000000 + i }));
    const e = diffData(a, b);
    expect(e).toHaveLength(1);
    expect(e[0].kind).toBe('system');
  });
});
