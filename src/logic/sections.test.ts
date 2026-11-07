import { describe, expect, it } from 'vitest';
import { seedData } from '../store/seed';
import { addSection, deleteSection, newSectionId, renameSection, validateSectionName } from './sections';
import { groupPeople, DEFAULT_SORT } from './people';

const d = seedData();

describe('validateSectionName', () => {
  it('requires a name, rejects duplicates (ignoring itself) and very long names', () => {
    expect(validateSectionName('  ', d.sections)).toMatch('שם');
    expect(validateSectionName('מדור מבצעים', d.sections)).toMatch('קיים');
    expect(validateSectionName(' מדור מבצעים ', d.sections, 's1')).toBeNull();
    expect(validateSectionName('מדור מבצעים', d.sections, 's2')).toMatch('קיים');
    expect(validateSectionName('א'.repeat(41), d.sections)).toMatch('ארוך');
    expect(validateSectionName('מדור חדש', d.sections)).toBeNull();
  });
});

describe('add / rename', () => {
  it('adds a section at the end with no commander', () => {
    const r = addSection(d.sections, d.commanders, ' מדור חדש ');
    expect(r.sections.at(-1)).toEqual({ id: 's4', name: 'מדור חדש' });
    expect(r.commanders.sections.s4).toBeNull();
  });
  it('ids are not reused after a deletion', () => {
    const after = deleteSection(d.sections, d.people, d.commanders, 's3');
    expect(newSectionId(after.sections)).toBe('s3');
    const withS4 = [...d.sections, { id: 's4', name: 'x' }];
    expect(newSectionId(withS4.filter((s) => s.id !== 's3'))).toBe('s5');
  });
  it('renaming keeps people and the commander', () => {
    const s = renameSection(d.sections, 's1', 'מדור תכנון');
    expect(s.find((x) => x.id === 's1')?.name).toBe('מדור תכנון');
    const g = groupPeople(d.people.map((p) => ({ ...p, billet: null })), s, d.commanders, DEFAULT_SORT, d.people).find((x) => x.id === 's1')!;
    expect(g.name).toBe('מדור תכנון');
    expect(g.commander?.id).toBe(d.commanders.sections.s1);
    expect(g.rows.length).toBeGreaterThan(0);
  });
});

describe('deleteSection', () => {
  it('moves people directly under the head and ends the command', () => {
    const inS2 = d.people.filter((p) => p.sectionId === 's2').length;
    const r = deleteSection(d.sections, d.people, d.commanders, 's2');
    expect(r.moved).toBe(inS2);
    expect(r.sections.map((s) => s.id)).toEqual(['s1', 's3']);
    expect(r.people.filter((p) => p.sectionId === 's2')).toHaveLength(0);
    expect(r.people.length).toBe(d.people.length);
    expect('s2' in r.commanders.sections).toBe(false);
    expect(r.commanders.org).toBe(d.commanders.org);
  });
});
