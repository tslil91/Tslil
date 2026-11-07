import type { Person } from '../domain/types';
import type { Snapshot } from './simulator';

export interface Comparison {
  kpis: { label: string; a: number; b: number; delta: number }[];
  moved: { person: Person; from: string; to: string }[];
  arrived: { person: Person; group: string }[];
  left: { person: Person; group: string }[];
  billets: { billetId: number; kind: 'filled' | 'vacated' | 'changed'; from: string | null; to: string | null }[];
  benchEntered: Person[];
  benchLeft: Person[];
  changes: number;
}

/** What differs between the organization on date A and on date B (same data, optionally the same scenario). */
export function compareSnapshots(a: Snapshot, b: Snapshot): Comparison {
  const where = (s: Snapshot) => {
    const m = new Map<number, { person: Person; group: string }>();
    for (const g of s.groups) for (const p of g.people) m.set(p.person.id, { person: p.person, group: g.name });
    return m;
  };
  const wa = where(a), wb = where(b);
  const moved: Comparison['moved'] = [];
  const arrived: Comparison['arrived'] = [];
  const left: Comparison['left'] = [];
  for (const [id, x] of wb) {
    const y = wa.get(id);
    if (!y) arrived.push({ person: x.person, group: x.group });
    else if (y.group !== x.group) moved.push({ person: x.person, from: y.group, to: x.group });
  }
  for (const [id, y] of wa) if (!wb.has(id)) left.push({ person: y.person, group: y.group });

  const billets: Comparison['billets'] = [];
  const bb = new Map(b.billets.map((x) => [x.billet.id, x]));
  for (const x of a.billets) {
    const y = bb.get(x.billet.id);
    if (!y) continue;
    const from = x.occupantName, to = y.occupantName;
    const same = (x.occupant?.personId ?? x.occupantName) === (y.occupant?.personId ?? y.occupantName);
    if (same) continue;
    billets.push({ billetId: x.billet.id, kind: from === null ? 'filled' : to === null ? 'vacated' : 'changed', from, to });
  }

  const ba = new Set(a.bench.map((x) => x.person.id)), bbn = new Set(b.bench.map((x) => x.person.id));
  const benchEntered = b.bench.filter((x) => !ba.has(x.person.id)).map((x) => x.person);
  const benchLeft = a.bench.filter((x) => !bbn.has(x.person.id)).map((x) => x.person);

  const kp = (label: string, f: (s: Snapshot) => number) => ({ label, a: f(a), b: f(b), delta: f(b) - f(a) });
  const kpis = [kp('אנשים בארגון', (s) => s.kpis.present), kp('תקנים מאוישים', (s) => s.kpis.filled), kp('תקנים פנויים', (s) => s.kpis.vacant), kp('על תקני', (s) => s.kpis.bench)];
  return { kpis, moved, arrived, left, billets, benchEntered, benchLeft, changes: moved.length + arrived.length + left.length + billets.length + benchEntered.length + benchLeft.length };
}
