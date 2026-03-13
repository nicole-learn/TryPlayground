create or replace function public.get_tryplayground_active_hosted_user_count()
returns integer
language sql
security definer
set search_path = public
as $$
  select greatest(
    1,
    count(distinct generation_runs.user_id)
  )::integer
  from public.generation_runs
  where generation_runs.status in ('queued', 'processing');
$$;

grant execute on function public.get_tryplayground_active_hosted_user_count() to authenticated;

create policy "studio_accounts_delete_own"
on public.studio_accounts
for delete
to authenticated
using (user_id = auth.uid());
