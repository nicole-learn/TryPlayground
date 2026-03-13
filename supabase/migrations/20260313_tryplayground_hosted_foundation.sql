create extension if not exists pgcrypto;

create table if not exists public.studio_system_config (
  id boolean primary key default true,
  provider_slot_limit integer not null default 30 check (provider_slot_limit > 0),
  max_active_jobs_per_user integer not null default 100 check (max_active_jobs_per_user > 0),
  local_concurrency_limit integer not null default 3 check (local_concurrency_limit > 0),
  rotation_slice_ms integer not null default 1400 check (rotation_slice_ms >= 250),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (id)
);

insert into public.studio_system_config (id)
values (true)
on conflict (id) do nothing;

create table if not exists public.studio_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'TryPlayground User',
  avatar_label text not null default 'T',
  avatar_url text,
  credit_balance numeric(12,1) not null default 0,
  active_credit_pack integer check (active_credit_pack in (10, 100)),
  enabled_model_ids text[] not null default array[
    'bria-rmbg-2',
    'claude-opus-4.6',
    'claude-sonnet-4.6',
    'chatterbox-tts',
    'dia-tts',
    'flux-kontext-pro',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
    'gpt-4.1',
    'gpt-5-mini',
    'gpt-oss-120b',
    'kling-o3-pro',
    'kling-video-v3-pro',
    'llama-4-maverick',
    'minimax-speech-2.8-hd',
    'nano-banana-2',
    'orpheus-tts',
    'pixelcut-background-removal',
    'qwen-image-2-pro',
    'recraft-v4-pro',
    'veo-3.1',
    'veo-3.1-fast'
  ]::text[],
  selected_model_id text not null default 'nano-banana-2',
  gallery_size_level integer not null default 3 check (gallery_size_level between 0 and 6),
  revision bigint not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.studio_accounts (user_id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.generation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.studio_accounts (user_id) on delete cascade,
  folder_id uuid references public.folders (id) on delete set null,
  model_id text not null,
  model_name text not null,
  kind text not null check (kind in ('image', 'video', 'text', 'audio')),
  provider text not null default 'fal' check (provider = 'fal'),
  request_mode text not null check (
    request_mode in (
      'text-to-image',
      'text-to-video',
      'image-to-video',
      'first-last-frame-to-video',
      'reference-to-video',
      'text-to-speech',
      'background-removal',
      'chat'
    )
  ),
  status text not null check (status in ('pending', 'queued', 'processing', 'completed', 'failed', 'cancelled')),
  prompt text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  queue_entered_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  summary text not null default '',
  output_asset_id uuid,
  preview_url text,
  error_message text,
  input_payload jsonb not null default '{}'::jsonb,
  input_settings jsonb not null default '{}'::jsonb,
  provider_request_id text,
  provider_status text,
  estimated_cost_usd numeric(12,6),
  actual_cost_usd numeric(12,6),
  estimated_credits numeric(12,1),
  actual_credits numeric(12,1),
  usage_snapshot jsonb not null default '{}'::jsonb,
  output_text text,
  pricing_snapshot jsonb not null default '{}'::jsonb,
  dispatch_attempt_count integer not null default 0,
  dispatch_lease_expires_at timestamptz,
  can_cancel boolean not null default true,
  draft_snapshot jsonb not null default '{}'::jsonb
);

