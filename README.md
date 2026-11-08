# כרטיסייה

A shared wallet for tickets and coupons, built for two phones (Android + iPhone). Hebrew, right-to-left, light/dark by the phone's setting.

- **Tickets**: reminder 7 days and 1 day before the event.
- **Coupons**: reminder 30, 7 and 1 day before expiry. Mark as partly used (balance + usage log) or fully used.
- **Attachments**: each item can hold a PDF, a photo, a code, or any mix.
- **Edit / delete** any item, undo a usage entered by mistake, restore an item from History.
- **History**: used coupons, expired coupons and past events, with search.
- **Shared**: both of you join one household with an invite code and see changes live.

It is a web app (PWA) you add to the home screen, with [Supabase](https://supabase.com) (free tier) for login, the shared database, file storage and the daily reminder job.

## Try it right away (demo mode)

```bash
npm install
npm run dev
```

Without Supabase settings the app runs in **demo mode**: sample data, stored only on that device. Good for trying the screens.

## Set up for real use

### 1. Supabase project (≈10 min)

1. Create a free project at [supabase.com](https://supabase.com). Pick the region closest to you (e.g. Frankfurt).
2. **SQL Editor** → paste all of [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
3. **Authentication → Sign In / Providers → Email**: keep Email enabled. For two people it's simplest to turn **off** "Confirm email" (otherwise each of you confirms by an emailed link first).
4. **Project Settings → API**: copy the **Project URL** and the **anon / publishable key**.

### 2. Reminders (≈15 min)

Reminders are push notifications sent once a day by a small function.

1. Create notification keys: `npx web-push generate-vapid-keys` → you get a public and a private key.
2. Install the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), then:
   ```bash
   supabase login
   supabase link --project-ref YOUR-PROJECT-REF
   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com CRON_SECRET=pick-a-long-random-string
   supabase functions deploy send-reminders --no-verify-jwt
   ```
3. **Database → Extensions**: enable `pg_cron` and `pg_net`.
4. Edit [`supabase/cron.sql`](supabase/cron.sql) (project URL + the same `CRON_SECRET`) and run it in the SQL Editor. Reminders go out daily at 08:00 UTC (10:00 Israel winter time, 11:00 summer).

Each reminder is sent once (logged in `reminder_log`). Changing an item's date reschedules it automatically; used-up items stop reminding.

### 3. Put it online

Any static host works. With [Vercel](https://vercel.com) (free):

1. **Add New → Project** → import this GitHub repository (framework: Vite).
2. Environment variables:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon / publishable key
   - `VITE_VAPID_PUBLIC_KEY` = the **public** VAPID key
3. Deploy. Every push to the main branch redeploys.

For local development with the real backend, copy `.env.example` to `.env.local` and fill in the same values.

### 4. Install on the phones

- **Android (Chrome)**: open the site → ⋮ menu → **Install app**.
- **iPhone (Safari, iOS 16.4+)**: open the site → Share → **Add to Home Screen**. Open the app from the home screen icon (reminders only work from there on iPhone).

Then: one of you signs up and creates the household; open ☰ to see the **invite code**. The other signs up, chooses **הצטרפות לבית קיים** and enters the code. On each phone, open ☰ → **הפעלת תזכורות** and allow notifications.

## Development

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Unit tests (dates, reminders, coupon balance) |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Production build into `dist/` |
| `npm run icons` | Re-render the PNG icons from `public/icon.svg` (needs Playwright) |

Code map:

- `src/lib/dates.ts` – Israel-time dates, countdowns, reminder plan, history rules
- `src/lib/items.ts` – partial use, full use, undo, restore, value edits
- `src/lib/demoStore.ts` / `src/lib/supabase.ts` – storage (on-device demo / Supabase)
- `src/components/` – screens: wallet list, item details, add/edit form, household, sign-in
- `public/sw.js` – offline support and notification display
- `supabase/` – database schema, security rules, reminder function and schedule
