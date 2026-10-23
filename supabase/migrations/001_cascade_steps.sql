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
