import { useCallback, useEffect, useMemo, useState } from "react";
import { daysUntil, isHistory, todayISO } from "../lib/dates";
import { blankItem } from "../lib/items";
import type { Store } from "../lib/store";
import type { Household } from "../lib/supabase";
import type { Item } from "../lib/types";
import { AccountSheet } from "./AccountSheet";
import { ItemCard } from "./ItemCard";
import { ItemForm } from "./ItemForm";
import { ItemSheet } from "./ItemSheet";

type Tab = "upcoming" | "ticket" | "coupon" | "history";
const TITLES: Record<Tab, string> = { upcoming: "בקרוב", ticket: "כרטיסים", coupon: "שוברים", history: "היסטוריה" };
const AVATAR_COLORS = ["#0F7F73", "#B57800", "#5B6BD6", "#C2352B"];

export interface WalletProps {
  store: Store;
  me: string;
  members: string[];
  household?: Household;
  onSignOut?: () => void;
  onResetDemo?: () => void;
}

export function Wallet({ store, me, members, household, onSignOut, onResetDemo }: WalletProps) {
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [tab, setTab] = useState<Tab>("upcoming");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(() => new URLSearchParams(location.search).get("item"));
  const [form, setForm] = useState<{ item: Item; isNew: boolean } | null>(null);
  const [account, setAccount] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [today, setToday] = useState(todayISO);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    window.setTimeout(() => setToastMsg((cur) => (cur === m ? "" : cur)), 2400);
  }, []);

  const reload = useCallback(async () => {
    try {
      setItems(await store.list());
      setLoadError("");
    } catch {
      setLoadError("לא הצלחתי לטעון את הנתונים. בדקו את החיבור לאינטרנט.");
    } finally {
      setLoaded(true);
    }
  }, [store]);

  useEffect(() => {
    void reload();
    const off = store.onChange(() => void reload());
    const onVisible = () => { if (document.visibilityState === "visible") { setToday(todayISO()); void reload(); } };
    document.addEventListener("visibilitychange", onVisible);
    return () => { off(); document.removeEventListener("visibilitychange", onVisible); };
  }, [store, reload]);

  // Clear ?item= from the address once it has been used (link from a reminder).
  useEffect(() => { if (location.search) history.replaceState(null, "", location.pathname); }, []);

  const active = useMemo(() => items.filter((i) => !isHistory(i, today)).sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "")), [items, today]);
  const past = useMemo(() => items.filter((i) => isHistory(i, today)).sort((a, b) => b.date.localeCompare(a.date)), [items, today]);

  const shown = useMemo(() => {
    if (tab === "history") {
      const q = query.trim().toLowerCase();
      return q ? past.filter((i) => `${i.title} ${i.place} ${i.notes}`.toLowerCase().includes(q)) : past;
    }
    return tab === "upcoming" ? active : active.filter((i) => i.type === tab);
  }, [tab, active, past, query]);

  const counts = { upcoming: active.length, ticket: active.filter((i) => i.type === "ticket").length, coupon: active.filter((i) => i.type === "coupon").length, history: past.length };
  const openItem = items.find((i) => i.id === openId) ?? null;

  const saveItem = async (next: Item, files?: Map<string, Blob>) => {
    const prev = items.find((i) => i.id === next.id);
    const saved = await store.save(next, files, prev);
    setItems((cur) => [...cur.filter((i) => i.id !== saved.id), saved]);
    return saved;
  };

  const renderGroup = (label: string, list: Item[]) =>
    list.length > 0 && (
      <>
        <div className="group">{label}</div>
        {list.map((i) => <ItemCard key={i.id} item={i} today={today} onOpen={() => setOpenId(i.id)} />)}
      </>
    );

  return (
    <div className="app">
      <header className="top">
        <div className="top-row">
          <h1>{TITLES[tab]}</h1>
          <div className="top-actions">
            <div className="avatars" title={members.join(", ")}>
              {members.slice(0, 4).map((m, i) => <span key={m + i} style={{ background: AVATAR_COLORS[i % 4] }}>{m.trim().charAt(0)}</span>)}
            </div>
            <button className="icon-btn" aria-label="הבית שלנו והגדרות תזכורות" onClick={() => setAccount(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
          </div>
        </div>
        <div className="tabs" role="tablist">
          {(Object.keys(TITLES) as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {TITLES[t]}{counts[t] > 0 && <span className="count">{counts[t]}</span>}
            </button>
          ))}
        </div>
        {tab === "history" && past.length > 0 && (
          <input className="search" type="search" placeholder="חיפוש בהיסטוריה" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="חיפוש בהיסטוריה" />
        )}
      </header>

      {store.mode === "demo" && (
        <div className="banner">מצב הדגמה: הנתונים נשמרים רק בטלפון הזה. <button className="link" onClick={() => setAccount(true)}>פרטים</button></div>
      )}

      <main className="list">
        {loadError && <div className="error" role="alert">{loadError}</div>}
        {loaded && shown.length === 0 && (
          <div className="empty">
            <b>{tab === "history" ? (query ? "לא נמצאו פריטים" : "ההיסטוריה ריקה") : "אין כאן כלום עדיין"}</b>
            <span>{tab === "history" ? "שוברים שנוצלו או פגו וכרטיסים שהאירוע שלהם עבר יופיעו כאן." : "לוחצים על + כדי להוסיף כרטיס או שובר."}</span>
          </div>
        )}
        {tab === "upcoming" ? (
          <>
            {renderGroup("השבוע", shown.filter((i) => daysUntil(i.date, today) <= 7))}
            {renderGroup("בחודש הקרוב", shown.filter((i) => { const n = daysUntil(i.date, today); return n > 7 && n <= 31; }))}
            {renderGroup("בהמשך", shown.filter((i) => daysUntil(i.date, today) > 31))}
          </>
        ) : (
          shown.map((i) => <ItemCard key={i.id} item={i} today={today} onOpen={() => setOpenId(i.id)} />)
        )}
      </main>

      <button className="fab" aria-label="הוספת כרטיס או שובר" onClick={() => setForm({ item: blankItem(tab === "ticket" ? "ticket" : "coupon", me), isNew: true })}>+</button>

      {openItem && !form && (
        <ItemSheet
          item={openItem}
          today={today}
          me={me}
          store={store}
          toast={toast}
          onClose={() => setOpenId(null)}
          onEdit={() => setForm({ item: openItem, isNew: false })}
          onSave={async (next, msg) => { await saveItem(next); toast(msg); if (isHistory(next, today) !== isHistory(openItem, today)) setOpenId(null); }}
          onDelete={async () => { await store.remove(openItem); setItems((c) => c.filter((i) => i.id !== openItem.id)); setOpenId(null); toast("נמחק"); }}
        />
      )}
      {form && (
        <ItemForm
          initial={form.item}
          isNew={form.isNew}
          onClose={() => setForm(null)}
          onSubmit={async (item, files) => {
            const saved = await saveItem(item, files);
            setForm(null);
            if (form.isNew) { setOpenId(null); setTab(saved.type === "ticket" && tab === "coupon" ? "ticket" : saved.type === "coupon" && tab === "ticket" ? "coupon" : tab === "history" ? "upcoming" : tab); }
            toast(form.isNew ? "נשמר. התזכורות תוזמנו" : "השינויים נשמרו");
          }}
        />
      )}
      {account && (
        <AccountSheet mode={store.mode} household={household} members={members} toast={toast} onClose={() => setAccount(false)}
          onSignOut={onSignOut} onResetDemo={() => { onResetDemo?.(); setAccount(false); toast("נתוני הדוגמה אופסו"); }} />
      )}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  );
}
