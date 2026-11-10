import { create, type StateCreator } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { todayISO } from '../domain/dates';
import { normalizePerson } from '../domain/rules';
import { pickData } from '../domain/data';
import type { AppData, AuditEntry, Billet, Grant, Person } from '../domain/types';
import type { AuditDraft } from '../logic/audit';
import { deriveSectionHistory } from '../logic/history';
import { nextId, openAssignment, removeBillet, setPersonBillet } from '../logic/billets';
import { addSection, deleteSection, renameSection } from '../logic/sections';
import { bulkMove, type BulkDest } from '../logic/bulk';
import { deletePerson, markLeft, restoreLeft } from '../logic/removal';
import { applyPlacement, type PersonDraft, type PlacementKey } from '../logic/people';
import type { Filters } from '../logic/people';
import type { NewScenarioOp, ScenarioOp } from '../logic/simulator';
import { seedData, type Data } from './seed';

interface Toast { id: number; message: string }

/** Set by actions that replace everything (restore): the tracker then logs this instead of a field-by-field diff. */
export const trackerHooks: { override: AuditDraft[] | null } = { override: null };

/** True once the app is connected to the server: shared data is then not kept in the browser. */
export const runtime = { serverMode: false };

const AUDIT_CAP = 5000;

interface Actions {
  toast: Toast | null;
  /** Local-mode change log (in server mode the server keeps it). */
  audit: AuditEntry[];
  /** Self-declared user name used in the change log and notes. There is no login. */
  actor: string;
  setActor: (name: string) => void;
  setUnitName: (name: string) => void;
  appendAudit: (entries: AuditDraft[]) => void;
  addNote: (personId: number, text: string) => void;
  deleteNote: (id: number) => void;
  /** Replace all shared data (restore from a backup, or load from the server). */
  replaceData: (data: AppData, auditSummary?: string) => void;
  /** What-if changes of the simulator — never applied to the real data. */
  scenario: ScenarioOp[];
  /** One-shot hand-off: filters the people table should open with (set by the overview screen). */
  pendingPeopleFilter: { filters: Filters; message: string } | null;
  setPendingPeopleFilter: (p: { filters: Filters; message: string } | null) => void;
  addScenarioOp: (op: NewScenarioOp) => void;
  removeScenarioOp: (id: number) => void;
  clearScenario: () => void;
  showToast: (message: string) => void;
  clearToast: () => void;
  /** Create or update a person (id null = new). The billet is applied through billet assignments. */
  savePerson: (draft: PersonDraft) => Person;
  placePerson: (personId: number, key: PlacementKey) => void;
  /** Appoint a commander for the organization head (רע"ן) or a section; null = leave the post empty. */
  setCommander: (unit: { kind: 'org' } | { kind: 'section'; id: string }, personId: number | null) => void;
  /** Each returns an error message, or null on success. */
  markPersonLeft: (id: number, leftAt: string, note: string) => string | null;
  restorePersonToUnit: (id: number) => string | null;
  deletePersonForGood: (id: number) => string | null;
  /** Move several people at once. Returns what happened (for the confirmation message). */
  bulkMovePeople: (ids: number[], dest: BulkDest) => ReturnType<typeof bulkMove>;
  addSection: (name: string) => void;
  renameSection: (id: string, name: string) => void;
  /** Returns how many people were moved to the head of the organization. */
  deleteSection: (id: string) => number;
  addBillet: (b: Billet) => void;
  updateBillet: (id: number, patch: Partial<Omit<Billet, 'id'>>) => void;
  deleteBillet: (id: number) => void;
  importPeople: (drafts: PersonDraft[]) => void;
  importBillets: (items: Billet[]) => void;
  importGrants: (items: Grant[]) => void;
  saveGrant: (g: Grant) => void;
  deleteGrant: (id: number) => void;
  resetDemo: () => void;
}

export type AppState = Data & Actions;

