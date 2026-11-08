import { useEffect, useState } from "react";
import { disablePush, enablePush, isIOS, pushState, type PushState } from "../lib/push";
import type { Household } from "../lib/supabase";
import { Sheet } from "./Sheet";

interface Props {
  mode: "demo" | "cloud";
  household?: Household;
  members: string[];
  onClose: () => void;
  onSignOut?: () => void;
  onResetDemo?: () => void;
  toast: (m: string) => void;
}

const PUSH_TEXT: Record<PushState, string> = {
  on: "התזכורות פעילות בטלפון הזה.",
  off: "התזכורות כבויות בטלפון הזה.",
  denied: "ההתראות חסומות. אפשר לאשר אותן בהגדרות הטלפון, תחת האפליקציה או הדפדפן.",
  "needs-install": "באייפון, תזכורות עובדות רק מהאפליקציה שעל מסך הבית: בספארי לוחצים על כפתור השיתוף ואז \"הוסף למסך הבית\", ופותחים משם.",
  unsupported: "הדפדפן הזה לא תומך בהתראות. נסו בכרום באנדרואיד או מהאפליקציה שעל מסך הבית באייפון.",
  "not-configured": "התזכורות עוד לא הוגדרו בשרת (ראו את מדריך ההתקנה).",
};

export function AccountSheet({ mode, household, members, onClose, onSignOut, onResetDemo, toast }: Props) {
  const [push, setPush] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void pushState().then(setPush); }, []);

  const togglePush = async () => {
    if (!household) return;
    setBusy(true);
    try {
      if (push === "on") { await disablePush(); toast("התזכורות כובו בטלפון הזה"); }
      else { await enablePush(household.id); toast("התזכורות הופעלו"); }
      setPush(await pushState());
    } catch (e) {
      toast(e instanceof Error ? e.message : "לא הצלחתי לעדכן את ההתראות");
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(household!.invite_code); toast("הקוד הועתק"); } catch { toast("סמנו את הקוד והעתיקו ידנית"); }
  };

  return (
    <Sheet label="הבית שלנו" onClose={onClose}>
      <h2>{household?.name ?? "מצב הדגמה"}</h2>
      {mode === "demo" ? (
        <>
          <p className="muted" style={{ margin: 0 }}>
            האפליקציה עוד לא מחוברת לשרת, אז הנתונים נשמרים רק בטלפון הזה ולא מסתנכרנים. אחרי חיבור ל־Supabase (לפי מדריך ההתקנה) תתבקשו להתחבר וליצור בית משותף.
          </p>
          <button className="btn ghost" onClick={onResetDemo}>איפוס נתוני הדוגמה</button>
        </>
      ) : (
        <>
          <div>
            <div className="section-title">מי בבית</div>
            <div>{members.join(" · ")}</div>
          </div>
          <div>
            <div className="section-title">קוד הזמנה לבית</div>
            <div className="code-big">{household?.invite_code}</div>
            <p className="muted" style={{ margin: "6px 0" }}>שלחו את הקוד לבן או לבת הזוג. אחרי הרשמה בוחרים "הצטרפות לבית קיים" ומזינים אותו.</p>
            <button className="btn ghost" style={{ width: "100%" }} onClick={copyCode}>העתקת הקוד</button>
          </div>
          <div>
            <div className="section-title">תזכורות בטלפון הזה</div>
            <p className="muted" style={{ margin: "0 0 8px" }}>{push ? PUSH_TEXT[push] : "בודק…"}</p>
            {(push === "on" || push === "off") && (
              <button className={`btn ${push === "on" ? "ghost" : "primary"}`} style={{ width: "100%" }} disabled={busy} onClick={togglePush}>
                {push === "on" ? "כיבוי תזכורות" : "הפעלת תזכורות"}
              </button>
            )}
            {isIOS() && push === "off" && <p className="muted" style={{ margin: "6px 0 0" }}>נדרש iOS 16.4 ומעלה.</p>}
          </div>
          <button className="btn danger-ghost" onClick={onSignOut}>התנתקות</button>
        </>
      )}
      <button className="btn ghost" onClick={onClose}>סגירה</button>
    </Sheet>
  );
}
