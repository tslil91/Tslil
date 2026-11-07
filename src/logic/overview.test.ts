import { describe, expect, it } from 'vitest';
import type { BilletAssignment, Person } from '../domain/types';
import { seedData } from '../store/seed';
import { billetTurnover, officerPrograms, officerProgress, releasesByMonth } from './overview';

const today = '2026-11-07';
const d = seedData();
const P = (id: number, extra: Partial<Person>): Person => ({
  id, name: `p${id}`, mid: 7000000 + id, pop: 'keva', rank: 'officer', degree: 'סרן', program: null, sectionId: null, entryDate: null, releaseDate: null, ...extra,
});

describe('releasesByMonth', () => {
  const people = [
    P(1, { releaseDate: '2026-11-03' }), // already passed this month → not counted
    P(2, { releaseDate: '2026-11-20' }),
    P(3, { releaseDate: '2026-12-01' }),
    P(4, { releaseDate: '2026-12-31' }),
    P(5, { releaseDate: '2027-10-31' }), // last month of the window
    P(6, { releaseDate: '2027-11-01' }), // outside the 12 months
    P(7, { releaseDate: '2026-12-15', rank: 'ncos', degree: 'רס"ל' }),
  ];
  it('12 months from the current one, today onward, officers only by default', () => {
    const r = releasesByMonth(people, today);
    expect(r).toHaveLength(12);
    expect(r[0]).toMatchObject({ key: '2026-11', count: 1, from: today, to: '2026-11-30' });
    expect(r[1]).toMatchObject({ key: '2026-12', count: 2, from: '2026-12-01', to: '2026-12-31' });
    expect(r[11]).toMatchObject({ key: '2027-10', count: 1 });
    expect(r.reduce((s, m) => s + m.count, 0)).toBe(4);
  });
  it('can include everyone', () => {
    expect(releasesByMonth(people, today, 12, false)[1].count).toBe(3);
  });
  it('labels cross the year boundary', () => {
    const r = releasesByMonth([], today);
    expect(r[1].label).toBe('דצמ׳ 26');
    expect(r[2].label).toBe('ינו׳ 27');
  });
});

describe('officer progress and programs', () => {
  it('counts only officers', () => {
    const p = officerProgress(d.people);
    const officers = d.people.filter((x) => x.rank === 'officer').length;
    expect(p.every((x) => x.total === officers)).toBe(true);
    expect(p.find((x) => x.key === 'bachelor')?.yes).toBe(d.people.filter((x) => x.rank === 'officer' && x.bachelor).length);
  });
  it('programs: the five officer programs plus none; soldier program is excluded', () => {
    const r = officerPrograms(d.people);
    expect(r.map((x) => x.label)).toEqual(['עתודה', 'אקדמזיציה', 'פיון', 'תלפיות', 'פסגות', 'ללא תוכנית']);
    expect(r.reduce((s, x) => s + x.count, 0)).toBe(d.people.filter((x) => x.rank === 'officer').length);
    expect(r.find((x) => x.label === 'מט"ל')).toBeUndefined();
  });
});

describe('billetTurnover', () => {
  const A = (billetId: number, start: string, end: string | null): BilletAssignment => ({ id: Math.random(), billetId, personId: null, personName: 'x', start, end });
  const billets = [1, 2, 3, 4].map((id) => ({ id, scope: 'int' as const, kind: 'fix' as const, dmah: false }));
  it('sorts by number of occupants, then shorter stays first; ignores billets without history', () => {
    const r = billetTurnover(billets, [
      A(1, '2020-11-07', '2022-11-07'), A(1, '2022-11-07', '2026-11-07'), // 2 occupants, avg 3y, vacant now
      A(2, '2025-11-07', '2026-05-07'), A(2, '2026-05-07', null), // 2 occupants, shorter stays
      A(3, '2016-11-07', null), // 1 occupant
    ], today);
    expect(r.map((x) => x.billetId)).toEqual([2, 1, 3]);
    expect(r[1]).toMatchObject({ occupants: 2, vacantNow: true });
    expect(r[1].avgYears).toBeCloseTo(3, 0);
    expect(r[2].vacantNow).toBe(false);
  });
  it('limits the list', () => {
    expect(billetTurnover(d.billets, d.assignments, today, 3).length).toBeLessThanOrEqual(3);
  });
});
