import type { Commanders, Person, SectionId } from '../domain/types';
import { applyPlacement } from './people';

export type BulkDest = { kind: 'org' } | { kind: 'section'; id: SectionId };

export interface BulkMoveResult {
  people: Person[];
  commanders: Commanders;
  moved: number;
  /** Already in the destination — nothing to do. */
  unchanged: number;
  skipped: { id: number; name: string; reason: string }[];
  /** Section commanders who lost their command because they left their section. */
  commandsEnded: number;
}

/**
 * Move several people to one destination (a section, or directly under the head of the organization).
 * The organization commander never belongs to a section, so they are skipped when the destination is a section.
 * A section commander who leaves their section stops commanding it.
 */
export function bulkMove(people: Person[], cmd: Commanders, ids: number[], dest: BulkDest): BulkMoveResult {
  let ps = people;
  let cm = cmd;
  const target = dest.kind === 'org' ? null : dest.id;
  const skipped: BulkMoveResult['skipped'] = [];
  let moved = 0, unchanged = 0, commandsEnded = 0;
  for (const id of new Set(ids)) {
    const p = ps.find((x) => x.id === id);
    if (!p) continue;
    if (p.sectionId === target) { unchanged++; continue; }
    if (cm.org === p.id && target !== null) { skipped.push({ id: p.id, name: p.name, reason: 'מפקד הארגון אינו משויך למדור' }); continue; }
    if (p.sectionId && cm.sections[p.sectionId] === p.id) commandsEnded++;
    const r = applyPlacement(ps, cm, p.id, target === null ? 'org' : `sec:${target}`);
    ps = r.people; cm = r.commanders; moved++;
  }
  return { people: ps, commanders: cm, moved, unchanged, skipped, commandsEnded };
}
