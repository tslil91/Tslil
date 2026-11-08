// Offline helper (one HTML file): take a backup file, remove chosen people, save a cleaned backup.
// For use with a version of the app that cannot remove people yet; restore the result through "ניהול נתונים".
import { backupFileName, makeBackup, parseBackup } from '../logic/backup';
import { deletePerson, removalBlocker, removalImpact } from '../logic/removal';
import type { AppData, Person } from '../domain/types';

const root = document.getElementById('app') as HTMLElement;
let original: AppData | null = null;
let fileName = '';
const selected = new Set<number>();
let filter = '';
let message: { kind: 'error' | 'ok'; text: string } | null = null;
let confirmed = false;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> & { class?: string } = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  const { class: cls, ...rest } = props as { class?: string };
  if (cls) n.className = cls;
  Object.assign(n, rest);
  for (const c of children) n.append(c);
  return n;
}

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

async function load(file: File) {
  const r = parseBackup(await file.text());
  selected.clear(); confirmed = false;
  if (!r.ok || !r.data) { original = null; message = { kind: 'error', text: `קובץ הגיבוי אינו תקין: ${r.errors.slice(0, 4).join(' · ')}` }; }
  else { original = r.data; fileName = file.name; message = null; }
  render();
}

function secName(d: AppData, p: Person) { return p.sectionId ? d.sections.find((s) => s.id === p.sectionId)?.name ?? '' : 'כפוף ישירות לרע"ן'; }

function selectByMids(text: string) {
  if (!original) return;
  const mids = new Set(text.split(/[\s,;]+/).filter(Boolean).map(Number).filter((n) => Number.isFinite(n)));
  const found = original.people.filter((p) => mids.has(p.mid));
  let blocked = 0;
  for (const p of found) { if (removalBlocker(original, p.id)) blocked++; else selected.add(p.id); }
  const missing = [...mids].filter((m) => !original!.people.some((p) => p.mid === m));
  message = { kind: found.length ? 'ok' : 'error', text: `סומנו ${found.length - blocked} אנשים${blocked ? ` (${blocked} מפקדים לא סומנו)` : ''}${missing.length ? ` · לא נמצאו מ.א: ${missing.join(', ')}` : ''}` };
  confirmed = false;
  render();
}

