import { describe, expect, it } from 'vitest';
import type { BilletAssignment, Grant } from '../domain/types';
import { billetByPerson, billetHistory, removeBillet, setPersonBillet, validateNewBillet } from './billets';
import { emptyGrantDraft, latestFirst, totals, updateGrantDraft, validateGrant } from './grants';

const A = (id: number, billetId: number, personId: number | null, start: string, end: string | null): BilletAssignment => ({ id, billetId, personId, personName: `p${personId}`, start, end });

describe('setPersonBillet', () => {
  const base = [A(1, 1001, 7, '2020-01-01', null), A(2, 1002, null, '2018-01-01', '2021-01-01')];
  it('closes the previous assignment and opens a new one, keeping history', () => {
    const next = setPersonBillet(base, { id: 7, name: 'p7' }, 1002, '2026-11-07');
    expect(next.find((a) => a.id === 1)?.end).toBe('2026-11-07');
    expect(billetByPerson(next).get(7)).toBe(1002);
    expect(billetHistory(next, 1002).map((a) => a.personId)).toEqual([7, null]);
  });
  it('moving to על תקני only closes the assignment', () => {
    const next = setPersonBillet(base, { id: 7, name: 'p7' }, null, '2026-11-07');
    expect(billetByPerson(next).has(7)).toBe(false);
    expect(next).toHaveLength(2);
  });
  it('a same-day change leaves no zero-length period', () => {
    const today = [A(1, 1001, 7, '2026-11-07', null)];
    expect(setPersonBillet(today, { id: 7, name: 'p7' }, null, '2026-11-07')).toHaveLength(0);
  });
  it('no-op when the billet does not change', () => {
    expect(setPersonBillet(base, { id: 7, name: 'p7' }, 1001, '2026-11-07')).toBe(base);
  });
});

describe('billets', () => {
  it('validates new billet numbers', () => {
    const billets = [{ id: 1001, scope: 'int' as const, kind: 'fix' as const, dmah: false }];
    expect(validateNewBillet('', billets)).not.toBeNull();
    expect(validateNewBillet('1001', billets)).toMatch('קיים');
    expect(validateNewBillet('1030', billets)).toBeNull();
  });
  it('removing a billet removes its history too', () => {
    const r = removeBillet([{ id: 1001, scope: 'int', kind: 'fix', dmah: false }], [A(1, 1001, 7, '2020-01-01', null)], 1001);
    expect(r.billets).toHaveLength(0);
    expect(r.assignments).toHaveLength(0);
  });
});

describe('grants', () => {
  const G = (id: number, start: string | null, enteredAt: string, amount = 100, basis: Grant['basis'] = 'gross'): Grant =>
    ({ id, personId: 1, type: 'grant', signingMonths: null, signingStart: start, signingEnd: null, amount, basis, enteredAt });
  it('latest first by signing start, falling back to entry date', () => {
    const list = latestFirst([G(1, '2020-01-01', '2019-12-01'), G(2, null, '2025-04-10'), G(3, '2024-07-01', '2024-06-01')]);
    expect(list.map((g) => g.id)).toEqual([2, 3, 1]);
  });
  it('never mixes gross and net totals', () => {
    expect(totals([G(1, null, '2020-01-01', 100, 'gross'), G(2, null, '2020-01-01', 50, 'net')])).toEqual({ gross: 100, net: 50 });
  });
  it('fills the end date from duration and start', () => {
    const d = updateGrantDraft(updateGrantDraft(emptyGrantDraft(), { signingStart: '2026-01-15' }), { signingMonths: '24' });
    expect(d.signingEnd).toBe('2028-01-15');
  });
  it('validates required fields and date order', () => {
    const ok = { ...emptyGrantDraft(), personId: '1', amount: '1000' };
    expect(validateGrant(ok)).toBeNull();
    expect(validateGrant({ ...ok, personId: '' })).toMatch('איש צוות');
    expect(validateGrant({ ...ok, amount: '0' })).toMatch('סכום');
    expect(validateGrant({ ...ok, signingMonths: '12' })).toMatch('תחילה');
    expect(validateGrant({ ...ok, signingStart: '2026-05-01', signingEnd: '2026-01-01' })).toMatch('אחרי');
  });
});