const creator: StateCreator<AppState, [['zustand/persist', unknown]]> = (set0, get) => {
  /** Same as `set`, but keeps the dated section history in step whenever the people list changes. */
  const set = ((partial: unknown, replace?: boolean) => {
    const prev = get();
    const patch = (typeof partial === 'function' ? (partial as (s: AppState) => Partial<AppState>)(prev) : partial) as Partial<AppState>;
    if (patch.people && patch.people !== prev.people && !('sectionHistory' in patch)) {
      patch.sectionHistory = deriveSectionHistory(prev.sectionHistory, patch.people, todayISO());
    }
    (set0 as (p: unknown, r?: boolean) => void)(patch, replace);
  }) as typeof set0;
  return {

      ...seedData(),
      toast: null,
      audit: [],
      actor: '',
      setActor: (actor) => set({ actor: actor.trim().slice(0, 40) }),
      setUnitName: (name) => set({ unitName: name.trim().slice(0, 40) || undefined }),
      appendAudit: (entries) => set((s) => {
        const at = new Date().toISOString();
        let id = nextId(s.audit);
        const added = entries.map((e) => ({ ...e, id: id++, at, actor: s.actor || 'משתמש' }));
        return { audit: [...s.audit, ...added].slice(-AUDIT_CAP) };
      }),
      addNote: (personId, text) => set((s) => {
        const t = text.trim().slice(0, 2000);
        if (!t) return {};
        return { notes: [...s.notes, { id: nextId(s.notes), personId, text: t, createdAt: new Date().toISOString(), author: s.actor || 'משתמש' }] };
      }),
      deleteNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
      replaceData: (data, auditSummary) => {
        if (auditSummary) trackerHooks.override = [{ kind: 'system', entityId: 'system', personId: null, summary: auditSummary, details: [] }];
        set({ ...data });
      },
      scenario: [],
      pendingPeopleFilter: null,
      setPendingPeopleFilter: (pendingPeopleFilter) => set({ pendingPeopleFilter }),
      addScenarioOp: (op) => set((s) => ({ scenario: [...s.scenario, { ...op, id: nextId(s.scenario) } as ScenarioOp] })),
      removeScenarioOp: (id) => set((s) => ({ scenario: s.scenario.filter((o) => o.id !== id) })),
      clearScenario: () => set({ scenario: [] }),
      showToast: (message) => set({ toast: { id: Date.now(), message } }),
      clearToast: () => set({ toast: null }),

      savePerson: (draft) => {
        const s = get();
        const { billet, mid, ...rest } = draft;
        const id = draft.id > 0 ? draft.id : nextId(s.people);
        const person = normalizePerson({ ...rest, id, mid: Number(mid) });
        const exists = s.people.some((p) => p.id === id);
        const people = exists ? s.people.map((p) => (p.id === id ? person : p)) : [...s.people, person];
        const assignments = setPersonBillet(s.assignments, person, person.pop === 'keva' ? billet : null, todayISO());
        // keep the name in open assignments in sync
        const synced = assignments.map((a) => (a.personId === id && a.end === null ? { ...a, personName: person.name } : a));
        // leaving a section ends that section's command
        const sections = { ...s.commanders.sections };
        for (const k of Object.keys(sections)) if (sections[k] === id && person.sectionId !== k) sections[k] = null;
        set({ people, assignments: synced, commanders: { ...s.commanders, sections } });
        return person;
      },

      setCommander: (unit, personId) => {
        const s = get();
        if (personId === null) {
          set({ commanders: unit.kind === 'org' ? { ...s.commanders, org: null } : { ...s.commanders, sections: { ...s.commanders.sections, [unit.id]: null } } });
          return;
        }
        set(applyPlacement(s.people, s.commanders, personId, unit.kind === 'org' ? 'orgcmd' : `cmd:${unit.id}`));
      },

      markPersonLeft: (id, leftAt, note) => {
        const r = markLeft(pickData(get()), id, leftAt, note, todayISO());
        if (!r.ok) return r.error;
        set({ ...r.data });
        return null;
      },
      restorePersonToUnit: (id) => {
        const r = restoreLeft(pickData(get()), id);
        if (!r.ok) return r.error;
        set({ ...r.data });
        return null;
      },
      deletePersonForGood: (id) => {
        const r = deletePerson(pickData(get()), id);
        if (!r.ok) return r.error;
        set({ ...r.data, scenario: get().scenario.filter((o) => o.personId !== id) });
        return null;
      },

      bulkMovePeople: (ids, dest) => {
        const s = get();
        const r = bulkMove(s.people, s.commanders, ids, dest);
        if (r.moved > 0) set({ people: r.people, commanders: r.commanders });
        return r;
      },

      placePerson: (personId, key) => {
        const s = get();
        set(applyPlacement(s.people, s.commanders, personId, key));
      },

      importPeople: (drafts) => {
        // people leaving a billet first, so a billet passed between two people in one file is never double-booked
        const map = new Map(get().assignments.filter((a) => a.end === null && a.personId !== null).map((a) => [a.personId as number, a.billetId]));
        const leaving = drafts.filter((d) => map.has(d.id) && map.get(d.id) !== d.billet);
        const rest = drafts.filter((d) => !leaving.includes(d));
        for (const d of [...leaving, ...rest]) get().savePerson(d);
      },
      importBillets: (items) => set((s) => {
        const byId = new Map(items.map((b) => [b.id, b]));
        const updated = s.billets.map((b) => byId.get(b.id) ?? b);
        const created = items.filter((b) => !s.billets.some((x) => x.id === b.id));
        return { billets: [...updated, ...created].sort((a, b) => a.id - b.id) };
      }),
      importGrants: (items) => set((s) => {
        const byId = new Map(items.map((g) => [g.id, g]));
        const updated = s.grants.map((g) => byId.get(g.id) ?? g);
        return { grants: [...updated, ...items.filter((g) => !s.grants.some((x) => x.id === g.id))] };
      }),

      addSection: (name) => set((s) => addSection(s.sections, s.commanders, name)),
      renameSection: (id, name) => set((s) => ({ sections: renameSection(s.sections, id, name) })),
      deleteSection: (id) => {
        const s = get();
        const r = deleteSection(s.sections, s.people, s.commanders, id);
        set({ sections: r.sections, people: r.people, commanders: r.commanders });
        return r.moved;
      },

      addBillet: (b) => set((s) => ({ billets: [...s.billets, b] })),
      updateBillet: (id, patch) => set((s) => ({ billets: s.billets.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
      deleteBillet: (id) => set((s) => removeBillet(s.billets, s.assignments, id)),

      saveGrant: (g) => set((s) => ({ grants: s.grants.some((x) => x.id === g.id) ? s.grants.map((x) => (x.id === g.id ? g : x)) : [...s.grants, g] })),
      deleteGrant: (id) => set((s) => ({ grants: s.grants.filter((g) => g.id !== id) })),

      resetDemo: () => {
        trackerHooks.override = [{ kind: 'system', entityId: 'system', personId: null, summary: 'נתוני ההדגמה אופסו', details: [] }];
        set({ ...seedData(), toast: null, scenario: [] });
      },
  };
};

export const useStore = create<AppState>()(
  persist(creator, {
    name: 'personnel-billets-demo',
    version: 2,
    storage: createJSONStorage(() => localStorage),
    // In server mode the server is the source of truth: only per-user things stay in the browser.
    partialize: (s) => (runtime.serverMode
      ? ({ scenario: s.scenario, actor: s.actor } as Partial<AppState>)
      : ({ ...pickData(s), scenario: s.scenario, audit: s.audit, actor: s.actor } as Partial<AppState>)),
    migrate: (persisted, version) => {
      const s = (persisted ?? {}) as Partial<AppState>;
      if (version < 2) {
        return { ...s, notes: s.notes ?? [], audit: [], actor: '', sectionHistory: deriveSectionHistory([], s.people ?? [], todayISO()) } as AppState;
      }
      return s as AppState;
    },
  }),
);

/** Helper used by validation: who currently sits on a billet. */
export const occupantOf = (s: Pick<Data, 'assignments'>) => (billetId: number): number | null => openAssignment(s.assignments, billetId)?.personId ?? null;
