import { POP_LABELS, RANK_LABELS, RANKS_BY_POP, applicable, degreesFor, fixCombo, programsFor } from '../domain/rules';
import type { Billet, BilletAssignment, BilletKind, BilletScope, Commanders, Grant, GrantBasis, GrantType, ISODate, Person, PersonRow, Section } from '../domain/types';
import { nextId } from './billets';
import {
  CellError, isEmpty, missingHeaders, parseAmount, parseBool, parseDate, parseInteger, parseLabel, rowsByHeader, text,
  type Cell, type ImportPlan, type RowError, type Table,
} from './cells';
import { FIELDS } from './fields';
import { BASIS_LABELS, GRANT_TYPE_LABELS, validateGrant, type GrantDraft } from './grants';
import type { PersonDraft } from './people';

/** A sheet ready to be written: dates are ISO strings tagged by the column type. */
export interface SheetSpec {
  name: string;
  columns: { header: string; width: number; type?: 'date' | 'number' | 'text' }[];
  rows: (string | number | null)[][];
}

const yesNo = (v: boolean | undefined) => (v === undefined ? null : v ? 'כן' : 'לא');
export const ORG_LEVEL = 'כפוף ישירות';
const SCOPE_LABELS: Record<BilletScope, string> = { int: 'פנימי', ext: 'חיצוני' };
const KIND_LABELS: Record<BilletKind, string> = { fix: 'קבוע', tmp: 'זמני' };

// ======================= People =======================

const H = {
  mid: 'מ.א', name: 'שם', pop: 'אוכלוסייה', rank: 'סוג', degree: 'דרגה', program: 'תוכנית', section: 'מדור', role: 'תפקיד',
  billet: 'תקן', entryDate: 'כניסה לקבע', releaseDate: 'שחרור',
} as const;
/** Education / דמ"ח columns reuse the registry labels. */
const EXTRA = FIELDS.filter((f) => f.group !== 'base');

export const PEOPLE_REQUIRED = [H.mid, H.name, H.pop, H.rank, H.degree];

export function peopleSheet(rows: PersonRow[], sections: Section[], cmd: Commanders): SheetSpec {
  const secName = (id: string | null) => (id ? sections.find((s) => s.id === id)?.name ?? '' : ORG_LEVEL);
  const role = (p: PersonRow) => (cmd.org === p.id ? 'מפקד הארגון' : p.sectionId && cmd.sections[p.sectionId] === p.id ? 'מפקד המדור' : null);
  return {
    name: 'כוח אדם',
    columns: [
      { header: H.mid, width: 12, type: 'number' }, { header: H.name, width: 20 }, { header: H.pop, width: 11 }, { header: H.rank, width: 9 },
      { header: H.degree, width: 9 }, { header: H.program, width: 12 }, { header: H.section, width: 18 }, { header: H.role, width: 13 },
      { header: H.billet, width: 10 }, { header: H.entryDate, width: 13, type: 'date' }, { header: H.releaseDate, width: 13, type: 'date' },
      ...EXTRA.map((f) => ({ header: f.label, width: f.type === 'date' ? 15 : 11, type: f.type === 'date' ? ('date' as const) : undefined })),
    ],
    rows: rows.map((p) => [
      p.mid, p.name, POP_LABELS[p.pop], RANK_LABELS[p.rank], p.degree, p.program, secName(p.sectionId), role(p),
      p.pop === 'keva' ? (p.billet ?? 'על תקני') : null, p.entryDate, p.releaseDate,
      ...EXTRA.map((f) => {
        if (!applicable(f.key, p)) return null;
        const v = (p as unknown as Record<string, unknown>)[f.key];
        return f.type === 'bool' ? yesNo(v as boolean | undefined) : (v as string | null) ?? null;
      }),
    ]),
  };
}

interface PeopleCtx { people: Person[]; billets: Billet[]; billetOf: Map<number, number>; sections: Section[]; commanders: Commanders }

