import type { AppData } from './types';

/** The slices that are shared between users and saved on the server. */
export const DATA_KEYS = ['sections', 'people', 'commanders', 'billets', 'assignments', 'grants', 'notes', 'sectionHistory'] as const;

export const pickData = (s: AppData): AppData => ({
  sections: s.sections, people: s.people, commanders: s.commanders, billets: s.billets,
  assignments: s.assignments, grants: s.grants, notes: s.notes, sectionHistory: s.sectionHistory,
});

export const dataChanged = (a: AppData, b: AppData): boolean => DATA_KEYS.some((k) => a[k] !== b[k]);

export const emptyData = (): AppData => ({
  sections: [], people: [], commanders: { org: null, sections: {} }, billets: [], assignments: [], grants: [], notes: [], sectionHistory: [],
});
