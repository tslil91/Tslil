import { describe, expect, it } from 'vitest';
import type { AppData } from '../domain/types';
import { seedData } from '../store/seed';
import { dataIssues } from './quality';
import { deletePerson, markLeft, removalBlocker, removalImpact, restoreLeft } from './removal';
import { snapshot } from './simulator';
import { attentionItems } from './attention';

const fresh = (): AppData => JSON.parse(JSON.stringify(seedData()));
const T = '2026-11-08';
const ok = (r: ReturnType<typeof markLeft>) => { if (!r.ok) throw new Error(r.error); return r.data; };

describe('commanders cannot be removed', () => {
  it('the org head and a section commander are blocked, with a reason', () => {
    const d = fresh();
    expect(removalBlocker(d, 1)).toMatch('רע"ן');
    expect(removalBlocker(d, 2)).toMatch('מדור מבצעים');
    expect(removalBlocker(d, 6)).toBeNull();
    expect(markLeft(d, 1, '2026-11-08', '', T).ok).toBe(false);
    expect(deletePerson(d, 2).ok).toBe(false);
  });
});

describe('markLeft (left the unit)', () => {
  it('keeps the person and all their history, closes the billet on the leaving day', () => {
    const d = fresh();
    const n = ok(markLeft(d, 6, '2026-11-08', '  עבר לצבא קבע אחר  ', T)); // עמית on billet 1004
    const p = n.people.find((x) => x.id === 6)!;
    expect(p).toMatchObject({ leftAt: '2026-11-08', leftNote: 'עבר לצבא קבע אחר' });
    expect(n.assignments.find((a) => a.billetId === 1004 && a.personId === 6)).toMatchObject({ start: '2019-02-01', end: '2026-11-08' });
    expect(n.grants.filter((g) => g.personId === 6)).toHaveLength(d.grants.filter((g) => g.personId === 6).length);
    expect(n.sectionHistory.filter((h) => h.personId === 6)).toEqual(d.sectionHistory.filter((h) => h.personId === 6));
    expect(n.people).toHaveLength(d.people.length);
  });
  it('rejects a bad date, an unknown or an already removed person', () => {
    const d = fresh();
    expect(markLeft(d, 6, 'x', '', T).ok).toBe(false);
    expect(markLeft(d, 999, '2026-11-08', '', T).ok).toBe(false);
    expect(markLeft(ok(markLeft(d, 6, '2026-11-08', '', T)), 6, '2026-11-09', '', T).ok).toBe(false);
  });
  it('the leaving date cannot be in the future', () => {
    expect(markLeft(fresh(), 6, '2026-11-09', '', T)).toMatchObject({ ok: false });
    expect(markLeft(fresh(), 6, '2026-11-08', '', T).ok).toBe(true);
  });
  it('a billet period that would end before it started is dropped (no zero-length history)', () => {
    const d = fresh(); // עמית started on billet 1004 on 2019-02-01
    const n = ok(markLeft(d, 6, '2019-02-01', '', T));
    expect(n.assignments.some((a) => a.billetId === 1004 && a.personId === 6)).toBe(false);
  });
  it('can be undone: restored with no billet, history intact', () => {
    const d = fresh();
    const left = ok(markLeft(d, 6, '2026-11-08', 'x', T));
    const back = ok(restoreLeft(left, 6));
    expect(back.people.find((p) => p.id === 6)).toMatchObject({ leftAt: null, leftNote: null });
    expect(back.assignments.find((a) => a.billetId === 1004 && a.personId === 6)?.end).toBe('2026-11-08'); // still ended; they come back on על תקני
    expect(restoreLeft(back, 6).ok).toBe(false);
  });
});

describe('a person who left is invisible in the live views but not in history', () => {
  const today = '2026-11-08';
  it('simulator: present before the leaving day, gone from that day', () => {
    const d = ok(markLeft(fresh(), 6, '2026-11-08', '', T));
    const inAny = (date: string) => snapshot({ ...d }, [], date).groups.some((g) => g.people.some((x) => x.person.id === 6));
    expect(inAny('2026-11-07')).toBe(true);
    expect(inAny('2026-11-08')).toBe(false);
    expect(inAny('2027-03-01')).toBe(false);
  });
  it('attention list ignores them', () => {
    const d = fresh();
    d.people.find((p) => p.id === 7)!.releaseDate = '2026-12-01'; // would be listed as leaving soon... if active
    const before = attentionItems(d, today).benchLong.some((x) => x.person.id === 7);
    const after = attentionItems(ok(markLeft(d, 7, today, '', T)), today).benchLong.some((x) => x.person.id === 7);
    expect(before).toBe(true);
    expect(after).toBe(false);
  });
  it('data checks do not nag about missing dates of someone who left', () => {
    const d = fresh(); d.people.find((p) => p.id === 6)!.releaseDate = null; d.people.find((p) => p.id === 6)!.entryDate = null;
    expect(dataIssues(d, today).map((i) => i.id)).toEqual(expect.arrayContaining(['p-release-6', 'p-entry-6']));
    expect(dataIssues(ok(markLeft(d, 6, today, '', T)), today).map((i) => i.id)).not.toContain('p-release-6');
  });
});

describe('deletePerson (entered by mistake)', () => {
  it('shows the impact first, then removes everything that belongs to the person', () => {
    const d = fresh();
    d.notes.push({ id: 1, personId: 6, text: 'x', createdAt: '2026-01-01T00:00:00Z', author: 'a' });
    const impact = removalImpact(d, 6);
    expect(impact).toMatchObject({ notes: 1, grants: 2, assignments: 1, openBillet: 1004 });
    const n = ok(deletePerson(d, 6));
    expect(n.people.some((p) => p.id === 6)).toBe(false);
    expect(n.notes.some((x) => x.personId === 6)).toBe(false);
    expect(n.grants.some((g) => g.personId === 6)).toBe(false);
    expect(n.assignments.some((a) => a.personId === 6)).toBe(false);
    expect(n.sectionHistory.some((h) => h.personId === 6)).toBe(false);
    expect(n.people).toHaveLength(d.people.length - 1);
    expect(n.assignments.some((a) => a.billetId === 1004 && a.end === null)).toBe(false); // the billet is vacant
    expect(dataIssues(n, '2026-11-08').filter((i) => i.severity === 'error')).toEqual([]); // nothing dangling
  });
  it('other people and billets are untouched', () => {
    const d = fresh();
    const n = ok(deletePerson(d, 6));
    expect(n.people.filter((p) => p.id !== 6)).toEqual(d.people.filter((p) => p.id !== 6));
    expect(n.billets).toEqual(d.billets);
    expect(deletePerson(d, 999).ok).toBe(false);
  });
});
