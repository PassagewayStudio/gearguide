-- GearGuide / Garagewiki schema for Supabase.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Entity fields were inferred from the Base44 export's forms and pages (the export had no schema files).

create extension if not exists pgcrypto;

-- ---------- Tables ----------

create table if not exists public.manuals (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  title text not null,
  make text not null,
  model text not null,
  year integer,
  category text not null default 'General',
  description text,
  cover_image text,
  manual_file text,
  source text
);

create table if not exists public.common_issues (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  title text not null,
  make text not null,
  model text not null,
  year integer,
  category text not null default 'General',
  symptoms text,
  solution text,
  severity text not null default 'Medium' check (severity in ('Low','Medium','High')),
  images text[] not null default '{}',
  helpful_votes integer not null default 0
);

create table if not exists public.exploded_diagrams (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  title text not null,
  make text not null,
  model text not null,
  year integer,
  category text not null default 'General',
  system text,
  description text,
  diagram_image text,
  parts text
);

create table if not exists public.troubleshooting_steps (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  parent_id uuid not null,            -- id of the CommonIssue / Manual / diagram this step belongs to
  step text not null,
  outcome text not null default 'Tried - no change',
  notes text
);

create index if not exists manuals_created_idx on public.manuals (created_date desc);
create index if not exists common_issues_created_idx on public.common_issues (created_date desc);
create index if not exists exploded_diagrams_created_idx on public.exploded_diagrams (created_date desc);
create index if not exists troubleshooting_parent_idx on public.troubleshooting_steps (parent_id, created_date);

-- ---------- Row level security ----------
-- Everyone can read. Signed-in users can add entries. Only the author can edit/delete their own.