create table if not exists public.run_files (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.generation_runs (id) on delete set null,
  user_id uuid not null references public.studio_accounts (user_id) on delete cascade,
  file_role text not null check (file_role in ('input', 'output', 'thumbnail')),
  source_type text not null check (source_type in ('generated', 'uploaded')),
  storage_bucket text not null,
  storage_path text not null,
  mime_type text,
  file_name text,
  file_size_bytes bigint,
  media_width integer,
  media_height integer,
  media_duration_seconds numeric(10,3),
  aspect_ratio_label text,
  has_alpha boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.library_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.studio_accounts (user_id) on delete cascade,
  run_file_id uuid references public.run_files (id) on delete set null,
  thumbnail_file_id uuid references public.run_files (id) on delete set null,
  source_run_id uuid references public.generation_runs (id) on delete set null,
  title text not null,
  kind text not null check (kind in ('image', 'video', 'text', 'audio')),
  source text not null check (source in ('generated', 'uploaded')),
  role text not null check (role in ('generated_output', 'uploaded_source', 'text_note')),
  content_text text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  model_id text,
  run_id uuid references public.generation_runs (id) on delete set null,
  provider text not null default 'fal' check (provider = 'fal'),
  status text not null default 'ready' check (status in ('ready', 'processing', 'failed')),
  prompt text not null default '',
  meta text not null default '',
  media_width integer,
  media_height integer,
  media_duration_seconds numeric(10,3),
  aspect_ratio_label text,
  has_alpha boolean not null default false,
  folder_id uuid references public.folders (id) on delete set null,
  file_name text,
  mime_type text,
  byte_size bigint,
  metadata jsonb not null default '{}'::jsonb,
  error_message text
);

