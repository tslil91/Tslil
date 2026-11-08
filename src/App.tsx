import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AuthScreen } from "./components/AuthScreen";
import { HouseholdScreen } from "./components/HouseholdScreen";
import { Wallet } from "./components/Wallet";
import { createDemoStore } from "./lib/demoStore";
import { cloudConfigured, createCloudStore, supabase, type Household, type Member } from "./lib/supabase";

export default function App() {
  return cloudConfigured ? <CloudApp /> : <DemoApp />;
}

function DemoApp() {
  const store = useMemo(() => createDemoStore(), []);
  return <Wallet store={store} me="אני" members={["אני"]} onResetDemo={() => void store.reset()} />;
}

function Loading() {
  return <div className="center"><span className="muted">טוען…</span></div>;
}

function CloudApp() {
  const sb = supabase!;
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [household, setHousehold] = useState<Household | null | undefined>(undefined);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    void sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [sb]);

  const uid = session?.user.id;
  useEffect(() => {
    if (!uid) { setHousehold(undefined); return; }
    let alive = true;
    void (async () => {
      const { data } = await sb.from("members").select("household_id, households(id, name, invite_code)").eq("user_id", uid).limit(1).maybeSingle();
      if (!alive) return;
      const h = (data?.households ?? null) as unknown as Household | null;
      setHousehold(h);
    })();
    return () => { alive = false; };
  }, [sb, uid]);

  useEffect(() => {
    if (!household) return;
    void sb.from("members").select("user_id, display_name").eq("household_id", household.id).order("created_at")
      .then(({ data }) => setMembers((data as Member[]) ?? []));
  }, [sb, household]);

  const store = useMemo(() => (household ? createCloudStore(sb, household) : null), [sb, household]);
  const signOut = () => { void sb.auth.signOut(); setHousehold(undefined); setMembers([]); };

  if (session === undefined) return <Loading />;
  if (!session) return <AuthScreen />;
  const meta = session.user.user_metadata as { display_name?: string };
  const fallbackName = meta.display_name || session.user.email?.split("@")[0] || "אני";
  if (household === undefined) return <Loading />;
  if (household === null) return <HouseholdScreen displayName={fallbackName} onReady={setHousehold} onSignOut={signOut} />;

  const me = members.find((m) => m.user_id === uid)?.display_name ?? fallbackName;
  return <Wallet store={store!} me={me} members={members.length ? members.map((m) => m.display_name) : [me]} household={household} onSignOut={signOut} />;
}
