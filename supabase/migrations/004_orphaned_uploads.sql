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
