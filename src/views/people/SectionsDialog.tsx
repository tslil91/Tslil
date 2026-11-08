import { useState } from 'react';
import { ConfirmDialog, Dialog } from '../../components/Dialog';
import { IconCheck, IconEdit, IconPlus, IconTrash, IconX } from '../../components/Icons';
import type { Section } from '../../domain/types';
import { validateSectionName } from '../../logic/sections';
import { useStore } from '../../store/store';

/** Floating window: add, rename and delete sections. */
export function SectionsDialog({ onClose }: { onClose: () => void }) {
  const { sections, people, commanders, addSection, renameSection, deleteSection, showToast } = useStore();
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<{ where: string; message: string } | null>(null);
  const [removing, setRemoving] = useState<Section | null>(null);

  const count = (id: string) => people.filter((p) => p.sectionId === id && !p.leftAt).length;
  const commanderName = (id: string) => people.find((p) => p.id === commanders.sections[id])?.name ?? null;

  const saveRename = (s: Section) => {
    const err = validateSectionName(editName, sections, s.id);
    if (err) { setError({ where: s.id, message: err }); return; }
    if (editName.trim() !== s.name) { renameSection(s.id, editName); showToast(`שם המדור שונה ל"${editName.trim()}"`); }
    setEditId(null); setError(null);
  };
  const add = () => {
    const err = validateSectionName(newName, sections);
    if (err) { setError({ where: 'new', message: err }); return; }
    addSection(newName);
    showToast(`המדור "${newName.trim()}" נוסף`);
    setNewName(''); setError(null);
  };

  return (
    <>
      <Dialog title="ניהול מדורים" width={560} onClose={onClose}
        footer={<button type="button" className="btn btn-primary h-[38px] px-5" onClick={onClose}>סגירה</button>}>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {sections.map((s) => {
            const editing = editId === s.id;
            const n = count(s.id);
            return (
              <li key={s.id} className="flex flex-col gap-1">
                <div className="flex min-h-12 items-center gap-2 rounded border border-line bg-bg px-3">
                  {editing ? (
                    <input className="input input-lg flex-1" aria-label={`שם חדש למדור ${s.name}`} value={editName} autoFocus
                      onChange={(e) => { setEditName(e.target.value); setError(null); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveRename(s); if (e.key === 'Escape') { e.stopPropagation(); setEditId(null); setError(null); } }} />
                  ) : (
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-bold">{s.name}</span>
                      <span className="text-xs text-muted">{n} אנשים · מפקד: {commanderName(s.id) ?? 'לא מונה'}</span>
                    </span>
                  )}
                  {editing ? (
                    <>
                      <button type="button" className="icon-btn icon-btn-ok" title="שמירה" aria-label="שמירת השם" onClick={() => saveRename(s)}><IconCheck size={16} /></button>
                      <button type="button" className="icon-btn" title="ביטול" aria-label="ביטול" onClick={() => { setEditId(null); setError(null); }}><IconX size={14} /></button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="icon-btn" title="שינוי שם" aria-label={`שינוי שם של ${s.name}`} onClick={() => { setEditId(s.id); setEditName(s.name); setError(null); }}><IconEdit size={16} /></button>
                      <button type="button" className="icon-btn icon-btn-danger" title="מחיקת מדור" aria-label={`מחיקת ${s.name}`} onClick={() => setRemoving(s)}><IconTrash size={16} /></button>
                    </>
                  )}
                </div>
                {error?.where === s.id && <p role="alert" className="m-0 text-[13px] font-semibold text-danger">{error.message}</p>}
              </li>
            );
          })}
          {sections.length === 0 && <li className="py-3 text-sm text-muted">אין מדורים. כל האנשים כפופים ישירות לרע"ן.</li>}
        </ul>

        <form className="mt-3 flex flex-col gap-1" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <label htmlFor="new-section" className="label">מדור חדש</label>
          <div className="flex gap-2">
            <input id="new-section" className="input input-lg flex-1" placeholder="שם המדור" value={newName} onChange={(e) => { setNewName(e.target.value); setError(null); }} />
            <button type="submit" className="btn btn-primary h-[38px]"><IconPlus size={16} />הוספה</button>
          </div>
          {error?.where === 'new' && <p role="alert" className="m-0 text-[13px] font-semibold text-danger">{error.message}</p>}
        </form>
      </Dialog>

      {removing && (
        <ConfirmDialog
          title={`למחוק את ${removing.name}?`}
          message={count(removing.id) > 0
            ? `במדור ${count(removing.id)} אנשים. הם יועברו אל "כפופים ישירות לרע"ן"${commanderName(removing.id) ? ` ו־${commanderName(removing.id)} יפסיק/תפסיק לשמש מפקד המדור` : ''}. לא ניתן לבטל פעולה זו.`
            : 'המדור ריק ויימחק. לא ניתן לבטל פעולה זו.'}
          confirmLabel="כן, מחק"
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const moved = deleteSection(removing.id);
            showToast(`המדור "${removing.name}" נמחק${moved ? ` · ${moved} אנשים הועברו לכפופים ישירות` : ''}`);
            setRemoving(null);
          }}
        />
      )}
    </>
  );
}
