import { addDays, todayISO } from "./dates";
import { newId } from "./items";
import type { Store } from "./store";
import type { Item } from "./types";

const KEY = "kartisiya.demo.items";
const DB = "kartisiya-files";

function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("files");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbDo<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction("files", mode).objectStore("files"));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function read(): Item[] | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Item[]) : null;
  } catch {
    return null;
  }
}

function write(items: Item[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
}

/** Example items so the demo isn't empty. Dates are relative to today. */
export function sampleItems(today = todayISO()): Item[] {
  const now = new Date().toISOString();
  const base = { notes: "", usages: [], usedUp: false, createdBy: "אני", createdAt: now, updatedAt: now, time: null, value: null, remaining: null };
  const d = (n: number) => addDays(today, n);
  return [
    { ...base, id: newId(), type: "coupon", title: "כרטיס מתנה לסופר", place: "רשת סופרמרקטים", date: d(1), value: 500, remaining: 180,
      attachments: [{ id: newId(), kind: "code", code: "6290 1844 7720 3361" }],
      usages: [{ id: newId(), amount: 200, at: now, by: "אני" }, { id: newId(), amount: 120, at: now, by: "אני" }] },
    { ...base, id: newId(), type: "ticket", title: "הופעה בפארק", place: "תל אביב · גוש C, 2 מושבים", date: d(6), time: "20:30",
      attachments: [{ id: newId(), kind: "code", code: "ORD-558120" }] },
    { ...base, id: newId(), type: "coupon", title: "שובר ארוחה זוגית", place: "ביסטרו", date: d(28), value: 250, remaining: 250,
      attachments: [{ id: newId(), kind: "code", code: "DZG-2026-0419" }] },
    { ...base, id: newId(), type: "coupon", title: "20% הנחה על ביגוד", place: "חנות אופנה", date: d(86), attachments: [{ id: newId(), kind: "code", code: "WINTER20" }] },
    { ...base, id: newId(), type: "ticket", title: "קולנוע, 2 כרטיסים", place: "ראשון לציון", date: d(-19), time: "19:15", attachments: [] },
  ] as Item[];
}

export function createDemoStore(): Store & { reset(): Promise<void> } {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());
  window.addEventListener("storage", (e) => { if (e.key === KEY) notify(); });

  return {
    mode: "demo",
    async list() {
      let items = read();
      if (!items) { items = sampleItems(); write(items); }
      return items;
    },
    async save(item, files, prev) {
      for (const att of item.attachments) {
        const f = files?.get(att.id);
        if (f) { att.path = att.id; await idbDo("readwrite", (s) => s.put(f, att.id)); }
      }
      for (const old of prev?.attachments ?? []) {
        if (old.path && !item.attachments.some((a) => a.path === old.path)) await idbDo("readwrite", (s) => s.delete(old.path!));
      }
      const saved = { ...item, updatedAt: new Date().toISOString() };
      const items = (read() ?? []).filter((i) => i.id !== item.id);
      write([...items, saved]);
      return saved;
    },
    async remove(item) {
      for (const a of item.attachments) if (a.path) await idbDo("readwrite", (s) => s.delete(a.path!));
      write((read() ?? []).filter((i) => i.id !== item.id));
    },
    async fileUrl(path) {
      const blob = await idbDo<Blob | undefined>("readonly", (s) => s.get(path));
      if (!blob) throw new Error("הקובץ לא נמצא במכשיר");
      return URL.createObjectURL(blob);
    },
    onChange(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    async reset() { write(sampleItems()); notify(); },
  };
}
