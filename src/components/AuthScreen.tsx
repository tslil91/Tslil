import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";

const MESSAGES: Record<string, string> = {
  "Invalid login credentials": "האימייל או הסיסמה לא נכונים",
  "User already registered": "כבר יש חשבון עם האימייל הזה. נסו להתחבר.",
  "Password should be at least 6 characters.": "הסיסמה צריכה להיות באורך 6 תווים לפחות",
  "Email not confirmed": "צריך לאשר את האימייל דרך הקישור שנשלח אליכם",
};

export function AuthScreen() {
  const [signup, setSignup] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr(""); setInfo("");
    if (signup && !name.trim()) return setErr("איך לקרוא לך? השם יופיע ליד שימושים בשוברים");
    setBusy(true);
    const res = signup
      ? await supabase!.auth.signUp({ email, password, options: { data: { display_name: name.trim() } } })
      : await supabase!.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (res.error) return setErr(MESSAGES[res.error.message] ?? res.error.message);
    if (signup && !res.data.session) setInfo("שלחנו אליך אימייל לאישור. אחרי האישור חוזרים לכאן ומתחברים.");
  };

  return (
    <div className="center">
      <form className="card" onSubmit={submit}>
        <img className="logo" src="/icon-192.png" alt="" />
        <h1>כרטיסייה</h1>
        <p className="muted" style={{ margin: 0 }}>הכרטיסים והשוברים של הבית, עם תזכורות לשניכם.</p>
        {signup && <label className="field">השם שלך<input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" /></label>}
        <label className="field">אימייל<input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
        <label className="field">סיסמה<input type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={signup ? "new-password" : "current-password"} minLength={6} required /></label>
        {err && <div className="error" role="alert">{err}</div>}
        {info && <div className="pill ok" style={{ whiteSpace: "normal", padding: "8px 12px", borderRadius: 10 }}>{info}</div>}
        <button className="btn primary" disabled={busy}>{busy ? "רגע…" : signup ? "הרשמה" : "כניסה"}</button>
        <button type="button" className="link" onClick={() => { setSignup(!signup); setErr(""); }}>
          {signup ? "כבר יש לי חשבון" : "אין לי חשבון עדיין, להרשמה"}
        </button>
      </form>
    </div>
  );
}
