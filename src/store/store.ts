import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { todayISO } from '../domain/dates';
import { normalizePerson } from '../domain/rules';
import type { Billet, Grant, Person } from '../domain/types';
import { nextId, openAssignment, removeBillet, setPersonBillet } from '../logic/billets';
import { addSection, deleteSection, renameSection } from '../logic/sections';
import { applyPlacement, type PersonDraft, type PlacementKey } from '../logic/people';
import type { Filters } from '../logic/people';
import type { NewScenarioOp, ScenarioOp } from '../logic/simulator';
import { seedData, type Data } from './seed';

interface Toast { id: number; message: string }

interface Actions {
  toast: Toast | null;
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

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...seedData(),
      toast: null,
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

      resetDemo: () => set({ ...seedData(), toast: null, scenario: [] }),
    }),
    {
      name: 'personnel-billets-demo',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ sections, people, commanders, billets, assignments, grants, scenario }) => ({ sections, people, commanders, billets, assignments, grants, scenario }),
    },
  ),
);

/** Helper used by validation: who currently sits on a billet. */
export const occupantOf = (s: Pick<Data, 'assignments'>) => (billetId: number): number | null => openAssignment(s.assignments, billetId)?.personId ?? null;
