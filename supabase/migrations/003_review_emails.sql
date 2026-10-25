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
