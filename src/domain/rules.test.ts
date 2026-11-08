import { describe, expect, it } from 'vitest';
import { applicable, degreesFor, fixCombo, normalizePerson } from './rules';
import type { Person } from './types';

describe('degree lists', () => {
  it('matches the confirmed lists per population and type', () => {
    expect(degreesFor('hova', 'soldier')).toEqual(['טוראי', 'רב"ט', 'סמל', 'סמ"ר']);
    expect(degreesFor('hova', 'officer')).toEqual(['קמ"א', 'סג"מ', 'סגן']);
    expect(degreesFor('keva', 'officer')).toEqual(['קא"ב', 'סגן', 'סרן', 'רס"ן', 'סא"ל', 'אל"מ']);
    expect(degreesFor('keva', 'ncos')).toEqual(['סמ"ר', 'רס"ל', 'רס"ר', 'רס"מ', 'רס"ב', 'רנ"ג']);
    expect(degreesFor('civ', 'civilian')).toEqual(['אע"צ', 'אע"ב']);
    expect(degreesFor('keva', 'soldier')).toEqual([]);
  });
});

describe('applicability', () => {
  it('billet and entry date only for keva', () => {
    expect(applicable('billet', { pop: 'keva', rank: 'ncos' })).toBe(true);
    expect(applicable('billet', { pop: 'hova', rank: 'officer' })).toBe(false);
    expect(applicable('entryDate', { pop: 'civ', rank: 'civilian' })).toBe(false);
  });
  it('program only for soldiers and officers', () => {
    expect(applicable('program', { pop: 'hova', rank: 'soldier' })).toBe(true);
    expect(applicable('program', { pop: 'keva', rank: 'officer' })).toBe(true);
    expect(applicable('program', { pop: 'keva', rank: 'ncos' })).toBe(false);
  });
  it('education for officers and NCOs, דמ"ח only for officers', () => {
    expect(applicable('bachelor', { pop: 'keva', rank: 'ncos' })).toBe(true);
    expect(applicable('bachelor', { pop: 'hova', rank: 'soldier' })).toBe(false);
    expect(applicable('dmahC', { pop: 'keva', rank: 'ncos' })).toBe(false);
    expect(applicable('gamoshB', { pop: 'hova', rank: 'officer' })).toBe(true);
  });
});

describe('fixCombo', () => {
  it('switching population fixes type, degree and program', () => {
    const d = fixCombo({ pop: 'civ' as const, rank: 'officer' as const, degree: 'סרן', program: 'פיון' });
    expect(d).toMatchObject({ pop: 'civ', rank: 'civilian', degree: 'אע"צ', program: null });
  });
  it('keeps a valid degree and program', () => {
    const d = fixCombo({ pop: 'hova' as const, rank: 'officer' as const, degree: 'סגן', program: 'תלפיות' });
    expect(d).toMatchObject({ rank: 'officer', degree: 'סגן', program: 'תלפיות' });
  });
});

describe('normalizePerson', () => {
  const base: Person = { id: 1, name: '  נועה  ', mid: 1234567, pop: 'hova', rank: 'soldier', degree: 'טוראי', program: 'מט"ל', sectionId: null, entryDate: '2020-01-01', releaseDate: null, bachelor: true, dmahC: true };
  it('drops fields that do not apply and trims the name', () => {
    const p = normalizePerson(base);
    expect(p.name).toBe('נועה');
    expect(p.entryDate).toBeNull();
    expect('bachelor' in p).toBe(false);
    expect('dmahC' in p).toBe(false);
    expect(p.program).toBe('מט"ל');
  });
  it('fills defaults for officer fields', () => {
    const p = normalizePerson({ ...base, pop: 'keva', rank: 'officer', degree: 'סרן', program: null });
    expect(p.bachelor).toBe(true);
    expect(p.masters).toBe(false);
    expect(p.dmahCFirst).toBeNull();
    expect(p.dmahA).toBe(false);
  });
});