do $$
declare t text;
begin
  foreach t in array array['manuals','common_issues','exploded_diagrams','troubleshooting_steps'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "read all" on public.%I', t);
    execute format('drop policy if exists "insert signed in" on public.%I', t);
    execute format('drop policy if exists "update own" on public.%I', t);
    execute format('drop policy if exists "delete own" on public.%I', t);
    execute format('create policy "read all" on public.%I for select using (true)', t);
    execute format('create policy "insert signed in" on public.%I for insert to authenticated with check (created_by = auth.uid())', t);
    execute format('create policy "update own" on public.%I for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid())', t);
    execute format('create policy "delete own" on public.%I for delete to authenticated using (created_by = auth.uid())', t);
  end loop;
end $$;

-- ---------- "Helpful" votes ----------
-- Anyone (even signed out) can bump the counter, but nothing else, via this function only.
create or replace function public.increment_helpful_votes(p_table text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_table <> 'common_issues' then
    raise exception 'votes are only supported on common_issues';
  end if;
  update public.common_issues set helpful_votes = helpful_votes + 1 where id = p_id;
end;
$$;
revoke all on function public.increment_helpful_votes(text, uuid) from public;
grant execute on function public.increment_helpful_votes(text, uuid) to anon, authenticated;

-- ---------- File storage (images, manual PDFs) ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('uploads', 'uploads', true, 52428800)   -- 50 MB (free-plan maximum)
on conflict (id) do nothing;

drop policy if exists "uploads public read" on storage.objects;
drop policy if exists "uploads signed-in write" on storage.objects;
create policy "uploads public read" on storage.objects for select using (bucket_id = 'uploads');
create policy "uploads signed-in write" on storage.objects for insert to authenticated with check (bucket_id = 'uploads');
-- When an entry is deleted, also remove its troubleshooting steps (even steps added by other users).
-- Run once in the Supabase SQL Editor.
create or replace function public.delete_steps_for_parent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.troubleshooting_steps where parent_id = old.id;
  return old;
end;
$$;

drop trigger if exists manuals_delete_steps on public.manuals;
drop trigger if exists common_issues_delete_steps on public.common_issues;
drop trigger if exists exploded_diagrams_delete_steps on public.exploded_diagrams;

create trigger manuals_delete_steps after delete on public.manuals
  for each row execute function public.delete_steps_for_parent();
create trigger common_issues_delete_steps after delete on public.common_issues
  for each row execute function public.delete_steps_for_parent();
create trigger exploded_diagrams_delete_steps after delete on public.exploded_diagrams
  for each row execute function public.delete_steps_for_parent();
-- Review-first moderation. Run once in the Supabase SQL Editor (safe to re-run).
--  * New entries start as 'pending' and are visible only to their author and admins.
--  * Admins approve or reject them; approved entries are public.
--  * Editing an entry sends it back to 'pending' (admin edits don't).
--  * Entries that already exist stay public ('approved').

-- ---------- Admins ----------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
drop policy if exists "read own admin row" on public.admins;
create policy "read own admin row" on public.admins for select to authenticated using (user_id = auth.uid());
-- (no insert/update/delete policies: add admins from the SQL editor, which bypasses RLS)

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.admins where user_id = auth.uid()) $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ---------- Status columns, policies, guard trigger ----------
create or replace function public.enforce_moderation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Only constrain requests coming from the browser roles. Server-side code
  -- (the vote function, the SQL editor, service role) is trusted.
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.reviewed_by := null; new.reviewed_at := null; new.review_note := null;
      new.status := case when public.is_admin() then 'approved' else 'pending' end;
    elsif tg_op = 'UPDATE' then
      if public.is_admin() then
        if new.status is distinct from old.status then
          new.reviewed_by := auth.uid();
          new.reviewed_at := now();
        end if;
      else
        new.status := 'pending';
        new.reviewed_by := null; new.reviewed_at := null; new.review_note := null;
        new.created_by := old.created_by;
      end if;
    end if;
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['manuals','common_issues','exploded_diagrams'] loop
    execute format('alter table public.%I add column if not exists status text not null default %L', t, 'approved');  -- existing rows stay public
    execute format('alter table public.%I alter column status set default %L', t, 'pending');                         -- new rows start pending
    execute format('alter table public.%I add column if not exists reviewed_by uuid references auth.users(id) on delete set null', t);
    execute format('alter table public.%I add column if not exists reviewed_at timestamptz', t);
    execute format('alter table public.%I add column if not exists review_note text', t);
    execute format('alter table public.%I drop constraint if exists %I', t, t || '_status_check');
    execute format('alter table public.%I add constraint %I check (status in (%L, %L, %L))', t, t || '_status_check', 'pending', 'approved', 'rejected');
    execute format('create index if not exists %I on public.%I (status, created_date desc)', t || '_status_idx', t);

    execute format('drop policy if exists "read all" on public.%I', t);
    execute format('drop policy if exists "read approved, own or admin" on public.%I', t);
    execute format('create policy "read approved, own or admin" on public.%I for select using (status = %L or created_by = auth.uid() or public.is_admin())', t, 'approved');

    execute format('drop policy if exists "update own" on public.%I', t);
    execute format('drop policy if exists "update own or admin" on public.%I', t);
    execute format('create policy "update own or admin" on public.%I for update to authenticated using (created_by = auth.uid() or public.is_admin()) with check (created_by = auth.uid() or public.is_admin())', t);

    execute format('drop policy if exists "delete own" on public.%I', t);
    execute format('drop policy if exists "delete own or admin" on public.%I', t);
    execute format('create policy "delete own or admin" on public.%I for delete to authenticated using (created_by = auth.uid() or public.is_admin())', t);

    execute format('drop trigger if exists moderation_guard on public.%I', t);
    execute format('create trigger moderation_guard before insert or update on public.%I for each row execute function public.enforce_moderation()', t);
  end loop;
end $$;

-- Admins can also remove troubleshooting steps (to clean up spam).
drop policy if exists "delete own" on public.troubleshooting_steps;
drop policy if exists "delete own or admin" on public.troubleshooting_steps;
create policy "delete own or admin" on public.troubleshooting_steps for delete to authenticated
  using (created_by = auth.uid() or public.is_admin());

-- Votes only count on approved issues.
create or replace function public.increment_helpful_votes(p_table text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_table <> 'common_issues' then
    raise exception 'votes are only supported on common_issues';
  end if;
  update public.common_issues set helpful_votes = helpful_votes + 1 where id = p_id and status = 'approved';
end;
$$;
revoke all on function public.increment_helpful_votes(text, uuid) from public;
grant execute on function public.increment_helpful_votes(text, uuid) to anon, authenticated;

-- ---------- Make yourself an admin ----------
-- 1) Sign in to the site once with your admin account.
-- 2) Run this with your own email:
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'YOUR-EMAIL@example.com'
--   on conflict do nothing;
