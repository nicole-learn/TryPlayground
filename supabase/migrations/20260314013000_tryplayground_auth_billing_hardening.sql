alter table public.credit_purchases
  add column if not exists checkout_request_id text,
  add column if not exists stripe_checkout_url text,
  add column if not exists refunded_amount_cents integer not null default 0,
  add column if not exists refunded_credits numeric(12,1) not null default 0;

update public.credit_purchases
set
  refunded_amount_cents = case
    when status = 'refunded' then amount_cents
    else refunded_amount_cents
  end,
  refunded_credits = case
    when status = 'refunded' then credits_amount
    else refunded_credits
  end
where
  refunded_amount_cents = 0
  and refunded_credits = 0
  and status = 'refunded';

alter table public.credit_purchases
  drop constraint if exists credit_purchases_refund_bounds_check;

alter table public.credit_purchases
  add constraint credit_purchases_refund_bounds_check
  check (
    refunded_amount_cents >= 0
    and refunded_amount_cents <= amount_cents
    and refunded_credits >= 0
    and refunded_credits <= credits_amount
  );

create unique index if not exists credit_purchases_user_checkout_request_unique
  on public.credit_purchases (user_id, checkout_request_id)
  where checkout_request_id is not null;

create index if not exists credit_purchases_user_pending_idx
  on public.credit_purchases (user_id, created_at desc)
  where status = 'pending';
