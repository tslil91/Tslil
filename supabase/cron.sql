-- Runs the reminder job every morning at 08:00 UTC (10:00 in Israel in winter, 11:00 in summer).
-- 1) Database → Extensions: enable "pg_cron" and "pg_net".
-- 2) Replace YOUR-PROJECT and YOUR-CRON-SECRET (the same value you set as the CRON_SECRET function secret), then run.
select cron.schedule(
  'kartisiya-reminders',
  '0 8 * * *',
  $$
  select net.http_post(
    url := 'https://YOUR-PROJECT.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'YOUR-CRON-SECRET'),
    body := '{}'::jsonb
  );
  $$
);
