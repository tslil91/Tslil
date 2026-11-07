import { describe, expect, it } from 'vitest';
import type { BilletAssignment, Person } from '../domain/types';
import { applyScenario, assignError, changePoints, isActive, snapshot, type ScenarioOp, type SimData } from './simulator';

const P = (id: number, extra: Partial<Person> = {}): Person => ({
  id, name: `p${id}`, mid: 7000000 + id, pop: 'keva', rank: 'officer', degree: 'סרן', program: null,
  sectionId: 's1', entryDate: '2010-01-01', releaseDate: null, ...extra,
});
const A = (id: number, billetId: number, personId: number | null, start: string, end: string | null): BilletAssignment => ({ id, billetId, personId, personName: personId === null ? `h${billetId}` : `p${personId}`, start, end });

const data: SimData = {
  people: [P(1), P(2), P(3, { releaseDate: '2027-01-01' }), P(4, { entryDate: '2027-06-01' }), P(5, { pop: 'hova', rank: 'soldier', degree: 'טוראי', entryDate: null })],
  billets: [1, 2, 3].map((id) => ({ id, scope: 'int' as const, kind: 'fix' as const, dmah: false })),
  assignments: [A(1, 1, 1, '2020-01-01', null), A(2, 2, null, '2015-01-01', '2026-06-01'), A(3, 3, 3, '2024-01-01', null)],
  sections: [{ id: 's1', name: 'מדור' }],
  commanders: { org: null, sections: { s1: 1 } },
};

describe('intervals', () => {
  it('are half-open [start, end)', () => {
    const a = A(1, 1, 1, '2026-01-01', '2026-02-01');
    expect(isActive(a, '2026-01-01')).toBe(true);
    expect(isActive(a, '2026-01-31')).toBe(true);
    expect(isActive(a, '2026-02-01')).toBe(false);
  });
});

describe('snapshot', () => {
  it('shows historical occupants and vacancies on a past date', () => {
    const s = snapshot(data, [], '2025-01-01');
    expect(s.billets.find((b) => b.billet.id === 2)?.occupantName).toBe('h2'); // historical name (personId null)
    expect(s.kpis).toMatchObject({ billets: 3, filled: 3, vacant: 0 });
  });
  it('a release date frees the billet and removes the person', () => {
    const s = snapshot(data, [], '2027-01-01');
    expect(s.billets.find((b) => b.billet.id === 3)?.occupant).toBeNull();
    expect(s.released.map((p) => p.id)).toEqual([3]);
    expect(s.groups[1].people.some((x) => x.person.id === 3)).toBe(false);
  });
  it('bench = present keva people without a billet; not-yet-entered keva are absent', () => {
    const s = snapshot(data, [], '2026-11-07');
    expect(s.bench.map((b) => b.person.id)).toEqual([2]);
    expect(s.notYetJoined.map((p) => p.id)).toEqual([4]);
    expect(snapshot(data, [], '2027-07-01').bench.map((b) => b.person.id).sort()).toEqual([2, 4]);
  });
  it('commander first in the group', () => {
    expect(snapshot(data, [], '2026-11-07').groups[1].people[0].person.id).toBe(1);
  });
});

describe('scenario', () => {
  const nameOf = (id: number) => `p${id}`;
  it('assigning from a date never changes the real assignments', () => {
    const ops: ScenarioOp[] = [{ id: 1, kind: 'assign', personId: 2, billetId: 2, date: '2027-01-01' }];
    const before = JSON.stringify(data.assignments);
    const s = snapshot(data, ops, '2027-02-01');
    expect(JSON.stringify(data.assignments)).toBe(before);
    expect(s.billets.find((b) => b.billet.id === 2)).toMatchObject({ occupantName: 'p2', fromScenario: true });
    expect(snapshot(data, ops, '2026-12-31').billets.find((b) => b.billet.id === 2)?.occupant).toBeNull();
  });
  it('moving someone closes their current billet on that date', () => {
    const s = snapshot(data, [{ id: 1, kind: 'assign', personId: 1, billetId: 2, date: '2027-01-01' }], '2027-01-01');
    expect(s.billets.find((b) => b.billet.id === 1)?.occupant).toBeNull();
    expect(s.billets.find((b) => b.billet.id === 2)?.occupantName).toBe('p1');
  });
  it('release sends the person to the bench', () => {
    const s = snapshot(data, [{ id: 1, kind: 'release', personId: 1, date: '2027-03-01' }], '2027-03-01');
    expect(s.bench.map((b) => b.person.id)).toContain(1);
  });
  it('an assignment is capped by a later occupant of the same billet', () => {
    const list = applyScenario(data.assignments, [
      { id: 1, kind: 'assign', personId: 2, billetId: 2, date: '2027-05-01' },
      { id: 2, kind: 'assign', personId: 4, billetId: 2, date: '2027-08-01' },
    ].reverse() as ScenarioOp[], nameOf);
    expect(list.filter((a) => a.billetId === 2 && a.start === '2027-05-01')[0].end).toBe('2027-08-01');
  });
  it('validates planned assignments', () => {
    const s = snapshot(data, [], '2026-11-07');
    expect(assignError(s, 2, 2)).toBeNull();
    expect(assignError(s, 1, 2)).toMatch('אינו על תקני');
    expect(assignError(s, 2, 1)).toMatch('מאויש');
  });
  it('change points include scenario dates and release dates', () => {
    const pts = changePoints(data, [{ id: 1, kind: 'release', personId: 1, date: '2028-01-01' }]);
    expect(pts).toContain('2028-01-01');
    expect(pts).toContain('2027-01-01');
    expect(pts).toEqual([...pts].sort());
  });
});
