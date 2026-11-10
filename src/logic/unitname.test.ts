import { describe, expect, it } from 'vitest';
import { seedData } from '../store/seed';
import { diffData } from './audit';
import { makeBackup, parseBackup } from './backup';

describe('organization name', () => {
  it('is logged when changed and survives a backup round trip', () => {
    const a = seedData();
    const b = { ...a, unitName: 'גדוד 99' };
    expect(diffData(a, b).map((e) => e.summary)).toEqual(['שם הארגון שונה מ"גדוד 51" ל"גדוד 99"']);
    const r = parseBackup(JSON.stringify(makeBackup(b)));
    expect(r.ok && r.data?.unitName).toBe('גדוד 99');
  });
});
