import { todayISO } from '../domain/dates';
import { RANKS_BY_POP, degreesFor } from '../domain/rules';
import type { AppData, Billet, BilletAssignment, Grant, Note, Person, SectionPeriod } from '../domain/types';
import { deriveSectionHistory } from './history';

export const BACKUP_FORMAT = 'personnel-billets-backup';
export const BACKUP_VERSION = 1;
const MAX_BYTES = 25 * 1024 * 1024;
const MAX_ERRORS = 20;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: string;
  counts: Record<string, number>;
  data: AppData;
}

export const counts = (d: AppData) => ({
  sections: d.sections.length, people: d.people.length, billets: d.billets.length,
  assignments: d.assignments.length, grants: d.grants.length, notes: d.notes.length,
});

export function makeBackup(data: AppData, createdAt: string = new Date().toISOString()): BackupFile {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt, counts: counts(data), data };
}

export const backupFileName = (today: string = todayISO()) => `personnel-backup-${today}.json`;

export interface ParseResult { ok: boolean; data?: AppData; counts?: ReturnType<typeof counts>; createdAt?: string; errors: string[] }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isStr = (v: unknown, max = 500): v is string => typeof v === 'string' && v.length <= max;
const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const isDateOrNull = (v: unknown) => v === null || v === undefined || isDate(v);
const oneOf = <T extends string>(v: unknown, set: readonly T[]): v is T => typeof v === 'string' && (set as readonly string[]).includes(v);

const PERSON_BOOLS = ['bachelor', 'masters', 'gamoshA', 'gamoshB', 'dmahC', 'dmahB', 'dmahA'] as const;
const PERSON_DATES = ['dmahCFirst', 'dmahCElig', 'dmahBFirst', 'dmahBElig', 'dmahAFirst', 'dmahAElig'] as const;

/**
 * Validate a backup file. Nothing is trusted: every field is type-checked, unknown fields are dropped,
 * and references between records are checked, so a damaged or hand-edited file cannot corrupt the app.
 */
