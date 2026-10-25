-- GearGuide / Garagewiki: complete schema for a fresh Supabase project.
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run. Safe to re-run.
-- Includes everything in supabase/migrations/ (those files exist for upgrading older installs).

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
-- Email the author when an admin approves or rejects their entry (sent through the Resend API).
-- Runs entirely inside Supabase: a trigger calls pg_net, which posts to Resend in the background.
-- Safe to re-run. Setup values go in Supabase Vault (see the bottom of this file).

create extension if not exists pg_net;

create or replace function public.html_escape(t text)
returns text
language sql immutable
as $$
  select replace(replace(replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;')
$$;

create or replace function public.notify_author_of_review()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  api_key text; sender text; site text; author_email text;
  kind text; route text; link text; subj text; heading text; body_html text;
  safe_title text; safe_note text; sub_title text;
begin
  -- Only decisions, and not when someone reviews their own entry.
  if new.status not in ('approved', 'rejected') or new.created_by is null
     or new.reviewed_by is not distinct from new.created_by then
    return new;
  end if;

  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'resend_api_key';
  select decrypted_secret into sender  from vault.decrypted_secrets where name = 'email_from';
  select decrypted_secret into site    from vault.decrypted_secrets where name = 'site_url';
  -- Pasted values often carry a trailing space or newline; a newline in the Authorization header
  -- would cut the request's headers short, so strip whitespace from the ends.
  api_key := btrim(api_key, E' \t\r\n');
  sender  := btrim(sender,  E' \t\r\n');
  site    := btrim(site,    E' \t\r\n');
  if api_key is null or sender is null or site is null then
    raise warning 'review email skipped: add resend_api_key, email_from and site_url to Vault';
    return new;
  end if;

  select email into author_email from auth.users where id = new.created_by;
  if author_email is null then return new; end if;

  kind  := case tg_table_name when 'manuals' then 'manual' when 'common_issues' then 'issue' else 'diagram' end;
  route := kind || 's';
  site  := rtrim(site, '/');
  safe_title := public.html_escape(new.title);
  sub_title  := left(regexp_replace(new.title, '[\r\n]+', ' ', 'g'), 80);

  if new.status = 'approved' then
    link    := site || '/view/' || route || '/' || new.id;
    subj    := 'Your ' || kind || ' was approved: ' || sub_title;
    heading := 'Your ' || kind || ' is live';
    body_html := '<p><strong>' || safe_title || '</strong> was approved and is now visible to everyone.</p>'
              || '<p><a href="' || link || '">View it</a></p>';
  else
    link    := site || '/edit/' || route || '/' || new.id;
    safe_note := public.html_escape(new.review_note);
    subj    := 'Your ' || kind || ' needs changes: ' || sub_title;
    heading := 'Your ' || kind || ' was not approved';
    body_html := '<p><strong>' || safe_title || '</strong> was not approved.</p>'
              || case when coalesce(new.review_note, '') <> ''
                      then '<blockquote style="margin:12px 0;padding:8px 12px;border-left:3px solid #d4d4d8;color:#3f3f46">' || safe_note || '</blockquote>'
                      else '' end
              || '<p>You can <a href="' || link || '">edit it</a> and save to send it back for review.</p>';
  end if;

  perform net.http_post(
    url     := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
    body    := jsonb_build_object(
      'from', sender,
      'to', jsonb_build_array(author_email),
      'subject', subj,
      'html', '<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;color:#18181b">'
              || '<h2 style="margin:0 0 12px">' || heading || '</h2>' || body_html
              || '<p style="color:#71717a;font-size:12px;margin-top:24px">Garagewiki</p></div>'
    ),
    timeout_milliseconds := 10000   -- the 1000 ms default can leave the request body unsent
  );
  return new;
exception when others then
  -- Never let an email problem block moderation.
  raise warning 'review email failed: %', sqlerrm;
  return new;
end;
$$;
revoke all on function public.notify_author_of_review() from public;

do $$
declare t text;
begin
  foreach t in array array['manuals','common_issues','exploded_diagrams'] loop
    execute format('drop trigger if exists notify_review on public.%I', t);
    execute format('create trigger notify_review after update of status on public.%I for each row when (old.status is distinct from new.status) execute function public.notify_author_of_review()', t);
  end loop;
end $$;

-- ---------- One-time setup: store the settings in Vault ----------
-- Run these three lines ONCE with your own values (a Resend API key with sending access,
-- a sender on your verified domain, and your site's address):
--
--   select vault.create_secret('re_YOUR_API_KEY', 'resend_api_key');
--   select vault.create_secret('Garagewiki <no-reply@YOUR-DOMAIN>', 'email_from');
--   select vault.create_secret('https://YOUR-SITE-DOMAIN', 'site_url');
--
-- To change one later:
--   select vault.update_secret((select id from vault.secrets where name = 'site_url'), 'https://new-address');
--
-- To see whether emails were sent (newest first):
--   select id, status_code, left(content::text, 200) as response, created from net._http_response order by created desc limit 5;
-- Find uploaded files that no entry uses any more, so admins can delete them from the Admin page.
-- (Supabase doesn't let SQL delete the stored file itself, so the app removes them through the Storage API.)
-- A file counts as unused when no entry references it AND it is more than 1 day old
-- (so uploads still being filled into a form are never touched). Safe to re-run.

create or replace function public.orphaned_uploads()
returns table (path text, bytes bigint, uploaded_at timestamptz)
language plpgsql stable
security definer
set search_path = public, storage
as $$
begin
  if not public.is_admin() then
    raise exception 'admins only';
  end if;

  return query
  select o.name,
         coalesce((o.metadata ->> 'size')::bigint, 0),
         o.created_at
  from storage.objects o
  where o.bucket_id = 'uploads'
    and o.created_at < now() - interval '1 day'
    and not exists (select 1 from public.manuals m
                    where m.cover_image like '%/object/public/uploads/' || o.name
                       or m.manual_file like '%/object/public/uploads/' || o.name)
    and not exists (select 1 from public.common_issues i
                    where exists (select 1 from unnest(i.images) u where u like '%/object/public/uploads/' || o.name))
    and not exists (select 1 from public.exploded_diagrams d
                    where d.diagram_image like '%/object/public/uploads/' || o.name)
  order by o.created_at;
end;
$$;
revoke all on function public.orphaned_uploads() from public;
grant execute on function public.orphaned_uploads() to authenticated;

-- Admins may delete files from the uploads bucket (regular users still can't).
drop policy if exists "uploads admin delete" on storage.objects;
create policy "uploads admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'uploads' and public.is_admin());
