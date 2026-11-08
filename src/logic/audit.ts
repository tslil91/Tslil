import { formatDate, formatMoney } from '../domain/dates';
import { POP_LABELS, RANK_LABELS } from '../domain/rules';
import type { AppData, AuditDetail, AuditEntry, AuditKind, Billet, Grant, Person } from '../domain/types';
import { BASIS_LABELS, GRANT_TYPE_LABELS } from './grants';

export type AuditDraft = Omit<AuditEntry, 'id' | 'at' | 'actor'>;

const MAX_DRAFTS = 2000;
const DASH = '—';

const PERSON_FIELDS: { key: keyof Person; label: string; kind: 'text' | 'bool' | 'date' | 'pop' | 'rank' }[] = [
  { key: 'name', label: 'שם', kind: 'text' }, { key: 'mid', label: 'מ.א', kind: 'text' },
  { key: 'pop', label: 'אוכלוסייה', kind: 'pop' }, { key: 'rank', label: 'סוג', kind: 'rank' },
  { key: 'degree', label: 'דרגה', kind: 'text' }, { key: 'program', label: 'תוכנית', kind: 'text' },
  { key: 'entryDate', label: 'כניסה לקבע', kind: 'date' }, { key: 'releaseDate', label: 'שחרור', kind: 'date' },
  { key: 'leftAt', label: 'עזב/ה את היחידה', kind: 'date' }, { key: 'leftNote', label: 'הערה לעזיבה', kind: 'text' },
  { key: 'bachelor', label: 'תואר ראשון', kind: 'bool' }, { key: 'masters', label: 'תואר שני', kind: 'bool' },
  { key: 'gamoshA', label: 'גמו"ש א׳', kind: 'bool' }, { key: 'gamoshB', label: 'גמו"ש ב׳', kind: 'bool' },
  { key: 'dmahCFirst', label: 'הגשה ראשונה דמ"ח ג׳', kind: 'date' }, { key: 'dmahC', label: 'דמ"ח ג׳', kind: 'bool' }, { key: 'dmahCElig', label: 'זכאות דמ"ח ג׳', kind: 'date' },
  { key: 'dmahBFirst', label: 'הגשה ראשונה דמ"ח ב׳', kind: 'date' }, { key: 'dmahB', label: 'דמ"ח ב׳', kind: 'bool' }, { key: 'dmahBElig', label: 'זכאות דמ"ח ב׳', kind: 'date' },
  { key: 'dmahAFirst', label: 'הגשה ראשונה דמ"ח א׳', kind: 'date' }, { key: 'dmahA', label: 'דמ"ח א׳', kind: 'bool' }, { key: 'dmahAElig', label: 'זכאות דמ"ח א׳', kind: 'date' },
];

function fmt(kind: 'text' | 'bool' | 'date' | 'pop' | 'rank', v: unknown): string {
  if (v === null || v === undefined || v === '') return DASH;
  switch (kind) {
    case 'bool': return v ? 'כן' : 'לא';
    case 'date': return formatDate(v as string);
    case 'pop': return POP_LABELS[v as Person['pop']] ?? String(v);
    case 'rank': return RANK_LABELS[v as Person['rank']] ?? String(v);
    default: return String(v);
  }
}

const clip = (details: AuditDetail[], max = 3): string => {
  const parts = details.slice(0, max).map((d) => `${d.label}: ${d.from} ← ${d.to}`);
  return parts.join(' · ') + (details.length > max ? ` · ועוד ${details.length - max}` : '');
};

const draft = (kind: AuditKind, entityId: string | number, personId: number | null, summary: string, details: AuditDetail[] = []): AuditDraft =>
  ({ kind, entityId: String(entityId), personId, summary, details });

const byId = <T extends { id: number }>(list: T[]) => new Map(list.map((x) => [x.id, x]));

function billetLabel(b: Billet): string {
  return `${b.scope === 'int' ? 'פנימי' : 'חיצוני'} · ${b.kind === 'fix' ? 'קבוע' : 'זמני'} · דמ"ח: ${b.dmah ? 'כן' : 'לא'}`;
}

