import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { todayISO } from '../domain/dates';
import { normalizePerson } from '../domain/rules';
import type { Billet, Grant, Person } from '../domain/types';
import { nextId, openAssignment, removeBillet, setPersonBillet } from '../logic/billets';
import { applyPlacement, type PersonDraft, type PlacementKey } from '../logic/people';
import { seedData, type Data } from './seed';

interface Toast { id: number; message: string }

interface Actions {
  toast: Toast | null;
  showToast: (message: string) => void;
  clearToast: () => void;
  /** Create or update a person (id null = new). The billet is applied through billet assignments. */
  savePerson: (draft: PersonDraft) => Person;
  placePerson: (personId: number, key: PlacementKey) => void;
  addBillet: (b: Billet) => void;
  updateBillet: (id: number, patch: Partial<Omit<Billet, 'id'>>) => void;
  deleteBillet: (id: number) => void;
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
        set({ people, assignments: synced });
        return person;
      },

      placePerson: (personId, key) => {
        const s = get();
        set(applyPlacement(s.people, s.commanders, personId, key));
      },

      addBillet: (b) => set((s) => ({ billets: [...s.billets, b] })),
      updateBillet: (id, patch) => set((s) => ({ billets: s.billets.map((b) => (b.id === id ? { ...b, ...patch } : b)) })),
      deleteBillet: (id) => set((s) => removeBillet(s.billets, s.assignments, id)),

      saveGrant: (g) => set((s) => ({ grants: s.grants.some((x) => x.id === g.id) ? s.grants.map((x) => (x.id === g.id ? g : x)) : [...s.grants, g] })),
      deleteGrant: (id) => set((s) => ({ grants: s.grants.filter((g) => g.id !== id) })),

      resetDemo: () => set({ ...seedData(), toast: null }),
    }),
    {
      name: 'personnel-billets-demo',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: ({ sections, people, commanders, billets, assignments, grants }) => ({ sections, people, commanders, billets, assignments, grants }),
    },
  ),
);

/** Helper used by validation: who currently sits on a billet. */
export const occupantOf = (s: Pick<Data, 'assignments'>) => (billetId: number): number | null => openAssignment(s.assignments, billetId)?.personId ?? null;
