import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { installChangeTracking } from './changes';
import { emptyData } from '../domain/data';
import { emptyDraft } from '../views/people/PersonCells';
import { useStore } from './store';

beforeAll(() => installChangeTracking());
beforeEach(() => { useStore.getState().resetDemo(); useStore.setState({ audit: [], actor: 'בודק' }); });

const log = () => useStore.getState().audit;

describe('store + change tracking', () => {
  it('moving a person logs it, keeps dated history and ends the old command', () => {
    useStore.getState().placePerson(2, 'sec:s2'); // יוסי כהן was the commander of מדור מבצעים
    const s = useStore.getState();
    expect(s.people.find((p) => p.id === 2)?.sectionId).toBe('s2');
    expect(s.commanders.sections.s1).toBeNull();
    expect(s.sectionHistory.filter((h) => h.personId === 2).map((h) => h.sectionId)).toEqual(['s1', 's2']);
    const kinds = log().map((e) => e.kind);
    expect(kinds).toContain('person');
    expect(kinds).toContain('commander');
    expect(log().every((e) => e.actor === 'בודק')).toBe(true);
  });
  it('log entries have increasing ids and a timestamp', () => {
    useStore.getState().addSection('מדור חדש');
    useStore.getState().addSection('מדור נוסף');
    expect(log().map((e) => e.id)).toEqual([1, 2]);
    expect(Number.isNaN(Date.parse(log()[0].at))).toBe(false);
  });
  it('billet change through a person edit is logged for that person', () => {
    const p = useStore.getState().people.find((x) => x.id === 4)!; // סרן אורי לוי, על תקני
    useStore.getState().savePerson({ ...p, mid: String(p.mid), billet: 1006 });
    expect(log().some((e) => e.personId === 4 && e.summary.includes('שובץ/ה בתקן 1006'))).toBe(true);
  });
  it('notes: add, log, delete; empty text ignored', () => {
    useStore.getState().addNote(3, '   ');
    expect(useStore.getState().notes).toHaveLength(0);
    useStore.getState().addNote(3, 'שיחת משוב');
    expect(useStore.getState().notes[0]).toMatchObject({ personId: 3, text: 'שיחת משוב', author: 'בודק' });
    useStore.getState().deleteNote(useStore.getState().notes[0].id);
    expect(log().map((e) => e.summary)).toEqual(['נוספה הערה למיכל ביטון', 'נמחקה הערה של מיכל ביטון']);
  });
  it('replaceData logs one summary line instead of a diff', () => {
    useStore.getState().replaceData(emptyData(), 'שוחזרו נתונים מגיבוי');
    expect(useStore.getState().people).toHaveLength(0);
    expect(log()).toHaveLength(1);
    expect(log()[0]).toMatchObject({ kind: 'system', summary: 'שוחזרו נתונים מגיבוי' });
  });
  it('adding a person works end to end', () => {
    const d = { ...emptyDraft('s1'), name: 'חדש בדיקה', mid: '7777777' };
    useStore.getState().savePerson(d);
    expect(useStore.getState().people.some((p) => p.mid === 7777777)).toBe(true);
    expect(log()[0].summary).toContain('נוסף/ה: חדש בדיקה');
  });
});