create table if not exists public.generation_run_inputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.studio_accounts (user_id) on delete cascade,
  run_id uuid not null references public.generation_runs (id) on delete cascade,
  input_role text not null check (input_role in ('reference', 'start_frame', 'end_frame')),
  position integer not null default 0,
  library_item_id uuid references public.library_items (id) on delete set null,
  run_file_id uuid references public.run_files (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.studio_accounts (user_id) on delete cascade,
  delta_credits numeric(12,1) not null,
  reason text not null check (
    reason in (
      'purchase',
      'generation_hold',
      'generation_settlement',
      'generation_refund',
      'admin_adjustment'
    )
  ),
  related_run_id uuid references public.generation_runs (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists folders_user_name_unique
  on public.folders (user_id, lower(name));

create index if not exists folders_user_sort_idx
  on public.folders (user_id, sort_order, created_at desc);

create index if not exists generation_runs_user_status_queue_idx
  on public.generation_runs (user_id, status, queue_entered_at asc);

create index if not exists generation_runs_status_queue_idx
  on public.generation_runs (status, queue_entered_at asc);

create index if not exists library_items_user_folder_created_idx
  on public.library_items (user_id, folder_id, created_at desc);

create index if not exists run_files_user_created_idx
  on public.run_files (user_id, created_at desc);

create index if not exists generation_run_inputs_run_role_position_idx
  on public.generation_run_inputs (run_id, input_role, position);

create index if not exists credit_ledger_user_created_idx
  on public.credit_ledger (user_id, created_at desc);

alter table public.studio_system_config enable row level security;
alter table public.studio_accounts enable row level security;
alter table public.folders enable row level security;
alter table public.generation_runs enable row level security;
alter table public.run_files enable row level security;
alter table public.library_items enable row level security;
alter table public.generation_run_inputs enable row level security;
alter table public.credit_ledger enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.bump_studio_account_revision(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.studio_accounts
  set revision = revision + 1,
      updated_at = timezone('utc', now())
  where user_id = target_user_id;
end;
$$;

create or replace function public.bump_studio_account_revision_from_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_user_id uuid;
begin
  target_user_id = coalesce(new.user_id, old.user_id);

  if target_user_id is not null then
    perform public.bump_studio_account_revision(target_user_id);
  end if;

  return coalesce(new, old);
end;
$$;

create or replace function public.handle_tryplayground_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_display_name text;
begin
  next_display_name = coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'TryPlayground User'
  );

  insert into public.studio_accounts (
    user_id,
    display_name,
    avatar_label
  ) values (
    new.id,
    next_display_name,
    upper(left(next_display_name, 1))
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists set_studio_system_config_updated_at on public.studio_system_config;
create trigger set_studio_system_config_updated_at
before update on public.studio_system_config
for each row
execute function public.set_updated_at();

drop trigger if exists set_studio_accounts_updated_at on public.studio_accounts;
create trigger set_studio_accounts_updated_at
before update on public.studio_accounts
for each row
execute function public.set_updated_at();

drop trigger if exists set_folders_updated_at on public.folders;
create trigger set_folders_updated_at
before update on public.folders
for each row
execute function public.set_updated_at();

drop trigger if exists set_generation_runs_updated_at on public.generation_runs;
create trigger set_generation_runs_updated_at
before update on public.generation_runs
for each row
execute function public.set_updated_at();

drop trigger if exists set_library_items_updated_at on public.library_items;
create trigger set_library_items_updated_at
before update on public.library_items
for each row
execute function public.set_updated_at();

drop trigger if exists folders_bump_studio_revision on public.folders;
create trigger folders_bump_studio_revision
after insert or update or delete on public.folders
for each row
execute function public.bump_studio_account_revision_from_trigger();

drop trigger if exists generation_runs_bump_studio_revision on public.generation_runs;
create trigger generation_runs_bump_studio_revision
after insert or update or delete on public.generation_runs
for each row
execute function public.bump_studio_account_revision_from_trigger();

drop trigger if exists run_files_bump_studio_revision on public.run_files;
create trigger run_files_bump_studio_revision
after insert or update or delete on public.run_files
for each row
execute function public.bump_studio_account_revision_from_trigger();

drop trigger if exists library_items_bump_studio_revision on public.library_items;
create trigger library_items_bump_studio_revision
after insert or update or delete on public.library_items
for each row
execute function public.bump_studio_account_revision_from_trigger();

drop trigger if exists generation_run_inputs_bump_studio_revision on public.generation_run_inputs;
create trigger generation_run_inputs_bump_studio_revision
after insert or update or delete on public.generation_run_inputs
for each row
execute function public.bump_studio_account_revision_from_trigger();

drop trigger if exists credit_ledger_bump_studio_revision on public.credit_ledger;
create trigger credit_ledger_bump_studio_revision
after insert or update or delete on public.credit_ledger
for each row
execute function public.bump_studio_account_revision_from_trigger();

drop trigger if exists on_auth_user_created_tryplayground on auth.users;
create trigger on_auth_user_created_tryplayground
after insert on auth.users
for each row
execute function public.handle_tryplayground_new_user();

insert into public.studio_accounts (user_id, display_name, avatar_label)
select
  users.id,
  coalesce(
    nullif(trim(users.raw_user_meta_data ->> 'display_name'), ''),
    nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
    'TryPlayground User'
  ),
  upper(left(
    coalesce(
      nullif(trim(users.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(coalesce(users.email, ''), '@', 1), ''),
      'T'
    ),
    1
  ))
from auth.users as users
on conflict (user_id) do nothing;

create policy "studio_accounts_select_own"
on public.studio_accounts
for select
to authenticated
using (user_id = auth.uid());

create policy "studio_accounts_insert_own"
on public.studio_accounts
for insert
to authenticated
with check (user_id = auth.uid());

create policy "studio_accounts_update_own"
on public.studio_accounts
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "folders_manage_own"
on public.folders
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "generation_runs_manage_own"
on public.generation_runs
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "run_files_manage_own"
on public.run_files
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "library_items_manage_own"
on public.library_items
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "generation_run_inputs_manage_own"
on public.generation_run_inputs
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "credit_ledger_manage_own"
on public.credit_ledger
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "studio_system_config_read_authenticated"
on public.studio_system_config
for select
to authenticated
using (true);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'hosted-media',
  'hosted-media',
  false,
  524288000,
  array['image/*', 'video/*', 'audio/*', 'text/plain', 'image/svg+xml']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "hosted_media_bucket_visible"
on storage.buckets
for select
to authenticated
using (id = 'hosted-media');

create policy "hosted_media_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'hosted-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "hosted_media_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'hosted-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "hosted_media_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'hosted-media'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'hosted-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "hosted_media_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'hosted-media'
  and (storage.foldername(name))[1] = auth.uid()::text
);
