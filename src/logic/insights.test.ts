import { describe, expect, it } from 'vitest';
import type { AppData } from '../domain/types';
import { seedData } from '../store/seed';
import { attentionItems } from './attention';
import { dataIssues } from './quality';

const today = '2026-11-07';
const fresh = (): AppData => JSON.parse(JSON.stringify(seedData()));

describe('attentionItems', () => {
  it('seed data: releases soon on a billet, vacant billets, long bench, dmah, grants', () => {
    const r = attentionItems(fresh(), today);
    expect(r.releasing).toEqual([]); // nobody on a billet leaves within 90 days in the seed
    expect(r.vacant.map((x) => x.billet.id)).toEqual(expect.arrayContaining([1006, 1007, 1011, 2001, 2002]));
    expect(r.vacant.find((x) => x.billet.id === 1007)?.sinceDays).toBeNull();
    expect(r.vacant.find((x) => x.billet.id === 1011)?.sinceDays).toBe(159); // since 2026-06-01
    expect(r.vacant[0].sinceDays).toBeGreaterThanOrEqual(r.vacant[1].sinceDays ?? 0); // longest vacant first
    expect(r.dmah.map((x) => `${x.person.name}-${x.level}`)).toContain('מיכל ביטון-ב׳'); // eligible 15/12/2026, not done
    expect(r.grants).toEqual([]); // every signing period in the seed ended or ends far away
    const d = fresh();
    d.grants.push({ id: 99, personId: 2, type: 'incentive', signingMonths: 12, signingStart: '2026-02-01', signingEnd: '2027-02-01', amount: 1000, basis: 'gross', enteredAt: '2026-01-20' });
    const g = attentionItems(d, today).grants;
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ days: 86, end: '2027-02-01' });
    expect(g[0].person?.name).toBe('יוסי כהן');
  });
  it('windows are respected', () => {
    const d = fresh();
    const r1 = attentionItems(d, today, { windowDays: 30, benchDays: 60, grantDays: 30 });
    expect(r1.dmah.find((x) => x.person.name === 'מיכל ביטון')).toBeUndefined(); // 38 days away > 30
    expect(r1.grants).toHaveLength(0);
    d.people.find((p) => p.id === 6)!.releaseDate = '2026-12-10'; // עמית is on billet 1004
    const r2 = attentionItems(d, today);
    expect(r2.releasing).toHaveLength(1);
    expect(r2.releasing[0]).toMatchObject({ days: 33, billetId: 1004 });
  });
  it('bench: counts days since the last billet ended; shorter than the threshold is not listed', () => {
    const d = fresh();
    // רן אברהם left billet 2002 on 2026-09-01 → 67 days
    const r = attentionItems(d, today, { windowDays: 90, benchDays: 60, grantDays: 180 });
    expect(r.benchLong.find((x) => x.person.id === 7)?.days).toBe(67);
    expect(attentionItems(d, today, { windowDays: 90, benchDays: 70, grantDays: 180 }).benchLong.find((x) => x.person.id === 7)).toBeUndefined();
  });
  it('a completed דמ"ח or missing date is never listed; overdue is listed with negative days', () => {
    const d = fresh();
    const p = d.people.find((x) => x.id === 5)!; p.dmahA = false; p.dmahAElig = '2026-10-01';
    const r = attentionItems(d, today);
    expect(r.dmah.find((x) => x.person.id === 5 && x.level === 'א׳')?.days).toBe(-37);
    expect(r.dmah.some((x) => x.person.id === 1)).toBe(false); // דנה completed everything
  });
  it('total is the sum of all groups', () => {
    const r = attentionItems(fresh(), today);
    expect(r.total).toBe(r.releasing.length + r.vacant.length + r.benchLong.length + r.dmah.length + r.grants.length);
  });
});

describe('dataIssues', () => {
  it('the seed data has only warnings about missing commanders (none) → clean', () => {
    expect(dataIssues(fresh(), today).filter((i) => i.severity === 'error')).toEqual([]);
  });
  it('organization and section commanders', () => {
    const d = fresh();
    d.commanders.org = null; d.commanders.sections.s2 = null;
    const ids = dataIssues(d, today).map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(['org-no-cmd', 'sec-no-cmd-s2']));
    d.commanders.org = 5; // נועה פרץ sits in s2
    expect(dataIssues(d, today).map((i) => i.id)).toContain('org-cmd-section');
  });
  it('double booking and wrong people on billets', () => {
    const d = fresh();
    d.assignments.push({ id: 900, billetId: 1006, personId: 6, personName: 'x', start: '2026-01-01', end: null }); // עמית already on 1004
    d.assignments.push({ id: 901, billetId: 1007, personId: 9, personName: 'x', start: '2026-01-01', end: null }); // soldier on a billet
    d.assignments.push({ id: 902, billetId: 1004, personId: 14, personName: 'x', start: '2026-01-01', end: null }); // two on 1004
    const ids = dataIssues(d, today).map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(['a-multi-6', 'a-notkeva-9', 'b-multi-1004']));
  });
  it('released but still on a billet, bad dates, duplicate מ.א', () => {
    const d = fresh();
    d.people.find((p) => p.id === 6)!.releaseDate = '2026-01-01';
    const p = d.people.find((x) => x.id === 2)!; p.entryDate = '2035-01-01';
    d.people[1].mid = d.people[0].mid;
    const ids = dataIssues(d, today).map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(['a-released-6', 'p-dates-2', `mid-${d.people[0].mid}`]));
  });
  it('invalid degree or program (e.g. after a bad import) and missing dates', () => {
    const d = fresh();
    d.people.find((p) => p.id === 6)!.degree = 'אל"מ'; // NCO with an officer degree
    d.people.find((p) => p.id === 9)!.program = 'פיון'; // soldier with an officer program
    d.people.find((p) => p.id === 10)!.releaseDate = null;
    d.people.find((p) => p.id === 4)!.entryDate = null;
    const ids = dataIssues(d, today).map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining(['p-degree-6', 'p-program-9', 'p-release-10', 'p-entry-4']));
  });
  it('errors come before warnings; broken references', () => {
    const d = fresh();
    d.commanders.org = null;
    d.people.find((p) => p.id === 6)!.degree = 'אל"מ';
    d.grants.push({ id: 99, personId: 12345, type: 'voucher', signingMonths: null, signingStart: null, signingEnd: null, amount: 1, basis: 'net', enteredAt: today });
    const issues = dataIssues(d, today);
    expect(issues[0].severity).toBe('error');
    const firstWarn = issues.findIndex((i) => i.severity === 'warn');
    expect(issues.slice(firstWarn).every((i) => i.severity === 'warn')).toBe(true);
    expect(issues.map((i) => i.id)).toContain('g-person-99');
  });
});