function grantLabel(g: Grant): string {
  return `${GRANT_TYPE_LABELS[g.type]} ${formatMoney(g.amount)} ${BASIS_LABELS[g.basis]}`;
}

/** Human-readable list of what changed between two states. Pure; used for the audit log. */
export function diffData(prev: AppData, next: AppData): AuditDraft[] {
  const out: AuditDraft[] = [];
  const nameOf = (id: number | null): string => {
    if (id === null) return DASH;
    return next.people.find((p) => p.id === id)?.name ?? prev.people.find((p) => p.id === id)?.name ?? `#${id}`;
  };
  const sectionName = (id: string | null, from: AppData = next): string =>
    id === null ? 'כפוף ישירות' : from.sections.find((s) => s.id === id)?.name ?? prev.sections.find((s) => s.id === id)?.name ?? id;

  // ----- sections
  const prevSec = new Map(prev.sections.map((s) => [s.id, s]));
  const nextSec = new Map(next.sections.map((s) => [s.id, s]));
  for (const s of next.sections) {
    const old = prevSec.get(s.id);
    if (!old) out.push(draft('section', s.id, null, `נוסף מדור "${s.name}"`));
    else if (old.name !== s.name) out.push(draft('section', s.id, null, `שם המדור שונה מ"${old.name}" ל"${s.name}"`, [{ label: 'שם', from: old.name, to: s.name }]));
  }
  for (const s of prev.sections) if (!nextSec.has(s.id)) out.push(draft('section', s.id, null, `נמחק המדור "${s.name}"`));

  // ----- people
  const prevPeople = byId(prev.people);
  const nextPeople = byId(next.people);
  for (const p of next.people) {
    const old = prevPeople.get(p.id);
    if (!old) { out.push(draft('person', p.id, p.id, `נוסף/ה: ${p.name} (${p.degree}, ${sectionName(p.sectionId)})`)); continue; }
    if (old === p) continue;
    const details: AuditDetail[] = [];
    for (const f of PERSON_FIELDS) {
      const a = old[f.key] ?? null, b = p[f.key] ?? null;
      if (a !== b) details.push({ label: f.label, from: fmt(f.kind, a), to: fmt(f.kind, b) });
    }
    if (old.sectionId !== p.sectionId) details.push({ label: 'מיקום בארגון', from: sectionName(old.sectionId, prev), to: sectionName(p.sectionId) });
    if (details.length) out.push(draft('person', p.id, p.id, `${p.name} — ${clip(details)}`, details));
  }
  for (const p of prev.people) if (!nextPeople.has(p.id)) out.push(draft('person', p.id, p.id, `נמחק/ה לצמיתות: ${p.name} (מ.א ${p.mid}, ${p.degree})`));

  // ----- commanders
  const cmdChange = (label: string, from: number | null, to: number | null, entity: string) => {
    if (from === to) return;
    if (from !== null) out.push(draft('commander', entity, from, `${nameOf(from)} הוסר/ה מתפקיד ${label}`));
    if (to !== null) out.push(draft('commander', entity, to, `${nameOf(to)} מונה/תה ל${label}`));
  };
  cmdChange('רע"ן', prev.commanders.org, next.commanders.org, 'org');
  for (const s of next.sections) if (prevSec.has(s.id)) cmdChange(`מפקד ${s.name}`, prev.commanders.sections[s.id] ?? null, next.commanders.sections[s.id] ?? null, s.id);

  // ----- billets
  const prevBillets = byId(prev.billets);
  const nextBillets = byId(next.billets);
  for (const b of next.billets) {
    const old = prevBillets.get(b.id);
    if (!old) { out.push(draft('billet', b.id, null, `נוסף תקן ${b.id} (${billetLabel(b)})`)); continue; }
    const details: AuditDetail[] = [];
    if (old.scope !== b.scope) details.push({ label: 'פנימי / חיצוני', from: old.scope === 'int' ? 'פנימי' : 'חיצוני', to: b.scope === 'int' ? 'פנימי' : 'חיצוני' });
    if (old.kind !== b.kind) details.push({ label: 'קבוע / זמני', from: old.kind === 'fix' ? 'קבוע' : 'זמני', to: b.kind === 'fix' ? 'קבוע' : 'זמני' });
    if (old.dmah !== b.dmah) details.push({ label: 'דמ"ח', from: old.dmah ? 'כן' : 'לא', to: b.dmah ? 'כן' : 'לא' });
    if (details.length) out.push(draft('billet', b.id, null, `תקן ${b.id} — ${clip(details)}`, details));
  }
  for (const b of prev.billets) if (!nextBillets.has(b.id)) out.push(draft('billet', b.id, null, `נמחק תקן ${b.id}`));

  // ----- billet assignments (who sits where). Assignments of a deleted billet are covered by the deletion entry.
  const prevAs = byId(prev.assignments);
  for (const a of next.assignments) {
    if (!nextBillets.has(a.billetId)) continue;
    const old = prevAs.get(a.id);
    if (!old && a.end === null && a.personId !== null) out.push(draft('billet', a.billetId, a.personId, `${nameOf(a.personId)} שובץ/ה בתקן ${a.billetId}`));
    else if (old && old.end === null && a.end !== null && a.personId !== null) out.push(draft('billet', a.billetId, a.personId, `${nameOf(a.personId)} הוסר/ה מתקן ${a.billetId}`));
  }

  // ----- grants
  const prevGr = byId(prev.grants);
  const nextGr = byId(next.grants);
  for (const g of next.grants) {
    const old = prevGr.get(g.id);
    if (!old) { out.push(draft('grant', g.id, g.personId, `נוסף ל${nameOf(g.personId)}: ${grantLabel(g)}`)); continue; }
    if (old === g) continue;
    const details: AuditDetail[] = [];
    const add = (label: string, a: string, b: string) => { if (a !== b) details.push({ label, from: a, to: b }); };
    add('סוג', GRANT_TYPE_LABELS[old.type], GRANT_TYPE_LABELS[g.type]);
    add('סכום', formatMoney(old.amount), formatMoney(g.amount));
    add('ברוטו / נטו', BASIS_LABELS[old.basis], BASIS_LABELS[g.basis]);
    add('משך חתימה', old.signingMonths ? `${old.signingMonths} חודשים` : DASH, g.signingMonths ? `${g.signingMonths} חודשים` : DASH);
    add('תחילת חתימה', formatDate(old.signingStart), formatDate(g.signingStart));
    add('סיום חתימה', formatDate(old.signingEnd), formatDate(g.signingEnd));
    if (old.personId !== g.personId) add('איש צוות', nameOf(old.personId), nameOf(g.personId));
    if (details.length) out.push(draft('grant', g.id, g.personId, `${nameOf(g.personId)} — תוקן ${GRANT_TYPE_LABELS[g.type]}: ${clip(details)}`, details));
  }
  for (const g of prev.grants) if (!nextGr.has(g.id)) out.push(draft('grant', g.id, g.personId, `נמחק מ${nameOf(g.personId)}: ${grantLabel(g)}`));

  // ----- notes
  const prevNotes = byId(prev.notes);
  const nextNotes = byId(next.notes);
  for (const n of next.notes) if (!prevNotes.has(n.id)) out.push(draft('note', n.id, n.personId, `נוספה הערה ל${nameOf(n.personId)}`, [{ label: 'הערה', from: '', to: n.text.slice(0, 160) }]));
  for (const n of prev.notes) if (!nextNotes.has(n.id)) out.push(draft('note', n.id, n.personId, `נמחקה הערה של ${nameOf(n.personId)}`, [{ label: 'הערה', from: n.text.slice(0, 160), to: '' }]));

  if (out.length > MAX_DRAFTS) {
    return [draft('system', 'bulk', null, `בוצעו שינויים רבים בבת אחת (${out.length} רישומים) — לא פורטו אחד־אחד`)];
  }
  return out;
}

export const systemEntry = (summary: string): AuditDraft => draft('system', 'system', null, summary);