/**
 * Validate a people sheet. Rows are matched to existing people by מ.א (update) or created.
 * Columns that are missing from the sheet keep their current values. Commander roles are not imported.
 */
export function planPeopleImport(t: Table, ctx: PeopleCtx): ImportPlan<PersonDraft> {
  const missing = missingHeaders(t, PEOPLE_REQUIRED);
  if (missing.length) return { creates: [], updates: [], unchanged: 0, errors: [{ row: 1, message: `עמודות חובה חסרות: ${missing.join(', ')}` }] };

  const plan: ImportPlan<PersonDraft> = { creates: [], updates: [], unchanged: 0, errors: [] };
  const seenMid = new Map<number, number>();
  const claimed = new Map<number, number>(); // billet → mid that claims it in this file
  const byMid = new Map(ctx.people.map((p) => [p.mid, p]));
  let newId = nextId(ctx.people);
  const drafts: { row: number; draft: PersonDraft; existing: Person | undefined }[] = [];

  for (const r of rowsByHeader(t)) {
    const err = (message: string) => plan.errors.push({ row: r.rowNumber, message });
    try {
      const mid = parseInteger(r.get(H.mid), 'מ.א');
      if (mid === null || String(mid).length < 5 || String(mid).length > 9) { err('מ.א חייב להכיל 5–9 ספרות'); continue; }
      if (seenMid.has(mid)) { err(`מ.א ${mid} מופיע פעמיים בקובץ (גם בשורה ${seenMid.get(mid)})`); continue; }
      seenMid.set(mid, r.rowNumber);
      const existing = byMid.get(mid);
      const name = text(r.get(H.name));
      if (!name) { err('חסר שם'); continue; }
      const pop = parseLabel(r.get(H.pop), POP_LABELS, 'סוג אוכלוסייה');
      const rank = parseLabel(r.get(H.rank), RANK_LABELS, 'סוג');
      if (!pop || !rank) { err('חסרים אוכלוסייה או סוג'); continue; }
      if (!RANKS_BY_POP[pop].includes(rank)) { err(`הסוג "${RANK_LABELS[rank]}" אינו אפשרי עבור "${POP_LABELS[pop]}"`); continue; }
      const degree = text(r.get(H.degree));
      if (!degreesFor(pop, rank).includes(degree)) { err(`הדרגה "${degree}" אינה ברשימה עבור ${POP_LABELS[pop]}-${RANK_LABELS[rank]} (${degreesFor(pop, rank).join(', ')})`); continue; }

      const base: PersonDraft = existing
        ? { ...existing, mid: String(mid), billet: ctx.billetOf.get(existing.id) ?? null }
        : { id: newId++, name, mid: String(mid), pop, rank, degree, program: null, sectionId: null, entryDate: null, releaseDate: null, billet: null };
      const d: PersonDraft = { ...base, name, pop, rank, degree };
      const rec = d as unknown as Record<string, unknown>;

      if (r.has(H.program)) {
        const prog = text(r.get(H.program)) || null;
        if (prog && !programsFor(rank).includes(prog)) { err(`התוכנית "${prog}" אינה אפשרית עבור ${RANK_LABELS[rank]}`); continue; }
        d.program = prog;
      }
      if (r.has(H.section)) {
        const s = text(r.get(H.section));
        if (!s || s === ORG_LEVEL) d.sectionId = null;
        else {
          const sec = ctx.sections.find((x) => x.name === s);
          if (!sec) { err(`מדור לא מוכר: "${s}"`); continue; }
          d.sectionId = sec.id;
        }
        if (existing && ctx.commanders.org === existing.id && d.sectionId !== null) { err('מפקד הארגון אינו משויך למדור. שינוי מיקום של מפקד נעשה במערכת.'); continue; }
      }
      if (r.has(H.billet)) {
        const raw = r.get(H.billet);
        d.billet = pop !== 'keva' || isEmpty(raw) || text(raw) === 'על תקני' ? null : parseInteger(raw, 'מספר תקן');
      }
      if (pop !== 'keva') d.billet = null;
      if (r.has(H.entryDate)) d.entryDate = parseDate(r.get(H.entryDate));
      if (r.has(H.releaseDate)) d.releaseDate = parseDate(r.get(H.releaseDate));
      for (const f of EXTRA) {
        if (!r.has(f.label) || !applicable(f.key, d)) continue;
        const v = r.get(f.label);
        if (f.type === 'bool') { const b = parseBool(v); if (b !== null) rec[f.key] = b; else if (!existing) rec[f.key] = false; }
        else rec[f.key] = parseDate(v);
      }
      if (d.billet !== null) {
        if (!ctx.billets.some((b) => b.id === d.billet)) { err(`תקן ${d.billet} אינו קיים ברשימת התקנים`); continue; }
        if (claimed.has(d.billet)) { err(`תקן ${d.billet} משויך בקובץ גם ל־מ.א ${claimed.get(d.billet)}`); continue; }
        claimed.set(d.billet, mid);
      }
      drafts.push({ row: r.rowNumber, draft: fixCombo(d), existing });
    } catch (e) {
      if (e instanceof CellError) err(e.message); else throw e;
    }
  }

  // A billet held today by someone else is free only if that person leaves it in this same file.
  const holderOf = new Map<number, Person>();
  for (const p of ctx.people) { const b = ctx.billetOf.get(p.id); if (b !== undefined) holderOf.set(b, p); }
  const leaving = new Set(drafts.filter((x) => x.existing && ctx.billetOf.get(x.existing.id) !== x.draft.billet).map((x) => x.existing!.id));
  for (const x of drafts) {
    const holder = x.draft.billet !== null ? holderOf.get(x.draft.billet) : undefined;
    if (holder && holder.id !== x.draft.id && !leaving.has(holder.id)) {
      plan.errors.push({ row: x.row, message: `תקן ${x.draft.billet} מאויש כעת על ידי ${holder.name}` });
      continue;
    }
    if (!x.existing) plan.creates.push(x.draft);
    else if (samePerson(x.existing, ctx.billetOf.get(x.existing.id) ?? null, x.draft)) plan.unchanged++;
    else plan.updates.push(x.draft);
  }
  plan.errors.sort((a, b) => a.row - b.row);
  return plan;
}

