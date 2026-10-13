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
values ('uploads', 'uploads', true, 26214400)   -- 25 MB
on conflict (id) do nothing;

drop policy if exists "uploads public read" on storage.objects;
drop policy if exists "uploads signed-in write" on storage.objects;
create policy "uploads public read" on storage.objects for select using (bucket_id = 'uploads');
create policy "uploads signed-in write" on storage.objects for insert to authenticated with check (bucket_id = 'uploads');
