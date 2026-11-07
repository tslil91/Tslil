import { ALL_PROGRAMS, LADDER, POP_LABELS, RANK_LABELS, RANKS_BY_POP, degreesFor, programsFor } from '../domain/rules';
import type { PersonRow, Population, RankType } from '../domain/types';

export type FieldKey = Exclude<keyof PersonRow, 'id' | 'sectionId'>;
export type FieldType = 'text' | 'num' | 'enum' | 'bool' | 'date' | 'billet';
export type FieldGroup = 'base' | 'edu' | 'dmah';

export interface FieldDef {
  key: FieldKey;
  label: string;
  type: FieldType;
  group: FieldGroup;
  width: number;
}

/** Single registry: drives table columns, filters, sorting, inline editors and the add form. */
export const FIELDS: FieldDef[] = [
  { key: 'mid', label: 'מ.א', type: 'num', group: 'base', width: 104 },
  { key: 'pop', label: 'אוכלוסייה', type: 'enum', group: 'base', width: 104 },
  { key: 'rank', label: 'סוג', type: 'enum', group: 'base', width: 96 },
  { key: 'degree', label: 'דרגה', type: 'enum', group: 'base', width: 100 },
  { key: 'program', label: 'תוכנית', type: 'enum', group: 'base', width: 124 },
  { key: 'billet', label: 'תקן (קבע)', type: 'billet', group: 'base', width: 120 },
  { key: 'entryDate', label: 'כניסה לקבע', type: 'date', group: 'base', width: 140 },
  { key: 'releaseDate', label: 'שחרור', type: 'date', group: 'base', width: 140 },
  { key: 'bachelor', label: 'תואר ראשון', type: 'bool', group: 'edu', width: 104 },
  { key: 'masters', label: 'תואר שני', type: 'bool', group: 'edu', width: 100 },
  { key: 'gamoshA', label: 'גמו"ש א׳', type: 'bool', group: 'edu', width: 100 },
  { key: 'gamoshB', label: 'גמו"ש ב׳', type: 'bool', group: 'edu', width: 100 },
  { key: 'dmahCFirst', label: 'הגשה ראשונה ג׳', type: 'date', group: 'dmah', width: 150 },
  { key: 'dmahC', label: 'דמ"ח ג׳', type: 'bool', group: 'dmah', width: 92 },
  { key: 'dmahCElig', label: 'זכאות ג׳', type: 'date', group: 'dmah', width: 140 },
  { key: 'dmahBFirst', label: 'הגשה ראשונה ב׳', type: 'date', group: 'dmah', width: 150 },
  { key: 'dmahB', label: 'דמ"ח ב׳', type: 'bool', group: 'dmah', width: 92 },
  { key: 'dmahBElig', label: 'זכאות ב׳', type: 'date', group: 'dmah', width: 140 },
  { key: 'dmahAFirst', label: 'הגשה ראשונה א׳', type: 'date', group: 'dmah', width: 150 },
  { key: 'dmahA', label: 'דמ"ח א׳', type: 'bool', group: 'dmah', width: 92 },
  { key: 'dmahAElig', label: 'זכאות א׳', type: 'date', group: 'dmah', width: 140 },
];

export const NAME_FIELD: FieldDef = { key: 'name', label: 'שם', type: 'text', group: 'base', width: 200 };

export type Option = { value: string; label: string };
const opts = (pairs: [string, string][]): Option[] => pairs.map(([value, label]) => ({ value, label }));

/** Options for a column filter. Empty array = no filter for that column. */
export function filterOptions(f: FieldDef): Option[] {
  if (f.type === 'bool') return opts([['yes', 'כן'], ['no', 'לא']]);
  if (f.type === 'date') return opts([['past', 'עבר'], ['d90', 'עד 90 יום'], ['y1', 'עד שנה']]);
  if (f.type === 'billet') return opts([['has', 'משובץ בתקן'], ['bench', 'על תקני']]);
  switch (f.key) {
    case 'pop': return opts(Object.entries(POP_LABELS) as [string, string][]);
    case 'rank': return opts(Object.entries(RANK_LABELS) as [string, string][]);
    case 'degree': return [...LADDER].reverse().map((d) => ({ value: d, label: d }));
    case 'program': return [{ value: 'none', label: 'ללא' }, ...ALL_PROGRAMS.map((p) => ({ value: p, label: p }))];
    default: return [];
  }
}

/** Options for an inline / form editor, dependent on the draft's population and type. */
export function editOptions(key: FieldKey, d: { pop: Population; rank: RankType }): Option[] {
  switch (key) {
    case 'pop': return opts(Object.entries(POP_LABELS) as [string, string][]);
    case 'rank': return RANKS_BY_POP[d.pop].map((r) => ({ value: r, label: RANK_LABELS[r] }));
    case 'degree': return degreesFor(d.pop, d.rank).map((x) => ({ value: x, label: x }));
    case 'program': return [{ value: '', label: 'ללא' }, ...programsFor(d.rank).map((p) => ({ value: p, label: p }))];
    default: return [];
  }
}