function build() {
  if (!original) return;
  let cur = original;
  const skipped: string[] = [];
  for (const id of selected) {
    const r = deletePerson(cur, id);
    if (r.ok) cur = r.data; else skipped.push(r.error);
  }
  const check = parseBackup(JSON.stringify(makeBackup(cur)));
  if (!check.ok) { message = { kind: 'error', text: `שגיאה פנימית, הקובץ לא נוצר: ${check.errors.slice(0, 3).join(' · ')}` }; render(); return; }
  const blob = new Blob([JSON.stringify(makeBackup(cur), null, 1)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = backupFileName(today()).replace('personnel-backup-', 'personnel-backup-cleaned-');
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  message = { kind: 'ok', text: `נוצר קובץ מתוקן: ${original.people.length - cur.people.length} אנשים הוסרו (נשארו ${cur.people.length}). עכשיו באפליקציה: ניהול נתונים ← בחירת קובץ גיבוי ← שחזור. הקובץ המקורי לא שונה — שמרו אותו.${skipped.length ? ` · דולגו: ${skipped.join(' | ')}` : ''}` };
  render();
}

function render() {
  root.replaceChildren();
  root.append(el('h1', {}, 'הסרת אנשים מקובץ גיבוי'));
  root.append(el('p', { class: 'muted' }, 'כלי עזר ללא התקנה ובלי חיבור לרשת. הקובץ המקורי אינו משתנה; נוצר קובץ גיבוי חדש שמשחזרים באפליקציה ("ניהול נתונים"). הכלי מוחק לצמיתות את האדם ואת כל מה ששייך אליו (מענקים, הערות, היסטוריית תקנים ומדורים).'));

  const file = el('input', { type: 'file', accept: '.json,application/json', id: 'f' });
  file.addEventListener('change', () => { const f = file.files?.[0]; if (f) void load(f); });
  root.append(el('section', {}, el('h2', {}, '1. בחירת קובץ הגיבוי'), el('label', { class: 'btn', htmlFor: 'f' }, 'בחירת קובץ גיבוי'), file, original ? el('span', { class: 'muted' }, ` ${fileName} · ${original.people.length} אנשים`) : ''));

  if (message) root.append(el('p', { class: message.kind === 'error' ? 'err' : 'ok', role: message.kind === 'error' ? 'alert' : 'status' }, message.text));
  if (!original) return;
  const d = original;

  const paste = el('textarea', { rows: 3, placeholder: 'אפשר להדביק כאן מספרי מ.א (אחד בכל שורה או מופרדים ברווח) ולסמן אותם בבת אחת', id: 'paste' });
  const search = el('input', { type: 'search', placeholder: 'חיפוש לפי שם או מ.א', value: filter, id: 'q' });
  search.addEventListener('input', () => { filter = search.value; renderList(); });
  root.append(el('section', {}, el('h2', {}, '2. בחירת האנשים להסרה'), search, paste, el('button', { class: 'btn', type: 'button', onclick: () => selectByMids(paste.value) }, 'סימון לפי מ.א')));

  const listHost = el('div', { id: 'list' });
  const summary = el('div', { id: 'summary' });
  root.append(listHost, summary);

  function renderList() {
    const q = filter.trim();
    const people = d.people.filter((p) => !q || p.name.includes(q) || String(p.mid).includes(q)).sort((a, b) => a.name.localeCompare(b.name, 'he'));
    const table = el('table');
    table.append(el('thead', {}, el('tr', {}, el('th', {}, ''), el('th', {}, 'שם'), el('th', {}, 'מ.א'), el('th', {}, 'דרגה'), el('th', {}, 'מדור'), el('th', {}, 'הערה'))));
    const body = el('tbody');
    for (const p of people) {
      const blocker = removalBlocker(d, p.id);
      const cb = el('input', { type: 'checkbox', checked: selected.has(p.id), disabled: !!blocker });
      cb.setAttribute('aria-label', `סימון ${p.name}`);
      cb.addEventListener('change', () => { if (cb.checked) selected.add(p.id); else selected.delete(p.id); confirmed = false; renderSummary(); });
      body.append(el('tr', {}, el('td', {}, cb), el('td', {}, p.name), el('td', {}, String(p.mid)), el('td', {}, p.degree), el('td', {}, secName(d, p)), el('td', { class: 'muted' }, blocker ? 'מפקד — יש להחליף מפקד באפליקציה לפני הסרה' : '')));
    }
    table.append(body);
    listHost.replaceChildren(el('div', { class: 'scroll' }, table));
    if (people.length === 0) listHost.append(el('p', { class: 'muted' }, 'לא נמצאו אנשים.'));
  }

  function renderSummary() {
    const ids = [...selected];
    let notes = 0, grants = 0, assignments = 0, billets = 0;
    for (const id of ids) { const i = removalImpact(d, id); notes += i.notes; grants += i.grants; assignments += i.assignments; if (i.openBillet !== null) billets++; }
    const cb = el('input', { type: 'checkbox', id: 'sure', checked: confirmed });
    cb.addEventListener('change', () => { confirmed = cb.checked; btn.disabled = ids.length === 0 || !confirmed; });
    const btn = el('button', { class: 'btn danger', type: 'button', disabled: ids.length === 0 || !confirmed, onclick: build }, 'יצירת קובץ גיבוי מתוקן');
    summary.replaceChildren(el('h2', {}, '3. יצירת הקובץ'),
      el('p', {}, ids.length === 0 ? 'לא נבחרו אנשים.' : `נבחרו ${ids.length} אנשים. יימחקו גם: ${grants} מענקים, ${notes} הערות, ${assignments} שיבוצים בתקנים (${billets} תקנים יתפנו).`),
      el('label', { class: 'row', htmlFor: 'sure' }, cb, ' אני מבין/ה שההסרה סופית בקובץ החדש (המקורי נשאר ללא שינוי)'), btn);
  }
  renderList();
  renderSummary();
}

render();
