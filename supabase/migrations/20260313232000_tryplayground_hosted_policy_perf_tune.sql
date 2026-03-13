create index if not exists credit_ledger_related_run_idx
  on public.credit_ledger (related_run_id)
  where related_run_id is not null;

create index if not exists credit_purchases_credit_pack_idx
  on public.credit_purchases (credit_pack_id);

create index if not exists credit_purchases_fulfilled_ledger_idx
  on public.credit_purchases (fulfilled_ledger_entry_id)
  where fulfilled_ledger_entry_id is not null;

create index if not exists credit_purchases_refund_ledger_idx
  on public.credit_purchases (refund_ledger_entry_id)
  where refund_ledger_entry_id is not null;

create index if not exists generation_run_inputs_library_item_idx
  on public.generation_run_inputs (library_item_id)
  where library_item_id is not null;

create index if not exists generation_run_inputs_run_file_idx
  on public.generation_run_inputs (run_file_id)
  where run_file_id is not null;

create index if not exists generation_run_inputs_user_idx
  on public.generation_run_inputs (user_id);

create index if not exists generation_runs_folder_idx
  on public.generation_runs (folder_id)
  where folder_id is not null;

create index if not exists library_items_folder_idx
  on public.library_items (folder_id)
  where folder_id is not null;

create index if not exists library_items_run_file_idx
  on public.library_items (run_file_id)
  where run_file_id is not null;

create index if not exists library_items_run_idx
  on public.library_items (run_id)
  where run_id is not null;

create index if not exists library_items_source_run_idx
  on public.library_items (source_run_id)
  where source_run_id is not null;

create index if not exists library_items_thumbnail_file_idx
  on public.library_items (thumbnail_file_id)
  where thumbnail_file_id is not null;

create index if not exists run_files_run_idx
  on public.run_files (run_id)
  where run_id is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop policy if exists "studio_accounts_select_own" on public.studio_accounts;
create policy "studio_accounts_select_own"
on public.studio_accounts
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "studio_accounts_insert_own" on public.studio_accounts;
create policy "studio_accounts_insert_own"
on public.studio_accounts
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "studio_accounts_update_own" on public.studio_accounts;
create policy "studio_accounts_update_own"
on public.studio_accounts
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "studio_accounts_delete_own" on public.studio_accounts;
create policy "studio_accounts_delete_own"
on public.studio_accounts
for delete
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "folders_manage_own" on public.folders;
create policy "folders_manage_own"
on public.folders
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "generation_runs_manage_own" on public.generation_runs;
create policy "generation_runs_manage_own"
on public.generation_runs
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "run_files_manage_own" on public.run_files;
create policy "run_files_manage_own"
on public.run_files
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "library_items_manage_own" on public.library_items;
create policy "library_items_manage_own"
on public.library_items
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "generation_run_inputs_manage_own" on public.generation_run_inputs;
create policy "generation_run_inputs_manage_own"
on public.generation_run_inputs
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "credit_ledger_manage_own" on public.credit_ledger;
create policy "credit_ledger_manage_own"
on public.credit_ledger
for all
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "billing_customers_select_own" on public.billing_customers;
create policy "billing_customers_select_own"
on public.billing_customers
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "billing_customers_insert_own" on public.billing_customers;
create policy "billing_customers_insert_own"
on public.billing_customers
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "billing_customers_update_own" on public.billing_customers;
create policy "billing_customers_update_own"
on public.billing_customers
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "credit_purchases_select_own" on public.credit_purchases;
create policy "credit_purchases_select_own"
on public.credit_purchases
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "credit_purchases_insert_own" on public.credit_purchases;
create policy "credit_purchases_insert_own"
on public.credit_purchases
for insert
to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "credit_purchases_update_own" on public.credit_purchases;
create policy "credit_purchases_update_own"
on public.credit_purchases
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "stripe_webhook_events_service_role_all"
on public.stripe_webhook_events
for all
to service_role
using (true)
with check (true);
