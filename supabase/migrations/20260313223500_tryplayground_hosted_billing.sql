alter table public.studio_accounts
  drop constraint if exists studio_accounts_active_credit_pack_check;

alter table public.studio_accounts
  add constraint studio_accounts_active_credit_pack_check
  check (active_credit_pack is null or active_credit_pack in (100));

alter table public.credit_ledger
  drop constraint if exists credit_ledger_reason_check;

alter table public.credit_ledger
  add column if not exists balance_after numeric(12,1),
  add column if not exists idempotency_key text,
  add column if not exists source_event_id text;

update public.credit_ledger
set balance_after = 0
where balance_after is null;

alter table public.credit_ledger
  alter column balance_after set not null;

alter table public.credit_ledger
  add constraint credit_ledger_reason_check
  check (
    reason in (
      'purchase',
      'purchase_refund',
      'generation_hold',
      'generation_settlement',
      'generation_refund',
      'admin_adjustment'
    )
  );

create unique index if not exists credit_ledger_idempotency_key_unique
  on public.credit_ledger (idempotency_key)
  where idempotency_key is not null;

create index if not exists credit_ledger_source_event_idx
  on public.credit_ledger (source_event_id)
  where source_event_id is not null;

create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.studio_accounts (user_id) on delete cascade,
  stripe_customer_id text not null,
  livemode boolean not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, livemode),
  unique (stripe_customer_id)
);

