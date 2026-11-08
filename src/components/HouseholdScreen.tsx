import { useState } from "react";
import { supabase, type Household } from "../lib/supabase";

export function HouseholdScreen({ displayName, onReady, onSignOut }: { displayName: string; onReady: (h: Household) => void; onSignOut: () => void }) {
  const [join, setJoin] = useState(false);
  const [name, setName] = useState("הבית שלנו");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setErr("");
    setBusy(true);
    const { data, error } = join
      ? await supabase!.rpc("join_household", { p_code: code, p_display_name: displayName })
      : await supabase!.rpc("create_household", { p_name: name, p_display_name: displayName });
    setBusy(false);
    if (error) return setErr(error.message.includes("invite code") ? "הקוד לא נמצא. בדקו שהוקלד נכון." : error.message);
    onReady(data as Household);
  };

  return (
    <div className="center">
      <div className="card">
        <h1>שלום {displayName}</h1>
        <p className="muted" style={{ margin: 0 }}>כדי לשתף את הארנק, אחד מכם יוצר בית והשני מצטרף אליו עם קוד.</p>
        <div className="seg" role="group">
          <button aria-pressed={!join} onClick={() => setJoin(false)}>בית חדש</button>
          <button aria-pressed={join} onClick={() => setJoin(true)}>הצטרפות לבית קיים</button>
        </div>
        {join ? (
          <label className="field">קוד הזמנה<input dir="ltr" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="A1B2C3" maxLength={6} /></label>
        ) : (
          <label className="field">שם הבית<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        )}
        {err && <div className="error" role="alert">{err}</div>}
        <button className="btn primary" disabled={busy || (join && code.length < 6)} onClick={go}>{join ? "הצטרפות" : "יצירת בית"}</button>
        <button className="link" onClick={onSignOut}>התנתקות</button>
      </div>
    </div>
  );
}
