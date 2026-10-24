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
