import { describe, expect, it } from 'vitest';
import { seedData } from '../store/seed';
import { makeBackup, parseBackup } from '../logic/backup';
import { comparePeople, DEFAULT_SORT } from '../logic/people';
import { dataIssues } from '../logic/quality';
import { LADDER, degreeIndex, fixCombo, normalizePerson } from './rules';
import type { Person, PersonRow } from './types';

const base = seedData();
const mk = (id: number, degree: string, pop: Person['pop'], rank: Person['rank']): Person =>
  normalizePerson({ ...base.people[0], id, mid: 7800000 + id, name: `p${id}`, degree, pop, rank, sectionId: 's1', program: null });

describe('קמ"א (חובה) and קא"ב (קבע)', () => {
  it('both are officer degrees, below the other officer degrees and above the top of the NCO ladder', () => {
    expect(degreeIndex('קמ"א')).toBeGreaterThan(degreeIndex('רנ"ג'));
    expect(degreeIndex('קא"ב')).toBeGreaterThan(degreeIndex('קמ"א'));
    expect(degreeIndex('קא"ב')).toBeLessThan(degreeIndex('סג"מ'));
    expect(LADDER.filter((d) => d === 'קמ"א' || d === 'קא"ב')).toHaveLength(2);
  });
  it('each is accepted only for its own population', () => {
    expect(fixCombo({ pop: 'hova' as const, rank: 'officer' as const, degree: 'קמ"א', program: null }).degree).toBe('קמ"א');
    expect(fixCombo({ pop: 'keva' as const, rank: 'officer' as const, degree: 'קא"ב', program: null }).degree).toBe('קא"ב');
    expect(fixCombo({ pop: 'keva' as const, rank: 'officer' as const, degree: 'קמ"א', program: null }).degree).toBe('קא"ב'); // not valid for קבע → first valid degree
    expect(fixCombo({ pop: 'hova' as const, rank: 'officer' as const, degree: 'קא"ב', program: null }).degree).toBe('קמ"א');
  });
  it('they keep the officer fields (education, דמ"ח)', () => {
    const p = mk(1, 'קא"ב', 'keva', 'officer');
    expect(p).toHaveProperty('bachelor');
    expect(p).toHaveProperty('dmahCFirst');
  });
  it('sorting high → low puts them after סגן and before רנ"ג', () => {
    const rows: PersonRow[] = [mk(1, 'רנ"ג', 'keva', 'ncos'), mk(2, 'קא"ב', 'keva', 'officer'), mk(3, 'סגן', 'keva', 'officer'), mk(4, 'קמ"א', 'hova', 'officer'), mk(5, 'סג"מ', 'hova', 'officer')].map((p) => ({ ...p, billet: null }));
    expect(rows.sort(comparePeople(DEFAULT_SORT)).map((r) => r.degree)).toEqual(['סגן', 'סג"מ', 'קא"ב', 'קמ"א', 'רנ"ג']);
  });
  it('the data checks accept them and still reject a wrong combination', () => {
    const d = JSON.parse(JSON.stringify(base));
    d.people.push(mk(100, 'קא"ב', 'keva', 'officer'), mk(101, 'קמ"א', 'hova', 'officer'));
    expect(dataIssues(d, '2026-11-08').filter((i) => i.id === 'p-degree-100' || i.id === 'p-degree-101')).toEqual([]);
    d.people.push({ ...mk(102, 'קמ"א', 'hova', 'officer'), pop: 'keva' }); // קמ"א on a קבע officer
    expect(dataIssues(d, '2026-11-08').map((i) => i.id)).toContain('p-degree-102');
  });
  it('a backup that contains them restores; one with them in the wrong population is refused', () => {
    const d = JSON.parse(JSON.stringify(base));
    d.people.push(mk(100, 'קא"ב', 'keva', 'officer'), mk(101, 'קמ"א', 'hova', 'officer'));
    d.sectionHistory = [];
    expect(parseBackup(JSON.stringify(makeBackup(d))).ok).toBe(true);
    d.people[d.people.length - 1].pop = 'keva';
    expect(parseBackup(JSON.stringify(makeBackup(d))).ok).toBe(false);
  });
});
