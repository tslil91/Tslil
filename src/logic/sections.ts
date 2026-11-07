import type { Commanders, Person, Section, SectionId } from '../domain/types';

/** Returns an error message, or null when the name is acceptable. `selfId` excludes the section being renamed. */
export function validateSectionName(name: string, sections: Section[], selfId?: SectionId): string | null {
  const n = name.trim();
  if (!n) return 'יש להזין שם למדור.';
  if (n.length > 40) return 'שם המדור ארוך מדי (עד 40 תווים).';
  if (sections.some((s) => s.id !== selfId && s.name.trim() === n)) return 'כבר קיים מדור בשם זה.';
  return null;
}

/** Stable id that is never reused, even after deletions. */
export function newSectionId(sections: Section[]): SectionId {
  const used = new Set(sections.map((s) => s.id));
  let n = sections.reduce((m, s) => Math.max(m, Number(s.id.replace(/\D/g, '')) || 0), 0) + 1;
  while (used.has(`s${n}`)) n++;
  return `s${n}`;
}

export const addSection = (sections: Section[], commanders: Commanders, name: string) => {
  const id = newSectionId(sections);
  return {
    sections: [...sections, { id, name: name.trim() }],
    commanders: { ...commanders, sections: { ...commanders.sections, [id]: null } },
  };
};

export const renameSection = (sections: Section[], id: SectionId, name: string): Section[] =>
  sections.map((s) => (s.id === id ? { ...s, name: name.trim() } : s));

/** Deleting a section moves its people directly under the head of the organization and ends its command. */
export function deleteSection(sections: Section[], people: Person[], commanders: Commanders, id: SectionId) {
  const { [id]: _removed, ...rest } = commanders.sections;
  return {
    sections: sections.filter((s) => s.id !== id),
    people: people.map((p) => (p.sectionId === id ? { ...p, sectionId: null } : p)),
    commanders: { ...commanders, sections: rest },
    moved: people.filter((p) => p.sectionId === id).length,
  };
}
