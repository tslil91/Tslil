import { useState } from "react";
import { daysUntil, formatDate, formatShortDate, historyReason, reminderPlan } from "../lib/dates";
import { applyUsage, formatILS, markFullyUsed, removeUsage, restore } from "../lib/items";
import type { Store } from "../lib/store";
import type { Item } from "../lib/types";
import { AttachmentView } from "./AttachmentView";
import { Sheet } from "./Sheet";

interface Props {
  item: Item;
  today: string;
  me: string;
  store: Store;
  onClose: () => void;
  onEdit: () => void;
  /** Persist a changed item; resolves when saved. */
  onSave: (next: Item, message: string) => Promise<void>;
  onDelete: () => Promise<void>;
  toast: (m: string) => void;
}

export function ItemSheet({ item, today, me, store, onClose, onEdit, onSave, onDelete, toast }: Props) {
  const [amount, setAmount] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const reason = historyReason(item, today);
  const isCoupon = item.type === "coupon";
  const hasValue = item.value != null && item.remaining != null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr("");
    try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : "משהו השתבש, נסו שוב"); } finally { setBusy(false); }
  };

  const usePartial = () => run(async () => {
    const a = Number(amount.replace(",", "."));
    if (!(a > 0)) throw new Error("מזינים קודם את הסכום שנוצל");
    const next = applyUsage(item, a, me);
    await onSave(next, next.usedUp ? "השובר נוצל במלואו ועבר להיסטוריה" : `נשמר. נשארו ${formatILS(next.remaining!)}`);
    setAmount("");
  });

  return (
    <Sheet label={item.title} onClose={onClose}>
      <span className="eyebrow">{item.type === "ticket" ? "כרטיס" : "שובר"}{item.place && ` · ${item.place}`}</span>
      <h2>{item.title}</h2>
      {item.type === "ticket" ? (
        <dl className="kv">
          <dt>מתי</dt><dd>{formatDate(item.date, today)}{item.time && `, ${item.time}`}</dd>
          {item.place && <><dt>איפה</dt><dd>{item.place}</dd></>}
        </dl>
      ) : (
        <span className="muted">בתוקף עד {formatDate(item.date, today)}{!reason && daysUntil(item.date, today) <= 7 && " · ממש בקרוב"}</span>
      )}

      {item.attachments.map((a) => <AttachmentView key={a.id} att={a} store={store} toast={toast} />)}
      {item.attachments.length === 0 && <span className="muted">אין קובץ או קוד מצורף. אפשר להוסיף בעריכה.</span>}
      {item.notes && <div className="notes">{item.notes}</div>}

      {isCoupon && hasValue && (
        <>
          <div className="big"><b>{formatILS(item.remaining!)}</b><span>נשארו מתוך {formatILS(item.value!)}</span></div>
          {item.value! > 0 && <div className="bar"><i style={{ width: `${Math.round((item.remaining! / item.value!) * 100)}%` }} /></div>}
        </>
      )}
      {isCoupon && item.usages.length > 0 && (
        <div>
          <div className="section-title">שימושים</div>
          <ul className="usages">
            {item.usages.map((u) => (
              <li key={u.id}>
                <time>{new Date(u.at).toLocaleDateString("he-IL", { day: "numeric", month: "short" })}</time>
                <span>נוצלו {formatILS(u.amount)} · {u.by}</span>
                <button className="mini" disabled={busy} onClick={() => run(() => onSave(removeUsage(item, u.id), "השימוש בוטל והיתרה עודכנה"))}>ביטול</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isCoupon && !reason && (
        hasValue ? (
          <>
            <label className="field">סכום שנוצל עכשיו (₪)
              <input type="number" inputMode="decimal" min="0" step="any" placeholder="למשל 80" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </label>
            <div className="row">
              <button className="btn soft" disabled={busy} onClick={usePartial}>ניצול חלקי</button>
              <button className="btn primary" disabled={busy} onClick={() => run(() => onSave(markFullyUsed(item, me), "השובר עבר להיסטוריה"))}>נוצל במלואו</button>
            </div>
          </>
        ) : (
          <button className="btn primary" disabled={busy} onClick={() => run(() => onSave(markFullyUsed(item, me), "השובר עבר להיסטוריה"))}>סימון כמנוצל</button>
        )
      )}
      {reason === "used" && (
        <button className="btn ghost" disabled={busy} onClick={() => run(() => onSave(restore(item), "הוחזר לארנק"))}>החזרה לארנק (סומן בטעות)</button>
      )}

      {!reason && (
        <div>
          <div className="section-title">תזכורות לשני הטלפונים</div>
          <div className="remind">
            {reminderPlan(item, today).map((r) => (
              <span key={r.offset} className={`pill${r.done ? "" : " ok"}`}>{r.label} · {formatShortDate(r.sendDate)}{r.done ? " ✓" : ""}</span>
            ))}
          </div>
        </div>
      )}

      {err && <div className="error" role="alert">{err}</div>}

      {confirmDelete ? (
        <div className="confirm" role="alertdialog" aria-label="אישור מחיקה">
          <b>למחוק את "{item.title}"?</b>
          <span className="muted">הפריט והקבצים שלו יימחקו משני הטלפונים. אי אפשר לבטל את זה.</span>
          <div className="row">
            <button className="btn ghost" onClick={() => setConfirmDelete(false)}>ביטול</button>
            <button className="btn danger" disabled={busy} onClick={() => run(onDelete)}>מחיקה</button>
          </div>
        </div>
      ) : (
        <div className="row">
          <button className="btn ghost" onClick={onEdit}>עריכה</button>
          <button className="btn danger-ghost" onClick={() => setConfirmDelete(true)}>מחיקה</button>
        </div>
      )}
      <button className="btn ghost" onClick={onClose}>סגירה</button>
    </Sheet>
  );
}