function samePerson(p: Person, billet: number | null, d: PersonDraft): boolean {
  const a: Record<string, unknown> = { ...p, mid: String(p.mid), billet };
  const b = d as unknown as Record<string, unknown>;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((k) => (a[k] ?? null) === (b[k] ?? null));
}

// ======================= Billets =======================

const BH = { id: 'מספר תקן', scope: 'פנימי / חיצוני', kind: 'קבוע / זמני', dmah: 'דמ"ח', current: 'משובץ כעת' } as const;

export function billetSheets(billets: Billet[], assignments: BilletAssignment[], nameOf: (a: BilletAssignment) => string, midOf: (a: BilletAssignment) => number | null): SheetSpec[] {
  const open = (id: number) => assignments.find((a) => a.billetId === id && a.end === null);
  const ids = new Set(billets.map((b) => b.id));
  return [
    {
      name: 'תקנים',
      columns: [{ header: BH.id, width: 12, type: 'number' }, { header: BH.scope, width: 14 }, { header: BH.kind, width: 13 }, { header: BH.dmah, width: 8 }, { header: BH.current, width: 22 }],
      rows: billets.map((b) => { const o = open(b.id); return [b.id, SCOPE_LABELS[b.scope], KIND_LABELS[b.kind], b.dmah ? 'כן' : 'לא', o ? nameOf(o) : 'פנוי']; }),
    },
    {
      name: 'היסטוריית שיבוץ',
      columns: [{ header: BH.id, width: 12, type: 'number' }, { header: 'שם', width: 22 }, { header: 'מ.א', width: 12, type: 'number' }, { header: 'מתאריך', width: 13, type: 'date' }, { header: 'עד תאריך', width: 13, type: 'date' }],
      rows: assignments.filter((a) => ids.has(a.billetId)).sort((a, b) => a.billetId - b.billetId || (a.start < b.start ? 1 : -1))
        .map((a) => [a.billetId, nameOf(a), midOf(a), a.start, a.end]),
    },
  ];
}

