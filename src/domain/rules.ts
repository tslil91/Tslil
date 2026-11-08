import type { Person, Population, RankType } from './types';

export const POP_LABELS: Record<Population, string> = { keva: 'קבע', hova: 'חובה', civ: 'אזרח' };
export const RANK_LABELS: Record<RankType, string> = { soldier: 'חייל', officer: 'קצין', ncos: 'נגד', civilian: 'אזרח' };

/** Allowed rank types per population. */
export const RANKS_BY_POP: Record<Population, RankType[]> = {
  keva: ['officer', 'ncos'],
  hova: ['soldier', 'officer'],
  civ: ['civilian'],
};

/** Closed degree lists per population + type, low → high. */
export const DEGREES: Record<string, string[]> = {
  'hova-soldier': ['טוראי', 'רב"ט', 'סמל', 'סמ"ר'],
  'hova-officer': ['קמ"א', 'סג"מ', 'סגן'],
  'keva-officer': ['קא"ב', 'סגן', 'סרן', 'רס"ן', 'סא"ל', 'אל"מ'],
  'keva-ncos': ['סמ"ר', 'רס"ל', 'רס"ר', 'רס"מ', 'רס"ב', 'רנ"ג'],
  'civ-civilian': ['אע"צ', 'אע"ב'],
};

/** Global degree order, low → high (civilians below uniformed personnel). קמ"א and קא"ב sit just below the other officer degrees. */
export const LADDER = ['אע"צ', 'אע"ב', 'טוראי', 'רב"ט', 'סמל', 'סמ"ר', 'רס"ל', 'רס"ר', 'רס"מ', 'רס"ב', 'רנ"ג', 'קמ"א', 'קא"ב', 'סג"מ', 'סגן', 'סרן', 'רס"ן', 'סא"ל', 'אל"מ'];

export const PROGRAMS: Partial<Record<RankType, string[]>> = {
  soldier: ['מט"ל'],
  officer: ['עתודה', 'אקדמזיציה', 'פיון', 'תלפיות', 'פסגות'],
};
export const ALL_PROGRAMS = [...(PROGRAMS.soldier ?? []), ...(PROGRAMS.officer ?? [])];

export const degreesFor = (pop: Population, rank: RankType): string[] => DEGREES[`${pop}-${rank}`] ?? [];
export const programsFor = (rank: RankType): string[] => PROGRAMS[rank] ?? [];
/** Everyone who has not been removed as having left the unit. */
export const isActivePerson = (p: { leftAt?: string | null }): boolean => !p.leftAt;

export const degreeIndex = (degree: string): number => LADDER.indexOf(degree);

export const EDU_FIELDS = ['bachelor', 'masters', 'gamoshA'] as const;
export const OFFICER_FIELDS = [
  'gamoshB',
  'dmahCFirst', 'dmahC', 'dmahCElig',
  'dmahBFirst', 'dmahB', 'dmahBElig',
  'dmahAFirst', 'dmahA', 'dmahAElig',
] as const;
const OFFICER_DATE_FIELDS = new Set<string>(['dmahCFirst', 'dmahCElig', 'dmahBFirst', 'dmahBElig', 'dmahAFirst', 'dmahAElig']);

type PopRank = { pop: Population; rank: RankType };

/** Is a field relevant for this population / type? */
export function applicable(key: string, p: PopRank): boolean {
  if (key === 'billet' || key === 'entryDate') return p.pop === 'keva';
  if (key === 'program') return p.rank === 'soldier' || p.rank === 'officer';
  if ((EDU_FIELDS as readonly string[]).includes(key)) return p.rank === 'officer' || p.rank === 'ncos';
  if ((OFFICER_FIELDS as readonly string[]).includes(key)) return p.rank === 'officer';
  return true;
}

/** Make rank / degree / program consistent with the population (used while editing). */
export function fixCombo<T extends PopRank & { degree: string; program: string | null }>(d: T): T {
  const out = { ...d };
  const ranks = RANKS_BY_POP[out.pop];
  if (!ranks.includes(out.rank)) out.rank = ranks[0];
  const degrees = degreesFor(out.pop, out.rank);
  if (!degrees.includes(out.degree)) out.degree = degrees[0];
  if (out.program && !programsFor(out.rank).includes(out.program)) out.program = null;
  return out;
}

/** Final clean-up before saving: drop fields that do not apply, fill defaults for those that do. */
export function normalizePerson(p: Person): Person {
  const out: Person = fixCombo({ ...p, name: p.name.trim() });
  if (out.pop !== 'keva') out.entryDate = null;
  if (!applicable('program', out)) out.program = null;
  const rec = out as unknown as Record<string, unknown>;
  for (const k of [...EDU_FIELDS, ...OFFICER_FIELDS]) {
    if (applicable(k, out)) {
      if (rec[k] === undefined) rec[k] = OFFICER_DATE_FIELDS.has(k) ? null : false;
    } else {
      delete rec[k];
    }
  }
  return out;
}
