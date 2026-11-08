import { useRef, useState } from "react";
import { REMINDER_OFFSETS, offsetLabel } from "../lib/dates";
import { shrinkImage } from "../lib/image";
import { newId, withValue } from "../lib/items";
import type { Attachment, Item, ItemType } from "../lib/types";
import { Sheet } from "./Sheet";

const MAX_FILE = 15 * 1024 * 1024;

interface Props {
  initial: Item;
  isNew: boolean;
  onClose: () => void;
  onSubmit: (item: Item, files: Map<string, Blob>) => Promise<void>;
}

export function ItemForm({ initial, isNew, onClose, onSubmit }: Props) {
  const [type, setType] = useState<ItemType>(initial.type);
  const [title, setTitle] = useState(initial.title);
  const [place, setPlace] = useState(initial.place);
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time ?? "20:00");
  const [value, setValue] = useState(initial.value == null ? "" : String(initial.value));
  const [notes, setNotes] = useState(initial.notes);
  const [atts, setAtts] = useState<Attachment[]>(initial.attachments);
  const files = useRef(new Map<string, Blob>());
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const isTicket = type === "ticket";

  const addFile = async (kind: "pdf" | "photo", file: File | undefined) => {
    if (!file) return;
    setErr("");
    if (kind === "pdf" && file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) return setErr("הקובץ שנבחר אינו PDF");
    const blob = kind === "photo" ? await shrinkImage(file) : file;
    if (blob.size > MAX_FILE) return setErr("הקובץ גדול מדי (עד 15MB)");
    const id = newId();
    files.current.set(id, blob);
    const name = kind === "photo" && blob !== file ? file.name.replace(/\.\w+$/, "") + ".jpg" : file.name;
    setAtts((a) => [...a, { id, kind, name, mime: blob.type || (kind === "pdf" ? "application/pdf" : "image/jpeg") }]);
  };

  const addCode = () => {
    const c = code.trim();
    if (!c) return;
    setAtts((a) => [...a, { id: newId(), kind: "code", code: c }]);
    setCode("");
    setCodeOpen(false);
  };

  const removeAtt = (id: string) => {
    files.current.delete(id);
    setAtts((a) => a.filter((x) => x.id !== id));
  };

  const submit = async () => {
    setErr("");
    if (!title.trim()) return setErr("צריך לתת שם לפריט");
    if (!date) return setErr(isTicket ? "חסר תאריך האירוע" : "חסר תאריך תפוגה");
    const v = value.trim() === "" ? null : Number(value.replace(",", "."));
    if (!isTicket && v != null && !(v >= 0)) return setErr("השווי צריך להיות מספר");
    const pendingCode = code.trim();
    const allAtts = pendingCode ? [...atts, { id: newId(), kind: "code" as const, code: pendingCode }] : atts;

    let next: Item = { ...initial, type, title: title.trim(), place: place.trim(), date, notes: notes.trim(), attachments: allAtts, time: isTicket ? time || null : null };
    if (isTicket) next = { ...next, value: null, remaining: null, usages: [] };
    else if (initial.type === "ticket" || isNew) next = { ...next, value: v, remaining: v, usages: [], usedUp: false };
    else if (v !== initial.value) next = withValue(next, v);

    setBusy(true);
    try {
      await onSubmit(next, files.current);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "השמירה נכשלה, נסו שוב");
      setBusy(false);
    }
  };

  return (
    <Sheet label={isNew ? "הוספה לארנק" : "עריכה"} onClose={onClose}>
      <h2>{isNew ? "הוספה לארנק" : "עריכה"}</h2>
      <div className="seg" role="group" aria-label="סוג">
        <button aria-pressed={isTicket} onClick={() => setType("ticket")}>כרטיס</button>
        <button aria-pressed={!isTicket} onClick={() => setType("coupon")}>שובר</button>
      </div>
      <label className="field">שם
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={isTicket ? "למשל הצגה, 2 כרטיסים" : "למשל כרטיס מתנה לסופר"} autoFocus={isNew} />
      </label>
      <label className="field">{isTicket ? "מקום ומושבים" : "חנות או רשת"}
        <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder={isTicket ? "למשל היכל התרבות, שורה 12" : "למשל שופרסל"} />
      </label>
      <div className="row">
        <label className="field">{isTicket ? "תאריך האירוע" : "בתוקף עד"}
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        {isTicket ? (
          <label className="field">שעה<input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        ) : (
          <label className="field">שווי (₪)<input type="number" inputMode="decimal" min="0" step="any" value={value} onChange={(e) => setValue(e.target.value)} placeholder="ריק = הנחה / מוצר" /></label>
        )}
      </div>
      {!isTicket && !isNew && initial.usages.length > 0 && value !== String(initial.value ?? "") && (
        <span className="muted">היתרה תחושב מחדש לפי השימושים שכבר נרשמו.</span>
      )}

      <div>
        <div className="section-title">הכרטיס או השובר עצמו: PDF, תמונה או קוד (אפשר כמה)</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {atts.map((a) => (
            <div className="filerow" key={a.id}>
              <span className={`badge ${a.kind}`}>{a.kind === "pdf" ? "PDF" : a.kind === "photo" ? "IMG" : "#"}</span>
              <span className="fn"><b className="ltr">{a.kind === "code" ? a.code : a.name}</b><small>{a.kind === "pdf" ? "קובץ PDF" : a.kind === "photo" ? "תמונה" : "קוד"}</small></span>
              <button className="mini danger" onClick={() => removeAtt(a.id)} aria-label="הסרה">הסרה</button>
            </div>
          ))}
          <div className="addrow">
            <label>+ PDF<input type="file" accept="application/pdf,.pdf" onChange={(e) => { void addFile("pdf", e.target.files?.[0]); e.target.value = ""; }} /></label>
            <label>+ תמונה<input type="file" accept="image/*" onChange={(e) => { void addFile("photo", e.target.files?.[0]); e.target.value = ""; }} /></label>
            <button onClick={() => setCodeOpen(true)}>+ קוד</button>
          </div>
          {codeOpen && (
            <div className="row">
              <input dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCode()} placeholder="ABC-1234" autoFocus aria-label="קוד" />
              <button className="btn soft" style={{ flex: "none" }} onClick={addCode}>הוספה</button>
            </div>
          )}
        </div>
      </div>

      <label className="field">הערות<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="למשל: לא תקף בשבת, צריך להזמין מקום" /></label>
      <span className="muted">תזכורות: {REMINDER_OFFSETS[type].map(offsetLabel).join(", ")}, בשני הטלפונים.</span>
      {err && <div className="error" role="alert">{err}</div>}
      <div className="row">
        <button className="btn ghost" onClick={onClose}>ביטול</button>
        <button className="btn primary" disabled={busy} onClick={submit}>{busy ? "שומר…" : "שמירה"}</button>
      </div>
    </Sheet>
  );
}
