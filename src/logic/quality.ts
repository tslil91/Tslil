import { applicable, degreesFor, programsFor } from '../domain/rules';
import type { AppData, ISODate } from '../domain/types';

export type IssueTarget = { kind: 'person'; id: number } | { kind: 'billet'; id: number } | { kind: 'section'; id: string } | { kind: 'org' };
export interface Issue { id: string; severity: 'error' | 'warn'; message: string; target: IssueTarget }

const DMAH = [
  { done: 'dmahC' as const, elig: 'dmahCElig' as const, level: 'ג׳' },
  { done: 'dmahB' as const, elig: 'dmahBElig' as const, level: 'ב׳' },
  { done: 'dmahA' as const, elig: 'dmahAElig' as const, level: 'א׳' },
];

/** Consistency checks over the whole data set. Errors = data that cannot be right; warnings = worth a look. */
export function dataIssues(d: AppData, today: ISODate): Issue[] {
  const out: Issue[] = [];
  const add = (id: string, severity: Issue['severity'], message: string, target: IssueTarget) => out.push({ id, severity, message, target });
  const people = new Map(d.people.map((p) => [p.id, p]));
  const billets = new Set(d.billets.map((b) => b.id));
  const sections = new Set(d.sections.map((s) => s.id));
  const name = (id: number) => people.get(id)?.name ?? `#${id}`;

  // ----- organization
  if (d.commanders.org === null) add('org-no-cmd', 'warn', 'לא מונה רע"ן', { kind: 'org' });
  else if (!people.has(d.commanders.org)) add('org-cmd-missing', 'error', 'רע"ן אינו קיים ברשימת האנשים', { kind: 'org' });
  else if (people.get(d.commanders.org)!.sectionId !== null) add('org-cmd-section', 'error', `רע"ן (${name(d.commanders.org)}) משויך למדור`, { kind: 'person', id: d.commanders.org });
  for (const s of d.sections) {
    const c = d.commanders.sections[s.id] ?? null;
    if (c === null) add(`sec-no-cmd-${s.id}`, 'warn', `ל${s.name} לא מונה מפקד`, { kind: 'section', id: s.id });
    else if (!people.has(c)) add(`sec-cmd-missing-${s.id}`, 'error', `מפקד ${s.name} אינו קיים ברשימת האנשים`, { kind: 'section', id: s.id });
    else if (people.get(c)!.sectionId !== s.id) add(`sec-cmd-away-${s.id}`, 'error', `מפקד ${s.name} (${name(c)}) אינו משויך למדור`, { kind: 'person', id: c });
  }

  // ----- people
  const mids = new Map<number, number[]>();
  for (const p of d.people) {
    mids.set(p.mid, [...(mids.get(p.mid) ?? []), p.id]);
    const t = { kind: 'person' as const, id: p.id };
    if (p.sectionId !== null && !sections.has(p.sectionId)) add(`p-sec-${p.id}`, 'error', `${p.name}: משויך/ת למדור שאינו קיים`, t);
    if (!degreesFor(p.pop, p.rank).includes(p.degree)) add(`p-degree-${p.id}`, 'error', `${p.name}: הדרגה "${p.degree}" אינה תקינה עבור סוג האוכלוסייה והסוג`, t);
    if (p.program && !programsFor(p.rank).includes(p.program)) add(`p-program-${p.id}`, 'error', `${p.name}: התוכנית "${p.program}" אינה אפשרית עבור הסוג`, t);
    if (p.pop !== 'civ' && !p.releaseDate) add(`p-release-${p.id}`, 'warn', `${p.name}: חסר תאריך שחרור`, t);
    if (p.pop === 'keva' && !p.entryDate) add(`p-entry-${p.id}`, 'warn', `${p.name}: חסר תאריך כניסה לקבע`, t);
    if (p.entryDate && p.releaseDate && p.releaseDate < p.entryDate) add(`p-dates-${p.id}`, 'error', `${p.name}: תאריך השחרור קודם לתאריך הכניסה לקבע`, t);
    for (const l of DMAH) {
      if (applicable(l.done, p) && p[l.done] === true && !p[l.elig]) add(`p-dmah-${l.level}-${p.id}`, 'warn', `${p.name}: דמ"ח ${l.level} בוצע אך אין תאריך זכאות`, t);
    }
  }
  for (const [mid, ids] of mids) {
    if (ids.length > 1) add(`mid-${mid}`, 'error', `מ.א ${mid} מופיע אצל ${ids.length} אנשים (${ids.map(name).join(', ')})`, { kind: 'person', id: ids[0] });
  }

  // ----- billet assignments
  const openByPerson = new Map<number, number[]>();
  const openByBillet = new Map<number, number[]>();
  for (const a of d.assignments) {
    if (a.end !== null) continue;
    if (a.personId !== null) openByPerson.set(a.personId, [...(openByPerson.get(a.personId) ?? []), a.billetId]);
    openByBillet.set(a.billetId, [...(openByBillet.get(a.billetId) ?? []), a.personId ?? -1]);
    if (!billets.has(a.billetId)) add(`a-billet-${a.id}`, 'error', `שיבוץ לתקן ${a.billetId} שאינו קיים`, a.personId !== null ? { kind: 'person', id: a.personId } : { kind: 'org' });
  }
  for (const [pid, list] of openByPerson) {
    const p = people.get(pid);
    if (!p) { add(`a-person-${pid}`, 'error', `שיבוץ פעיל לאדם שאינו קיים (#${pid})`, { kind: 'billet', id: list[0] }); continue; }
    if (list.length > 1) add(`a-multi-${pid}`, 'error', `${p.name} משובץ/ת ב־${list.length} תקנים בו־זמנית (${list.join(', ')})`, { kind: 'person', id: pid });
    if (p.pop !== 'keva') add(`a-notkeva-${pid}`, 'error', `${p.name} אינו/ה קבע אך משובץ/ת בתקן ${list[0]}`, { kind: 'person', id: pid });
    if (p.releaseDate && p.releaseDate <= today) add(`a-released-${pid}`, 'warn', `${p.name} משוחרר/ת (${p.releaseDate.split('-').reverse().join('/')}) ועדיין משובץ/ת בתקן ${list[0]}`, { kind: 'person', id: pid });
  }
  for (const [bid, list] of openByBillet) {
    if (list.length > 1) add(`b-multi-${bid}`, 'error', `בתקן ${bid} משובצים ${list.length} אנשים בו־זמנית`, { kind: 'billet', id: bid });
  }

  // ----- grants and notes
  for (const g of d.grants) {
    if (!people.has(g.personId)) add(`g-person-${g.id}`, 'error', `מענק #${g.id} משויך לאדם שאינו קיים`, { kind: 'org' });
    else if (g.signingStart && g.signingEnd && g.signingEnd <= g.signingStart) add(`g-dates-${g.id}`, 'error', `${name(g.personId)}: תאריך סיום החתימה אינו אחרי ההתחלה`, { kind: 'person', id: g.personId });
  }
  for (const n of d.notes) if (!people.has(n.personId)) add(`n-person-${n.id}`, 'warn', `הערה #${n.id} משויכת לאדם שאינו קיים`, { kind: 'org' });

  return out.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1));
}
