// Supabase Edge Function: sends the daily reminders as push notifications to every phone in the household.
// Deploy: supabase functions deploy send-reminders --no-verify-jwt
// Secrets: supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com CRON_SECRET=...
import { createClient } from "npm:@supabase/supabase-js@2.57.0";
import webpush from "npm:web-push@3.6.7";

const OFFSETS: Record<string, number[]> = { ticket: [7, 1], coupon: [30, 7, 1] };
const DAY = 86_400_000;

const todayIL = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const utc = (d: string) => { const [y, m, dd] = d.split("-").map(Number); return Date.UTC(y, m - 1, dd); };
const addDays = (d: string, n: number) => new Date(utc(d) + n * DAY).toISOString().slice(0, 10);
const fmt = (d: string) => new Date(utc(d)).toLocaleDateString("he-IL", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const ils = (n: number) => "₪" + (Number.isInteger(n) ? n : n.toFixed(2));

interface Item {
  id: string; household_id: string; type: "ticket" | "coupon"; title: string; place: string; date: string;
  time: string | null; value: number | null; remaining: number | null;
}

function message(item: Item, offset: number) {
  const when = offset === 30 ? "בעוד חודש" : offset === 7 ? "בעוד שבוע" : "מחר";
  if (item.type === "ticket") {
    const time = item.time ? `, ${item.time.slice(0, 5)}` : "";
    return { title: `${when} · ${item.title}`, body: `${fmt(item.date)}${time}${item.place ? ` · ${item.place}` : ""}. הכרטיס באפליקציה.` };
  }
  const balance = item.value != null && item.remaining != null
    ? (Number(item.remaining) < Number(item.value) ? `נשארו ${ils(Number(item.remaining))} מתוך ${ils(Number(item.value))}. ` : `שווי ${ils(Number(item.value))}. `)
    : "";
  return { title: `${when} פג התוקף · ${item.title}`, body: `${balance}בתוקף עד ${fmt(item.date)}.` };
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) return new Response("forbidden", { status: 403 });

  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT")!, Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const today = todayIL();
  const { data: items, error } = await db.from("items").select("id,household_id,type,title,place,date,time,value,remaining")
    .eq("used_up", false).gte("date", addDays(today, 1)).lte("date", addDays(today, 30));
  if (error) return new Response(error.message, { status: 500 });

  let sent = 0;
  for (const item of items as Item[]) {
    const offset = Math.round((utc(item.date) - utc(today)) / DAY);
    if (!OFFSETS[item.type].includes(offset)) continue;

    // Claim this reminder first so it is only sent once, even if the job runs twice.
    const { error: dup } = await db.from("reminder_log").insert({ item_id: item.id, offset_days: offset, target_date: item.date });
    if (dup) continue;

    const { data: subs } = await db.from("push_subscriptions").select("id,subscription").eq("household_id", item.household_id);
    const payload = JSON.stringify({ ...message(item, offset), url: `/?item=${item.id}`, tag: `${item.id}-${offset}` });
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(s.subscription, payload, { TTL: 60 * 60 * 12, urgency: "normal" });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", s.id); // phone unsubscribed
        else console.error("push failed", code, e);
      }
    }
  }
  return Response.json({ today, sent });
});
