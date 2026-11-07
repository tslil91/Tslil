import { describe, expect, it } from 'vitest';
import { describeDateFilter, matchDateFilter, monthBounds, monthFilter, parseDateFilter, rangeFilter, yearFilter } from './dates';

const today = '2026-11-07';

describe('date filters', () => {
  it('year', () => {
    expect(matchDateFilter('2027-03-10', yearFilter('2027'), today)).toBe(true);
    expect(matchDateFilter('2026-12-31', yearFilter('2027'), today)).toBe(false);
    expect(matchDateFilter('2027-12-31', yearFilter('2027'), today)).toBe(true);
  });
  it('month', () => {
    expect(matchDateFilter('2027-03-01', monthFilter('2027', '3'), today)).toBe(true);
    expect(matchDateFilter('2027-03-31', monthFilter('2027', '03'), today)).toBe(true);
    expect(matchDateFilter('2027-04-01', monthFilter('2027', '3'), today)).toBe(false);
    expect(matchDateFilter('2026-03-15', monthFilter('2027', '3'), today)).toBe(false);
  });
  it('range is inclusive and either side may be open', () => {
    const f = rangeFilter('2026-12-01', '2027-01-31');
    expect(matchDateFilter('2026-12-01', f, today)).toBe(true);
    expect(matchDateFilter('2027-01-31', f, today)).toBe(true);
    expect(matchDateFilter('2026-11-30', f, today)).toBe(false);
    expect(matchDateFilter('2027-02-01', f, today)).toBe(false);
    expect(matchDateFilter('2030-01-01', rangeFilter('2027-01-01', ''), today)).toBe(true);
    expect(matchDateFilter('2020-01-01', rangeFilter('', '2021-01-01'), today)).toBe(true);
    expect(matchDateFilter('2022-01-01', rangeFilter('', '2021-01-01'), today)).toBe(false);
  });
  it('presets still work', () => {
    expect(matchDateFilter('2027-01-15', 'd90', today)).toBe(true);
    expect(matchDateFilter('2026-01-15', 'past', today)).toBe(true);
    expect(matchDateFilter('2030-01-15', 'y1', today)).toBe(false);
  });
  it('empty dates and bad filters never match', () => {
    expect(matchDateFilter(null, yearFilter('2027'), today)).toBe(false);
    expect(matchDateFilter('2027-01-01', 'garbage', today)).toBe(false);
    expect(parseDateFilter('r:..')).toBeNull();
  });
  it('describes filters for the button', () => {
    expect(describeDateFilter('')).toBe('');
    expect(describeDateFilter('y:2027')).toBe('2027');
    expect(describeDateFilter('m:2027-03')).toBe('מרץ 2027');
    expect(describeDateFilter('r:2026-01-01..2026-03-31')).toBe('01/01/2026 – 31/03/2026');
    expect(describeDateFilter('r:2026-01-01..')).toBe('מ־01/01/2026');
    expect(describeDateFilter('d90')).toBe('עד 90 יום');
  });
  it('month bounds incl. leap February', () => {
    expect(monthBounds(2028, 2)).toEqual({ first: '2028-02-01', last: '2028-02-29' });
    expect(monthBounds(2026, 12)).toEqual({ first: '2026-12-01', last: '2026-12-31' });
  });
});
