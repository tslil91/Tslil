import { describe, expect, it } from 'vitest';
import type { Billet, Commanders, Person, PersonRow } from '../domain/types';
import { DEFAULT_SORT, applyPlacement, groupPeople, matchesFilters, placementOf, validatePerson, type PersonDraft } from './people';

const P = (id: number, name: string, degree: string, sectionId: string | null, extra: Partial<Person> = {}): PersonRow => ({
  id, name, mid: 7000000 + id, pop: 'keva', rank: 'officer', degree, program: null, sectionId,
  entryDate: null, releaseDate: null, billet: null, ...extra,
});

const sections = [{ id: 's1', name: 'מדור א' }, { id: 's2', name: 'מדור ב' }];
const cmd: Commanders = { org: 1, sections: { s1: 3, s2: null } };
const rows = [P(1, 'מפקדת', 'אל"מ', null), P(2, 'ישיר', 'סרן', null), P(3, 'מפקד א', 'סרן', 's1'), P(4, 'בכיר', 'סא"ל', 's1'), P(5, 'זוטר', 'סגן', 's1')];

describe('groupPeople', () => {
  it('org level first, then sections', () => {
    expect(groupPeople(rows, sections, cmd, DEFAULT_SORT, rows).map((g) => g.id)).toEqual(['org', 's1', 's2']);
  });
  it('commander first, then degree high → low', () => {
    const s1 = groupPeople(rows, sections, cmd, DEFAULT_SORT, rows)[1];
    expect(s1.rows.map((r) => r.id)).toEqual([3, 4, 5]);
  });
  it('commander stays first under any sort', () => {
    const s1 = groupPeople(rows, sections, cmd, { key: 'name', dir: 1 }, rows)[1];
    expect(s1.rows[0].id).toBe(3);
  });
});

describe('matchesFilters', () => {
  const today = '2026-11-07';
  it('search matches name or מ.א', () => {
    expect(matchesFilters(rows[3], {}, 'בכיר', today)).toBe(true);
    expect(matchesFilters(rows[3], {}, '7000004', today)).toBe(true);
    expect(matchesFilters(rows[3], {}, 'אין', today)).toBe(false);
  });
  it('not-applicable fields never match a filter', () => {
    const soldier = P(9, 'חייל', 'טוראי', 's1', { pop: 'hova', rank: 'soldier' });
    expect(matchesFilters(soldier, { bachelor: 'no' }, '', today)).toBe(false);
    expect(matchesFilters(soldier, { billet: 'bench' }, '', today)).toBe(false);
    expect(matchesFilters(soldier, { program: 'none' }, '', today)).toBe(true);
  });
  it('date buckets', () => {
    const r = P(9, 'א', 'סרן', null, { releaseDate: '2027-01-15' });
    expect(matchesFilters(r, { releaseDate: 'd90' }, '', today)).toBe(true);
    expect(matchesFilters(r, { releaseDate: 'past' }, '', today)).toBe(false);
  });
});

describe('applyPlacement', () => {
  const people: Person[] = rows.map(({ billet: _b, ...p }) => p);
  it('appointing org commander removes section and section command', () => {
    const r = applyPlacement(people, cmd, 3, 'orgcmd');
    expect(r.commanders.org).toBe(3);
    expect(r.commanders.sections.s1).toBeNull();
    expect(r.people.find((p) => p.id === 3)?.sectionId).toBeNull();
  });
  it('moving the org commander into a section clears the org command', () => {
    const r = applyPlacement(people, cmd, 1, 'sec:s2');
    expect(r.commanders.org).toBeNull();
    expect(r.people.find((p) => p.id === 1)?.sectionId).toBe('s2');
  });
  it('appointing a section commander replaces the previous one, who stays in the section', () => {
    const r = applyPlacement(people, cmd, 4, 'cmd:s1');
    expect(r.commanders.sections.s1).toBe(4);
    expect(r.people.find((p) => p.id === 3)?.sectionId).toBe('s1');
    expect(placementOf(r.people.find((p) => p.id === 3)!, r.commanders)).toBe('sec:s1');
  });
});

describe('validatePerson', () => {
  const billets: Billet[] = [{ id: 1001, scope: 'int', kind: 'fix', dmah: true }];
  const people: Person[] = rows.map(({ billet: _b, ...p }) => p);
  const draft = (patch: Partial<PersonDraft> = {}): PersonDraft => ({ ...P(0, 'חדש', 'סגן', 's1'), mid: '7123456', ...patch });
  const free = () => null;
  it('requires name and a 5–9 digit מ.א', () => {
    expect(validatePerson(draft({ name: ' ' }), people, billets, free)).toMatch('שם');
    expect(validatePerson(draft({ mid: '12' }), people, billets, free)).toMatch('ספרות');
  });
  it('rejects a duplicate מ.א', () => {
    expect(validatePerson(draft({ mid: '7000001' }), people, billets, free)).toMatch('קיים');
  });
  it('billet must exist and be vacant', () => {
    expect(validatePerson(draft({ billet: 9999 }), people, billets, free)).toMatch('אינו קיים');
    expect(validatePerson(draft({ billet: 1001 }), people, billets, () => 2)).toMatch('מאויש');
    expect(validatePerson(draft({ billet: 1001 }), people, billets, free)).toBeNull();
  });
});