/** Billets are matched by number. Occupancy is managed from the people screen and is not imported. */
export function planBilletImport(t: Table, billets: Billet[]): ImportPlan<Billet> {
  const missing = missingHeaders(t, [BH.id]);
  if (missing.length) return { creates: [], updates: [], unchanged: 0, errors: [{ row: 1, message: `עמודת חובה חסרה: ${BH.id}` }] };
  const plan: ImportPlan<Billet> = { creates: [], updates: [], unchanged: 0, errors: [] };
  const seen = new Map<number, number>();
  for (const r of rowsByHeader(t)) {
    try {
      const id = parseInteger(r.get(BH.id), 'מספר תקן');
      if (id === null || id <= 0) { plan.errors.push({ row: r.rowNumber, message: 'חסר מספר תקן' }); continue; }
      if (seen.has(id)) { plan.errors.push({ row: r.rowNumber, message: `תקן ${id} מופיע פעמיים (גם בשורה ${seen.get(id)})` }); continue; }
      seen.set(id, r.rowNumber);
      const existing = billets.find((b) => b.id === id);
      const scope = r.has(BH.scope) ? parseLabel(r.get(BH.scope), SCOPE_LABELS, 'פנימי / חיצוני') : null;
      const kind = r.has(BH.kind) ? parseLabel(r.get(BH.kind), KIND_LABELS, 'קבוע / זמני') : null;
      const dmah = r.has(BH.dmah) ? parseBool(r.get(BH.dmah)) : null;
      if (!existing && (!scope || !kind || dmah === null)) { plan.errors.push({ row: r.rowNumber, message: 'בתקן חדש יש למלא פנימי / חיצוני, קבוע / זמני ו־דמ"ח' }); continue; }
      const next: Billet = { id, scope: scope ?? existing!.scope, kind: kind ?? existing!.kind, dmah: dmah ?? existing!.dmah };
      if (!existing) plan.creates.push(next);
      else if (existing.scope === next.scope && existing.kind === next.kind && existing.dmah === next.dmah) plan.unchanged++;
      else plan.updates.push(next);
    } catch (e) {
      if (e instanceof CellError) plan.errors.push({ row: r.rowNumber, message: e.message }); else throw e;
    }
  }
  return plan;
}

// ======================= Grants =======================

const GH = {
  id: 'מזהה', mid: 'מ.א', name: 'שם', degree: 'דרגה', section: 'מדור', type: 'סוג', months: 'משך חתימה (חודשים)',
  start: 'תחילת חתימה', end: 'סיום חתימה', amount: 'סכום', basis: 'ברוטו / נטו', entered: 'הוזן בתאריך',
} as const;

