-- כרטיסייה: database setup. Paste into Supabase → SQL Editor → Run (safe to run once on a new project).

create extension if not exists pgcrypto;

-- A household is the shared wallet (you + your partner).
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 6)),
  created_at timestamptz not null default now()
);

create table public.members (
  household_id uuid not null references public.households on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.items (
  id uuid primary key,
  household_id uuid not null references public.households on delete cascade,
  type text not null check (type in ('ticket', 'coupon')),
  title text not null,
  place text not null default '',
  date date not null,                -- event date (ticket) / last valid day (coupon)
  time time,                         -- tickets only
  value numeric(10,2),               -- coupon value in ₪
  remaining numeric(10,2),           -- coupon balance in ₪
  notes text not null default '',
  attachments jsonb not null default '[]',  -- [{id, kind: pdf|photo|code, name, mime, path, code}]
  usages jsonb not null default '[]',       -- [{id, amount, at, by}]
  used_up boolean not null default false,
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index items_household_date on public.items (household_id, date);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade default auth.uid(),
  household_id uuid not null references public.households on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

-- Which reminders were already sent, so each one goes out once.
create table public.reminder_log (
  item_id uuid not null references public.items on delete cascade,
  offset_days int not null,
  target_date date not null,
  sent_at timestamptz not null default now(),
  primary key (item_id, offset_days, target_date)
);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger items_touch before update on public.items for each row execute function public.touch_updated_at();

-- Membership check used by the security rules.
create or replace function public.is_member(hh uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where household_id = hh and user_id = auth.uid());
$$;

create or replace function public.create_household(p_name text, p_display_name text) returns public.households
language plpgsql security definer set search_path = public as $$
declare h public.households;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into public.households (name) values (coalesce(nullif(trim(p_name), ''), 'הבית שלנו')) returning * into h;
  insert into public.members (household_id, user_id, display_name) values (h.id, auth.uid(), p_display_name);
  return h;
end $$;

create or replace function public.join_household(p_code text, p_display_name text) returns public.households
language plpgsql security definer set search_path = public as $$
declare h public.households;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into h from public.households where invite_code = upper(trim(p_code));
  if h.id is null then raise exception 'invite code not found'; end if;
  insert into public.members (household_id, user_id, display_name) values (h.id, auth.uid(), p_display_name)
  on conflict (household_id, user_id) do update set display_name = excluded.display_name;
  return h;
end $$;

-- Row level security: you only see your own household's data.
alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.items enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.reminder_log enable row level security; -- no policies: only the reminder job (service role) uses it

create policy "members read household" on public.households for select using (public.is_member(id));
create policy "members read members" on public.members for select using (public.is_member(household_id));
create policy "members update own name" on public.members for update using (user_id = auth.uid());
create policy "members manage items" on public.items for all
  using (public.is_member(household_id)) with check (public.is_member(household_id));
create policy "own push subscriptions" on public.push_subscriptions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member(household_id));

-- Private file storage for PDFs and photos. Files live under <household_id>/...
insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 15728640)
on conflict (id) do nothing;

create policy "household files read" on storage.objects for select
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] in (select household_id::text from public.members where user_id = auth.uid()));
create policy "household files insert" on storage.objects for insert
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] in (select household_id::text from public.members where user_id = auth.uid()));
create policy "household files update" on storage.objects for update
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] in (select household_id::text from public.members where user_id = auth.uid()));
create policy "household files delete" on storage.objects for delete
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] in (select household_id::text from public.members where user_id = auth.uid()));

-- Live updates between the two phones.
alter publication supabase_realtime add table public.items;
