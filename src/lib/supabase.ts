import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { fileExt, type Store } from "./store";
import type { Item } from "./types";

/** Tolerate common copy-paste slips: spaces, quotes, and the "/rest/v1/" suffix shown on Supabase's Data API page. */
export function cleanUrl(raw: string | undefined): string {
  return (raw ?? "").trim().replace(/^["']|["']$/g, "").replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
}
export function cleanKey(raw: string | undefined): string {
  return (raw ?? "").trim().replace(/^["']|["']$/g, "");
}

const url = cleanUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined);
const key = cleanKey(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

/** Settings that are missing or malformed in this build (empty when connected). */
export const configProblems: string[] = [
  ...(!url ? ["VITE_SUPABASE_URL חסר"] : !/^https:\/\/.+/.test(url) ? ["VITE_SUPABASE_URL צריך להתחיל ב־https://"] : []),
  ...(!key ? ["VITE_SUPABASE_ANON_KEY חסר"] : /^sb_secret_/.test(key) ? ["VITE_SUPABASE_ANON_KEY הוא המפתח הסודי. צריך את ה־publishable"] : []),
];

export const cloudConfigured = configProblems.length === 0;
export const supabase: SupabaseClient | null = cloudConfigured ? createClient(url!, key!) : null;

const BUCKET = "attachments";

export interface Household { id: string; name: string; invite_code: string }
export interface Member { user_id: string; display_name: string }

interface Row {
  id: string; household_id: string; type: Item["type"]; title: string; place: string; date: string; time: string | null;
  value: number | null; remaining: number | null; notes: string; attachments: Item["attachments"]; usages: Item["usages"];
  used_up: boolean; created_by_name: string; created_at: string; updated_at: string;
}

const toItem = (r: Row): Item => ({
  id: r.id, type: r.type, title: r.title, place: r.place, date: r.date, time: r.time ? r.time.slice(0, 5) : null,
  value: r.value == null ? null : Number(r.value), remaining: r.remaining == null ? null : Number(r.remaining),
  notes: r.notes, attachments: r.attachments ?? [], usages: r.usages ?? [], usedUp: r.used_up,
  createdBy: r.created_by_name, createdAt: r.created_at, updatedAt: r.updated_at,
});

export function createCloudStore(sb: SupabaseClient, household: Household): Store {
  const toRow = (i: Item): Omit<Row, "created_at" | "updated_at"> => ({
    id: i.id, household_id: household.id, type: i.type, title: i.title, place: i.place, date: i.date, time: i.time,
    value: i.value, remaining: i.remaining, notes: i.notes, attachments: i.attachments, usages: i.usages,
    used_up: i.usedUp, created_by_name: i.createdBy,
  });

  return {
    mode: "cloud",
    async list() {
      const { data, error } = await sb.from("items").select("*").eq("household_id", household.id);
      if (error) throw error;
      return (data as Row[]).map(toItem);
    },
    async save(item, files, prev) {
      for (const att of item.attachments) {
        const f = files?.get(att.id);
        if (!f) continue;
        const path = `${household.id}/${item.id}/${att.id}.${fileExt(att.name ?? "", att.mime)}`;
        const { error } = await sb.storage.from(BUCKET).upload(path, f, { contentType: att.mime, upsert: true });
        if (error) throw error;
        att.path = path;
      }
      const { data, error } = await sb.from("items").upsert(toRow(item)).select().single();
      if (error) throw error;
      const removed = (prev?.attachments ?? []).filter((o) => o.path && !item.attachments.some((a) => a.path === o.path)).map((o) => o.path!);
      if (removed.length) await sb.storage.from(BUCKET).remove(removed);
      return toItem(data as Row);
    },
    async remove(item) {
      const paths = item.attachments.filter((a) => a.path).map((a) => a.path!);
      const { error } = await sb.from("items").delete().eq("id", item.id);
      if (error) throw error;
      if (paths.length) await sb.storage.from(BUCKET).remove(paths);
    },
    async fileUrl(path) {
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
    onChange(cb) {
      const ch = sb
        .channel(`items-${household.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "items", filter: `household_id=eq.${household.id}` }, cb)
        .subscribe();
      return () => { void sb.removeChannel(ch); };
    },
  };
}