export function grantsSheet(grants: Grant[], people: Person[], sections: Section[]): SheetSpec {
  const byId = new Map(people.map((p) => [p.id, p]));
  const secName = (id: string | null | undefined) => (id ? sections.find((s) => s.id === id)?.name ?? '' : ORG_LEVEL);
  return {
    name: 'מענקים ותמריצים',
    columns: [
      { header: GH.id, width: 8, type: 'number' }, { header: GH.mid, width: 12, type: 'number' }, { header: GH.name, width: 20 },
      { header: GH.degree, width: 9 }, { header: GH.section, width: 18 }, { header: GH.type, width: 9 }, { header: GH.months, width: 12, type: 'number' },
      { header: GH.start, width: 13, type: 'date' }, { header: GH.end, width: 13, type: 'date' }, { header: GH.amount, width: 12, type: 'number' },
      { header: GH.basis, width: 11 }, { header: GH.entered, width: 13, type: 'date' },
    ],
    rows: grants.map((g) => {
      const p = byId.get(g.personId);
      return [g.id, p?.mid ?? null, p?.name ?? '', p?.degree ?? '', secName(p?.sectionId), GRANT_TYPE_LABELS[g.type], g.signingMonths, g.signingStart, g.signingEnd, g.amount, BASIS_LABELS[g.basis], g.enteredAt];
    }),
  };
}

/** Grants are matched to people by מ.א; a row whose מזהה exists is an update, otherwise a new grant. */
export function planGrantImport(t: Table, grants: Grant[], people: Person[], today: ISODate): ImportPlan<Grant> {
  const missing = missingHeaders(t, [GH.mid, GH.type, GH.amount, GH.basis]);
  if (missing.length) return { creates: [], updates: [], unchanged: 0, errors: [{ row: 1, message: `עמודות חובה חסרות: ${missing.join(', ')}` }] };
  const plan: ImportPlan<Grant> = { creates: [], updates: [], unchanged: 0, errors: [] };
  let newId = nextId(grants);
  const seenIds = new Set<number>();
  for (const r of rowsByHeader(t)) {
    const err = (message: string) => plan.errors.push({ row: r.rowNumber, message });
    try {
      const mid = parseInteger(r.get(GH.mid), 'מ.א');
      const person = people.find((p) => p.mid === mid);
      if (!person) { err(`לא נמצא איש צוות עם מ.א ${mid ?? '(ריק)'}`); continue; }
      const type = parseLabel<GrantType>(r.get(GH.type), GRANT_TYPE_LABELS, 'סוג');
      const basis = parseLabel<GrantBasis>(r.get(GH.basis), BASIS_LABELS, 'ברוטו / נטו');
      if (!type || !basis) { err('חסרים סוג או ברוטו / נטו'); continue; }
      const months = r.has(GH.months) ? parseInteger(r.get(GH.months), 'משך חתימה') : null;
      const draft: GrantDraft = {
        personId: String(person.id), type, basis,
        signingMonths: months ? String(months) : '',
        signingStart: (r.has(GH.start) ? parseDate(r.get(GH.start)) : null) ?? '',
        signingEnd: (r.has(GH.end) ? parseDate(r.get(GH.end)) : null) ?? '',
        amount: String(parseAmount(r.get(GH.amount)) ?? ''),
      };
      const invalid = validateGrant(draft);
      if (invalid) { err(invalid); continue; }
      const id = r.has(GH.id) ? parseInteger(r.get(GH.id), 'מזהה') : null;
      if (id !== null && seenIds.has(id)) { err(`מזהה ${id} מופיע פעמיים בקובץ`); continue; }
      if (id !== null) seenIds.add(id);
      const existing = id !== null ? grants.find((g) => g.id === id) : undefined;
      const entered = (r.has(GH.entered) ? parseDate(r.get(GH.entered)) : null) ?? existing?.enteredAt ?? today;
      const g: Grant = {
        id: existing ? existing.id : newId++, personId: person.id, type, basis,
        signingMonths: months, signingStart: draft.signingStart || null, signingEnd: draft.signingEnd || null,
        amount: Number(draft.amount), enteredAt: entered,
      };
      if (!existing) plan.creates.push(g);
      else if ((Object.keys(g) as (keyof Grant)[]).every((k) => existing[k] === g[k])) plan.unchanged++;
      else plan.updates.push(g);
    } catch (e) {
      if (e instanceof CellError) err(e.message); else throw e;
    }
  }
  return plan;
}

export type { Cell, RowError, Table };
