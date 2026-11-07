import { describe, expect, it } from 'vitest';
import { seedData } from '../store/seed';
import { billetByPerson } from './billets';
import { parseBool, parseDate, type Table } from './cells';
import { billetSheets, grantsSheet, peopleSheet, planBilletImport, planGrantImport, planPeopleImport, type SheetSpec } from './sheets';

const toTable = (s: SheetSpec): Table => ({ headers: s.columns.map((c) => c.header), rows: s.rows, rowNumbers: s.rows.map((_, i) => i + 2) });
const data = seedData();
const billetOf = billetByPerson(data.assignments);
const rows = data.people.map((p) => ({ ...p, billet: billetOf.get(p.id) ?? null }));
const ctx = { people: data.people, billets: data.billets, billetOf, sections: data.sections, commanders: data.commanders };

describe('cell parsing', () => {
  it('dates in every accepted format', () => {
    expect(parseDate('15/01/2027')).toBe('2027-01-15');
    expect(parseDate('5.3.2026')).toBe('2026-03-05');
    expect(parseDate('2026-03-05')).toBe('2026-03-05');
    expect(parseDate(new Date(Date.UTC(2026, 2, 5)))).toBe('2026-03-05');
    expect(parseDate(46086)).toBe('2026-03-05'); // Excel serial
    expect(parseDate('')).toBeNull();
    expect(() => parseDate('31/02/2026')).toThrow('תאריך לא תקין');
  });
  it('yes / no', () => {
    expect(parseBool('כן')).toBe(true);
    expect(parseBool('לא')).toBe(false);
    expect(() => parseBool('אולי')).toThrow();
  });
});

describe('people sheet', () => {
  const sheet = peopleSheet(rows, data.sections, data.commanders);
  it('round trip: exporting and importing the same data changes nothing', () => {
    const plan = planPeopleImport(toTable(sheet), ctx);
    expect(plan.errors).toEqual([]);
    expect(plan.creates).toHaveLength(0);
    expect(plan.updates).toHaveLength(0);
    expect(plan.unchanged).toBe(data.people.length);
  });

  const H = sheet.columns.map((c) => c.header);
  const row = (patch: Record<string, string | number | null>) => H.map((h) => (h in patch ? patch[h] : null));
  const table = (...r: (string | number | null)[][]): Table => ({ headers: H, rows: r, rowNumbers: r.map((_, i) => i + 2) });

  it('creates a new person with only the required columns', () => {
    const plan = planPeopleImport(table(row({ 'מ.א': 7900001, 'שם': 'חדשה', 'אוכלוסייה': 'חובה', 'סוג': 'חייל', 'דרגה': 'טוראי', 'תוכנית': 'מט"ל', 'מדור': 'מדור מבצעים' })), ctx);
    expect(plan.errors).toEqual([]);
    expect(plan.creates[0]).toMatchObject({ name: 'חדשה', pop: 'hova', rank: 'soldier', program: 'מט"ל', sectionId: 's1' });
  });
  it('rejects invalid combinations with the row number', () => {
    const plan = planPeopleImport(table(
      row({ 'מ.א': 7900002, 'שם': 'א', 'אוכלוסייה': 'חובה', 'סוג': 'נגד', 'דרגה': 'סמ"ר' }),
      row({ 'מ.א': 7900003, 'שם': 'ב', 'אוכלוסייה': 'קבע', 'סוג': 'קצין', 'דרגה': 'סג"מ' }),
      row({ 'מ.א': 7900004, 'שם': 'ג', 'אוכלוסייה': 'קבע', 'סוג': 'נגד', 'דרגה': 'רס"ל', 'תקן': 1001 }),
      row({ 'מ.א': 7900005, 'שם': 'ד', 'אוכלוסייה': 'קבע', 'סוג': 'נגד', 'דרגה': 'רס"ל', 'מדור': 'אין כזה' }),
      row({ 'מ.א': 7900005, 'שם': 'ה', 'אוכלוסייה': 'קבע', 'סוג': 'נגד', 'דרגה': 'רס"ל' }),
    ), ctx);
    expect(plan.errors.map((e) => e.row)).toEqual([2, 3, 4, 5, 6]);
    expect(plan.errors.find((e) => e.row === 4)?.message).toMatch('מאויש');
  });
  it('a billet can move between two people in the same file', () => {
    const plan = planPeopleImport(table(
      row({ 'מ.א': 7023456, 'שם': 'יוסי כהן', 'אוכלוסייה': 'קבע', 'סוג': 'קצין', 'דרגה': 'סא"ל', 'תקן': 'על תקני' }),
      row({ 'מ.א': 7045678, 'שם': 'אורי לוי', 'אוכלוסייה': 'קבע', 'סוג': 'קצין', 'דרגה': 'סרן', 'תקן': 1002 }),
    ), ctx);
    expect(plan.errors).toEqual([]);
    expect(plan.updates.map((u) => u.billet)).toEqual([null, 1002]);
  });
  it('reports missing required columns', () => {
    const plan = planPeopleImport({ headers: ['שם'], rows: [['x']], rowNumbers: [2] }, ctx);
    expect(plan.errors[0].message).toMatch('עמודות חובה חסרות');
  });
});

describe('billets sheet', () => {
  it('round trip and validation', () => {
    const [main] = billetSheets(data.billets, data.assignments, (a) => a.personName, () => null);
    expect(planBilletImport(toTable(main), data.billets)).toMatchObject({ creates: [], updates: [], unchanged: data.billets.length, errors: [] });
    const plan = planBilletImport({ headers: main.columns.map((c) => c.header), rows: [[3001, 'חיצוני', 'זמני', 'כן', null], [3002, null, null, null, null], [1001, 'חיצוני', null, null, null]], rowNumbers: [2, 3, 4] }, data.billets);
    expect(plan.creates).toEqual([{ id: 3001, scope: 'ext', kind: 'tmp', dmah: true }]);
    expect(plan.errors.map((e) => e.row)).toEqual([3]);
    expect(plan.updates).toEqual([{ id: 1001, scope: 'ext', kind: 'fix', dmah: true }]);
  });
});

describe('grants sheet', () => {
  const sheet = grantsSheet(data.grants, data.people, data.sections);
  it('round trip changes nothing', () => {
    expect(planGrantImport(toTable(sheet), data.grants, data.people, '2026-11-07')).toMatchObject({ creates: [], updates: [], errors: [], unchanged: data.grants.length });
  });
  it('new rows without an id are created; unknown מ.א is an error', () => {
    const H = sheet.columns.map((c) => c.header);
    const r = (o: Record<string, string | number | null>) => H.map((h) => o[h] ?? null);
    const plan = planGrantImport({
      headers: H,
      rows: [r({ 'מ.א': 7023456, 'סוג': 'תמריץ', 'סכום': '12,000', 'ברוטו / נטו': 'נטו', 'תחילת חתימה': '01/01/2027', 'משך חתימה (חודשים)': 12, 'סיום חתימה': '01/01/2028' }), r({ 'מ.א': 1, 'סוג': 'שובר', 'סכום': 5, 'ברוטו / נטו': 'נטו' })],
      rowNumbers: [2, 3],
    }, data.grants, data.people, '2026-11-07');
    expect(plan.creates[0]).toMatchObject({ personId: 2, type: 'incentive', amount: 12000, basis: 'net', enteredAt: '2026-11-07', signingMonths: 12 });
    expect(plan.errors[0]).toMatchObject({ row: 3 });
  });
});