export function parseBackup(text: string): ParseResult {
  const errors: string[] = [];
  const err = (m: string) => { if (errors.length < MAX_ERRORS) errors.push(m); };
  if (text.length > MAX_BYTES) return { ok: false, errors: ['הקובץ גדול מדי'] };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, errors: ['הקובץ אינו JSON תקין'] }; }
  if (!isObj(raw) || raw.format !== BACKUP_FORMAT) return { ok: false, errors: ['זה אינו קובץ גיבוי של המערכת'] };
  if (!isInt(raw.version) || raw.version > BACKUP_VERSION) return { ok: false, errors: ['גרסת הגיבוי חדשה מהגרסה הנתמכת'] };
  const src = raw.data;
  if (!isObj(src)) return { ok: false, errors: ['בקובץ אין נתונים'] };

  const list = (key: string, required = true): unknown[] => {
    const v = src[key];
    if (v === undefined && !required) return [];
    if (!Array.isArray(v)) { err(`הרשימה "${key}" חסרה או אינה תקינה`); return []; }
    return v;
  };

  const sections = list('sections').flatMap((s, i) => (isObj(s) && isStr(s.id, 40) && isStr(s.name, 80) ? [{ id: s.id, name: s.name }] : (err(`מדור #${i + 1} אינו תקין`), [])));
  const sectionIds = new Set(sections.map((s) => s.id));
  if (sectionIds.size !== sections.length) err('מזהי מדורים כפולים');

  const people: Person[] = [];
  list('people').forEach((p, i) => {
    const at = `אדם #${i + 1}`;
    if (!isObj(p) || !isInt(p.id) || !isStr(p.name, 120) || !isInt(p.mid)) return err(`${at}: מזהה, שם או מ.א חסרים`);
    if (!oneOf(p.pop, ['keva', 'hova', 'civ'] as const) || !oneOf(p.rank, ['soldier', 'officer', 'ncos', 'civilian'] as const)) return err(`${at} (${p.name}): אוכלוסייה או סוג לא מוכרים`);
    if (!RANKS_BY_POP[p.pop].includes(p.rank) || !degreesFor(p.pop, p.rank).includes(p.degree as string)) return err(`${at} (${p.name}): שילוב אוכלוסייה / סוג / דרגה אינו תקין`);
    if (!(p.program === null || p.program === undefined || isStr(p.program, 60))) return err(`${at} (${p.name}): תוכנית לא תקינה`);
    if (!(p.sectionId === null || p.sectionId === undefined || isStr(p.sectionId, 40))) return err(`${at} (${p.name}): מדור לא תקין`);
    if (p.sectionId && !sectionIds.has(p.sectionId as string)) return err(`${at} (${p.name}): משויך למדור שאינו קיים`);
    if (!isDateOrNull(p.entryDate) || !isDateOrNull(p.releaseDate) || PERSON_DATES.some((k) => !isDateOrNull(p[k]))) return err(`${at} (${p.name}): תאריך לא תקין`);
    if (PERSON_BOOLS.some((k) => p[k] !== undefined && typeof p[k] !== 'boolean')) return err(`${at} (${p.name}): ערך כן / לא לא תקין`);
    const out: Record<string, unknown> = {
      id: p.id, name: p.name, mid: p.mid, pop: p.pop, rank: p.rank, degree: p.degree, program: p.program ?? null,
      sectionId: p.sectionId ?? null, entryDate: p.entryDate ?? null, releaseDate: p.releaseDate ?? null,
    };
    for (const k of PERSON_BOOLS) if (p[k] !== undefined) out[k] = p[k];
    for (const k of PERSON_DATES) if (p[k] !== undefined) out[k] = p[k] ?? null;
    people.push(out as unknown as Person);
  });
  if (new Set(people.map((p) => p.id)).size !== people.length) err('מזהי אנשים כפולים');
  if (new Set(people.map((p) => p.mid)).size !== people.length) err('מ.א כפול בין אנשים');
  const personIds = new Set(people.map((p) => p.id));

  const billets: Billet[] = [];
  list('billets').forEach((b, i) => {
    if (isObj(b) && isInt(b.id) && oneOf(b.scope, ['int', 'ext'] as const) && oneOf(b.kind, ['fix', 'tmp'] as const) && typeof b.dmah === 'boolean') billets.push({ id: b.id, scope: b.scope, kind: b.kind, dmah: b.dmah });
    else err(`תקן #${i + 1} אינו תקין`);
  });
  const billetIds = new Set(billets.map((b) => b.id));
  if (billetIds.size !== billets.length) err('מספרי תקנים כפולים');

  const assignments: BilletAssignment[] = [];
  list('assignments').forEach((a, i) => {
    if (!isObj(a) || !isInt(a.id) || !isInt(a.billetId) || !(a.personId === null || isInt(a.personId)) || !isStr(a.personName, 120) || !isDate(a.start) || !(a.end === null || isDate(a.end))) return err(`שיבוץ #${i + 1} אינו תקין`);
    if (!billetIds.has(a.billetId)) return err(`שיבוץ #${i + 1}: תקן ${a.billetId} אינו קיים`);
    if (a.personId !== null && !personIds.has(a.personId)) return err(`שיבוץ #${i + 1}: האדם אינו קיים`);
    assignments.push({ id: a.id, billetId: a.billetId, personId: a.personId, personName: a.personName, start: a.start, end: a.end });
  });

  const grants: Grant[] = [];
  list('grants').forEach((g, i) => {
    if (!isObj(g) || !isInt(g.id) || !isInt(g.personId) || !oneOf(g.type, ['voucher', 'grant', 'incentive'] as const) || !oneOf(g.basis, ['gross', 'net'] as const)
      || typeof g.amount !== 'number' || !Number.isFinite(g.amount) || g.amount < 0 || !(g.signingMonths === null || isInt(g.signingMonths))
      || !isDateOrNull(g.signingStart) || !isDateOrNull(g.signingEnd) || !isDate(g.enteredAt)) return err(`מענק #${i + 1} אינו תקין`);
    if (!personIds.has(g.personId)) return err(`מענק #${i + 1}: האדם אינו קיים`);
    grants.push({ id: g.id, personId: g.personId, type: g.type, basis: g.basis, amount: g.amount, signingMonths: g.signingMonths, signingStart: (g.signingStart as string | null) ?? null, signingEnd: (g.signingEnd as string | null) ?? null, enteredAt: g.enteredAt });
  });

  const notes: Note[] = [];
  list('notes', false).forEach((n, i) => {
    if (!isObj(n) || !isInt(n.id) || !isInt(n.personId) || !isStr(n.text, 2000) || !isStr(n.createdAt, 40) || !isStr(n.author, 60)) return err(`הערה #${i + 1} אינה תקינה`);
    if (!personIds.has(n.personId)) return err(`הערה #${i + 1}: האדם אינו קיים`);
    notes.push({ id: n.id, personId: n.personId, text: n.text, createdAt: n.createdAt, author: n.author });
  });

  const cmd = src.commanders;
  let commanders: AppData['commanders'] = { org: null, sections: {} };
  if (!isObj(cmd) || !(cmd.org === null || isInt(cmd.org)) || !isObj(cmd.sections)) err('פרטי המפקדים אינם תקינים');
  else {
    const secs: Record<string, number | null> = {};
    for (const [k, v] of Object.entries(cmd.sections)) {
      if (!sectionIds.has(k)) { err(`מפקד למדור שאינו קיים (${k})`); continue; }
      if (!(v === null || (isInt(v) && personIds.has(v)))) { err(`מפקד המדור ${k} אינו קיים ברשימת האנשים`); continue; }
      secs[k] = v;
    }
    for (const s of sections) if (!(s.id in secs)) secs[s.id] = null;
    if (cmd.org !== null && !personIds.has(cmd.org as number)) err('מפקד הארגון אינו קיים ברשימת האנשים');
    commanders = { org: (cmd.org as number | null) ?? null, sections: secs };
  }

  let sectionHistory: SectionPeriod[] = [];
  if (src.sectionHistory === undefined) sectionHistory = deriveSectionHistory([], people, todayISO());
  else {
    list('sectionHistory').forEach((h, i) => {
      if (!isObj(h) || !isInt(h.id) || !isInt(h.personId) || !(h.sectionId === null || isStr(h.sectionId, 40)) || !isDate(h.start) || !(h.end === null || isDate(h.end))) return err(`היסטוריית מדור #${i + 1} אינה תקינה`);
      sectionHistory.push({ id: h.id, personId: h.personId, sectionId: h.sectionId, start: h.start, end: h.end });
    });
  }

  if (errors.length) return { ok: false, errors };
  const data: AppData = { sections, people, commanders, billets, assignments, grants, notes, sectionHistory };
  return { ok: true, data, counts: counts(data), createdAt: isStr(raw.createdAt, 40) ? raw.createdAt : undefined, errors: [] };
}
