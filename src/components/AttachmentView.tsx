import { useEffect, useState } from "react";
import type { Store } from "../lib/store";
import type { Attachment } from "../lib/types";

async function copy(text: string, toast: (m: string) => void) {
  try {
    await navigator.clipboard.writeText(text);
    toast("הקוד הועתק");
  } catch {
    toast("לא הצלחתי להעתיק. לחיצה ארוכה על הקוד תסמן אותו.");
  }
}

export function AttachmentView({ att, store, toast }: { att: Attachment; store: Store; toast: (m: string) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (att.kind !== "photo" || !att.path) return;
    let alive = true;
    store.fileUrl(att.path).then((u) => alive && setUrl(u), () => alive && setFailed(true));
    return () => { alive = false; };
  }, [att, store]);

  if (att.kind === "code")
    return (
      <div className="codebox">
        <span>{att.code}</span>
        <button className="mini" onClick={() => copy(att.code ?? "", toast)}>העתקה</button>
      </div>
    );

  const open = async () => {
    if (!att.path) return;
    // Open the window synchronously so phones don't block it as a pop-up, then point it at the file.
    const w = window.open("", "_blank");
    try {
      const u = await store.fileUrl(att.path);
      if (w) w.location.href = u; else window.location.href = u;
    } catch {
      w?.close();
      toast("לא הצלחתי לפתוח את הקובץ");
    }
  };

  if (att.kind === "photo")
    return (
      <figure className="photo">
        {url ? <img src={url} alt={att.name ?? "תמונה"} onClick={open} /> : <div className="muted" style={{ padding: 16 }}>{failed ? "לא הצלחתי לטעון את התמונה" : "טוען תמונה…"}</div>}
        <figcaption><span className="ltr">{att.name}</span><button className="mini" onClick={open}>הגדלה</button></figcaption>
      </figure>
    );

  return (
    <div className="filerow">
      <span className="badge pdf">PDF</span>
      <span className="fn"><b className="ltr">{att.name ?? "קובץ.pdf"}</b><small>קובץ PDF</small></span>
      <button className="mini" onClick={open}>פתיחה</button>
    </div>
  );
}