create table if not exists public.credit_packs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  credits numeric(12,1) not null check (credits > 0),
  price_cents integer not null check (price_cents > 0),
  currency text not null default 'usd',
  stripe_product_id_test text,
  stripe_price_id_test text,
  stripe_product_id_live text,
  stripe_price_id_live text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.credit_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.studio_accounts (user_id) on delete cascade,
  credit_pack_id uuid not null references public.credit_packs (id) on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  credits_amount numeric(12,1) not null check (credits_amount > 0),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd',
  status text not null check (
    status in ('pending', 'completed', 'expired', 'failed', 'refunded')
  ),
  livemode boolean not null,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  stripe_customer_id text,
  stripe_refund_id text,
  fulfilled_ledger_entry_id uuid references public.credit_ledger (id) on delete set null,
  refund_ledger_entry_id uuid references public.credit_ledger (id) on delete set null,
  credited_at timestamptz,
  refunded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists credit_purchases_checkout_session_unique
  on public.credit_purchases (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

create unique index if not exists credit_purchases_payment_intent_unique
  on public.credit_purchases (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create unique index if not exists credit_purchases_charge_unique
  on public.credit_purchases (stripe_charge_id)
  where stripe_charge_id is not null;

create index if not exists credit_purchases_user_created_idx
  on public.credit_purchases (user_id, created_at desc);

create table if not exists public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  livemode boolean not null,
  status text not null check (status in ('processing', 'processed', 'failed')),
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists stripe_webhook_events_status_created_idx
  on public.stripe_webhook_events (status, created_at desc);

alter table public.billing_customers enable row level security;
alter table public.credit_packs enable row level security;
alter table public.credit_purchases enable row level security;
alter table public.stripe_webhook_events enable row level security;

drop trigger if exists set_billing_customers_updated_at on public.billing_customers;
create trigger set_billing_customers_updated_at
before update on public.billing_customers
for each row
execute function public.set_updated_at();

drop trigger if exists set_credit_packs_updated_at on public.credit_packs;
create trigger set_credit_packs_updated_at
before update on public.credit_packs
for each row
execute function public.set_updated_at();

drop trigger if exists set_credit_purchases_updated_at on public.credit_purchases;
create trigger set_credit_purchases_updated_at
before update on public.credit_purchases
for each row
execute function public.set_updated_at();

drop trigger if exists set_stripe_webhook_events_updated_at on public.stripe_webhook_events;
create trigger set_stripe_webhook_events_updated_at
before update on public.stripe_webhook_events
for each row
execute function public.set_updated_at();

create policy "billing_customers_select_own"
on public.billing_customers
for select
to authenticated
using (user_id = auth.uid());

create policy "billing_customers_insert_own"
on public.billing_customers
for insert
to authenticated
with check (user_id = auth.uid());

create policy "billing_customers_update_own"
on public.billing_customers
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "credit_packs_read_authenticated"
on public.credit_packs
for select
to authenticated
using (is_active = true);

create policy "credit_purchases_select_own"
on public.credit_purchases
for select
to authenticated
using (user_id = auth.uid());

create policy "credit_purchases_insert_own"
on public.credit_purchases
for insert
to authenticated
with check (user_id = auth.uid());

create policy "credit_purchases_update_own"
on public.credit_purchases
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.apply_tryplayground_credit_ledger_entry(
  p_user_id uuid,
  p_delta_credits numeric,
  p_reason text,
  p_related_run_id uuid default null,
  p_idempotency_key text default null,
  p_source_event_id text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_allow_negative_balance boolean default false,
  p_active_credit_pack integer default null
)
returns public.credit_ledger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.credit_ledger%rowtype;
  v_account public.studio_accounts%rowtype;
  v_balance_after numeric(12,1);
begin
  if p_idempotency_key is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));

    select *
    into v_existing
    from public.credit_ledger
    where idempotency_key = p_idempotency_key
    limit 1;

    if found then
      return v_existing;
    end if;
  end if;

  select *
  into v_account
  from public.studio_accounts
  where user_id = p_user_id
  for update;

  if not found then
    raise exception 'studio account not found for user %', p_user_id;
  end if;

  v_balance_after = coalesce(v_account.credit_balance, 0) + p_delta_credits;

  if not p_allow_negative_balance and v_balance_after < 0 then
    raise exception 'INSUFFICIENT_CREDITS: not enough credits to complete this operation';
  end if;

  update public.studio_accounts
  set credit_balance = v_balance_after,
      active_credit_pack = coalesce(p_active_credit_pack, active_credit_pack),
      updated_at = timezone('utc', now())
  where user_id = p_user_id;

  insert into public.credit_ledger (
    user_id,
    delta_credits,
    balance_after,
    reason,
    related_run_id,
    idempotency_key,
    source_event_id,
    metadata
  ) values (
    p_user_id,
    p_delta_credits,
    v_balance_after,
    p_reason,
    p_related_run_id,
    p_idempotency_key,
    p_source_event_id,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning *
  into v_existing;

  return v_existing;
end;
$$;

create or replace function public.fulfill_tryplayground_credit_purchase(
  p_purchase_id uuid,
  p_stripe_checkout_session_id text default null,
  p_stripe_payment_intent_id text default null,
  p_stripe_charge_id text default null,
  p_stripe_customer_id text default null,
  p_source_event_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.credit_purchases
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase public.credit_purchases%rowtype;
  v_credit_pack public.credit_packs%rowtype;
  v_ledger public.credit_ledger%rowtype;
begin
  select *
  into v_purchase
  from public.credit_purchases
  where id = p_purchase_id
  for update;

  if not found then
    raise exception 'credit purchase % was not found', p_purchase_id;
  end if;

  if v_purchase.status = 'completed' and v_purchase.fulfilled_ledger_entry_id is not null then
    return v_purchase;
  end if;

  select *
  into v_credit_pack
  from public.credit_packs
  where id = v_purchase.credit_pack_id;

  if not found then
    raise exception 'credit pack % was not found for purchase %', v_purchase.credit_pack_id, p_purchase_id;
  end if;

  v_ledger := public.apply_tryplayground_credit_ledger_entry(
    p_user_id := v_purchase.user_id,
    p_delta_credits := v_purchase.credits_amount,
    p_reason := 'purchase',
    p_related_run_id := null,
    p_idempotency_key := format('stripe:credit_purchase:%s:grant', v_purchase.id),
    p_source_event_id := p_source_event_id,
    p_metadata := jsonb_build_object(
      'credit_purchase_id', v_purchase.id,
      'credit_pack_id', v_purchase.credit_pack_id,
      'stripe_checkout_session_id', coalesce(p_stripe_checkout_session_id, v_purchase.stripe_checkout_session_id),
      'stripe_payment_intent_id', coalesce(p_stripe_payment_intent_id, v_purchase.stripe_payment_intent_id),
      'stripe_charge_id', coalesce(p_stripe_charge_id, v_purchase.stripe_charge_id)
    ) || coalesce(p_metadata, '{}'::jsonb),
    p_allow_negative_balance := false,
    p_active_credit_pack := v_credit_pack.credits::integer
  );

  update public.credit_purchases
  set status = 'completed',
      stripe_checkout_session_id = coalesce(p_stripe_checkout_session_id, stripe_checkout_session_id),
      stripe_payment_intent_id = coalesce(p_stripe_payment_intent_id, stripe_payment_intent_id),
      stripe_charge_id = coalesce(p_stripe_charge_id, stripe_charge_id),
      stripe_customer_id = coalesce(p_stripe_customer_id, stripe_customer_id),
      fulfilled_ledger_entry_id = v_ledger.id,
      credited_at = coalesce(credited_at, timezone('utc', now())),
      metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb),
      updated_at = timezone('utc', now())
  where id = v_purchase.id
  returning *
  into v_purchase;

  return v_purchase;
end;
$$;

grant execute on function public.apply_tryplayground_credit_ledger_entry(
  uuid,
  numeric,
  text,
  uuid,
  text,
  text,
  jsonb,
  boolean,
  integer
) to authenticated, service_role;

grant execute on function public.fulfill_tryplayground_credit_purchase(
  uuid,
  text,
  text,
  text,
  text,
  text,
  jsonb
) to service_role;

insert into public.credit_packs (
  slug,
  name,
  credits,
  price_cents,
  currency,
  stripe_product_id_test,
  stripe_price_id_test,
  stripe_product_id_live,
  stripe_price_id_live,
  is_active,
  display_order,
  metadata
) values (
  'hosted-100-credits',
  '100 Credits',
  100,
  1000,
  'usd',
  'prod_TyWtYjPfoef2kR',
  'price_1T0ZpTLEQVurFIbfkgaKoCiz',
  'prod_TyXJx97z0OdquL',
  'price_1T0aEQLGjQTKKAtFTRBZlkKy',
  true,
  0,
  jsonb_build_object(
    'source', '20260313223500_tryplayground_hosted_billing',
    'description', 'Hosted 100-credit pack'
  )
)
on conflict (slug) do update
set name = excluded.name,
    credits = excluded.credits,
    price_cents = excluded.price_cents,
    currency = excluded.currency,
    stripe_product_id_test = excluded.stripe_product_id_test,
    stripe_price_id_test = excluded.stripe_price_id_test,
    stripe_product_id_live = excluded.stripe_product_id_live,
    stripe_price_id_live = excluded.stripe_price_id_live,
    is_active = excluded.is_active,
    display_order = excluded.display_order,
    metadata = public.credit_packs.metadata || excluded.metadata,
    updated_at = timezone('utc', now());
