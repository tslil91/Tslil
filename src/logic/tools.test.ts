import { describe, expect, it } from 'vitest';
import type { AppData } from '../domain/types';
import { seedData } from '../store/seed';
import { BACKUP_FORMAT, makeBackup, parseBackup } from './backup';
import { bulkMove } from './bulk';
import { compareSnapshots } from './compare';
import { snapshot } from './simulator';
import { decodeView, describeFilterCount, encodeView, validateViewName, type ViewState } from './views';

const fresh = (): AppData => JSON.parse(JSON.stringify(seedData()));

describe('backup', () => {
  it('round trip: what you save is what you restore', () => {
    const d = fresh();
    const r = parseBackup(JSON.stringify(makeBackup(d)));
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.data).toEqual(d);
    expect(r.counts).toMatchObject({ people: 16, billets: 12, grants: 13 });
  });
  it('rejects files that are not backups, broken JSON, or newer versions', () => {
    expect(parseBackup('not json').ok).toBe(false);
    expect(parseBackup('{"a":1}').errors[0]).toMatch('אינו קובץ גיבוי');
    expect(parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 99, data: {} })).errors[0]).toMatch('חדשה');
  });
  it('rejects bad records and broken references, listing what is wrong', () => {
    const b = makeBackup(fresh());
    (b.data.people[0] as { degree: string }).degree = 'לא קיים';
    b.data.people[1].sectionId = 'nope';
    b.data.assignments.push({ id: 99, billetId: 424242, personId: null, personName: 'x', start: '2020-01-01', end: null });
    b.data.grants[0].personId = 999;
    const r = parseBackup(JSON.stringify(b));
    expect(r.ok).toBe(false);
    expect(r.errors.join(' | ')).toMatch(/שילוב אוכלוסייה/);
    expect(r.errors.join(' | ')).toMatch(/מדור שאינו קיים/);
    expect(r.errors.join(' | ')).toMatch(/תקן 424242/);
    expect(r.errors.join(' | ')).toMatch(/האדם אינו קיים/);
  });
  it('drops unknown fields and fills missing optional parts (old backups without notes / history)', () => {
    const b = makeBackup(fresh()) as unknown as { data: Record<string, unknown> };
    delete b.data.notes; delete b.data.sectionHistory;
    (b.data.people as Record<string, unknown>[])[0].evil = '<script>';
    const r = parseBackup(JSON.stringify(b));
    expect(r.ok).toBe(true);
    expect(r.data!.notes).toEqual([]);
    expect(r.data!.sectionHistory.length).toBe(16);
    expect('evil' in r.data!.people[0]).toBe(false);
  });
  it('duplicate ids and מ.א are rejected', () => {
    const b = makeBackup(fresh());
    b.data.people[1].mid = b.data.people[0].mid;
    expect(parseBackup(JSON.stringify(b)).errors.join()).toMatch('מ.א כפול');
  });
});

describe('bulkMove', () => {
  const d = fresh();
  it('moves several people to a section; section commanders lose their command; org commander is skipped', () => {
    const r = bulkMove(d.people, d.commanders, [2, 6, 1, 3], { kind: 'section', id: 's2' });
    // 2 = commander of s1 (moves → loses command), 6 and 3 are in s1, 1 = org commander (skipped)
    expect(r.moved).toBe(3);
    expect(r.commandsEnded).toBe(1);
    expect(r.skipped).toEqual([{ id: 1, name: 'דנה רוזן', reason: 'רע"ן אינו משויך למדור' }]);
    expect(r.commanders.sections.s1).toBeNull();
    expect(r.commanders.org).toBe(1);
    expect(r.people.filter((p) => p.sectionId === 's2').map((p) => p.id).sort((a, b) => a - b)).toEqual([2, 3, 4, 5, 6, 10, 12, 16]);
  });
  it('already in the destination counts as unchanged; duplicates in the id list are ignored', () => {
    const r = bulkMove(d.people, d.commanders, [4, 4, 5], { kind: 'section', id: 's2' });
    expect(r).toMatchObject({ moved: 0, unchanged: 2, commandsEnded: 0 });
    expect(r.people).toBe(d.people);
  });
  it('moving to the head of the organization removes the section from them', () => {
    const r = bulkMove(d.people, d.commanders, [9, 15], { kind: 'org' });
    expect(r.moved).toBe(2);
    expect(r.people.filter((p) => p.sectionId === null).map((p) => p.id).sort((a, b) => a - b)).toEqual([1, 9, 14, 15]);
  });
});

describe('saved views', () => {
  const v: ViewState = { query: 'כהן', filters: { rank: 'officer', releaseDate: 'r:2026-12-01..2027-01-31', section: 's1' }, sort: { key: 'releaseDate', dir: 1 }, showEdu: false, showDmah: true, view: 'tree' };
  it('encode → decode returns the same view (Hebrew included)', () => {
    const code = encodeView(v);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeView(code)).toEqual(v);
  });
  it('rejects garbage, oversized and tampered input; drops unknown filters', () => {
    expect(decodeView('')).toBeNull();
    expect(decodeView('%%%')).toBeNull();
    expect(decodeView('a'.repeat(5000))).toBeNull();
    expect(decodeView(btoa('not json').replace(/=/g, ''))).toBeNull();
    const evil = btoa(JSON.stringify({ query: 1, filters: { __proto__: 'x', hack: 'y', rank: 'officer', releaseDate: 'bogus' }, sort: { key: 'nope', dir: 5 }, view: 'x' })).replace(/=/g, '');
    const out = decodeView(evil)!;
    expect(out.filters).toEqual({ rank: 'officer' });
    expect(out.sort).toEqual({ key: 'degree', dir: -1 });
    expect(out.query).toBe('');
    expect(out.view).toBe('table');
  });
  it('name validation and description', () => {
    const saved = [{ ...v, id: '1', name: 'קצינים משתחררים' }];
    expect(validateViewName(' ', saved)).toMatch('שם');
    expect(validateViewName('קצינים משתחררים', saved)).toMatch('קיימת');
    expect(validateViewName('חדש', saved)).toBeNull();
    expect(describeFilterCount(v)).toBe('4 סינונים');
    expect(describeFilterCount({ ...v, filters: {}, query: '' })).toBe('ללא סינון');
  });
});

describe('compareSnapshots', () => {
  const d = fresh();
  const sim = (date: string) => snapshot({ ...d }, [], date);
  it('same date → nothing changed', () => {
    expect(compareSnapshots(sim('2026-11-07'), sim('2026-11-07')).changes).toBe(0);
  });
  it('past section moves (from the dated history), releases and billets between two dates', () => {
    const c = compareSnapshots(sim('2026-02-01'), sim('2026-11-07'));
    expect(c.moved.find((m) => m.person.id === 3)).toMatchObject({ from: 'מדור כוח אדם', to: 'מדור מבצעים' }); // moved on 2026-03-01
    expect(c.billets.some((b) => b.billetId === 1011 && b.kind === 'changed' || b.kind === 'vacated')).toBe(true);
  });
  it('future: a release empties a billet and a person leaves the organization', () => {
    const c = compareSnapshots(sim('2026-11-07'), sim('2027-02-01'));
    expect(c.left.map((x) => x.person.name)).toEqual(expect.arrayContaining(['מאיה סעד', 'תומר דהן']));
    expect(c.billets.find((b) => b.billetId === 1021)).toBeUndefined();
    expect(c.kpis.find((k) => k.label === 'אנשים בארגון')!.delta).toBeLessThan(0);
  });
});
