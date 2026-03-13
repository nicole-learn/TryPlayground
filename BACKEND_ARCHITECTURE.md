# TryPlayground Backend Architecture

This document defines the recommended backend shape for TryPlayground before the real Supabase project is built.

The goal is:

- keep the schema simple
- keep the fetch path fast
- make realtime updates scale cleanly
- make thumbnails first-class
- avoid baking local UI state into backend tables

## Core Rules

1. The backend owns domain data only.
2. Client-only UI state stays out of the database unless it must sync across devices.
3. Each asset belongs to zero or one folder.
4. Every non-text asset has a canonical file and a thumbnail file.
5. Realtime is event-driven, not full-snapshot polling.
6. Hosted pricing is data-driven from a pricing table, not hardcoded in app code.

## What The Mock Layer Now Mirrors

The current mock system is intentionally shaped to match the future backend in these ways:

- hosted state is now separate from local UI/session state
- hosted sync uses a revision cursor and can return `noop` when nothing changed
- hosted file responses are treated like immutable asset URLs
- folder membership is no longer modeled through a separate join structure in the runtime

This is the direction the real backend should follow.

## Recommended Tables

### `profiles`

One row per user.

- `id uuid primary key references auth.users(id)`
- `email text not null`
- `display_name text not null`
- `avatar_label text not null`
- `avatar_url text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### `workspaces`

Exactly one workspace per user for v1.

- `id uuid primary key`
- `owner_user_id uuid not null unique references auth.users(id)`
- `name text not null`
- `enabled_model_ids text[] not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Notes:

- `enabled_model_ids` is intentionally stored directly on the workspace row for simplicity.
- Do not store prompt drafts, gallery size, or current selected model here unless you explicitly want cross-device persistence.

### `credit_accounts`

One row per workspace.

- `workspace_id uuid primary key references workspaces(id)`
- `balance_credits numeric(12,1) not null`
- `updated_at timestamptz not null default now()`

### `credit_ledger_entries`

Append-only credit audit log.

- `id uuid primary key`
- `workspace_id uuid not null references workspaces(id)`
- `entry_type text not null`
- `delta_credits numeric(12,1) not null`
- `balance_after numeric(12,1) not null`
- `source_type text not null`
- `source_id uuid null`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

### `folders`

- `id uuid primary key`
- `workspace_id uuid not null references workspaces(id)`
- `name text not null`
- `sort_order integer not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Notes:

- Keep one sortable integer column and rewrite it transactionally on reorder.
- Do not sort folders by `created_at` in product logic.

### `generation_runs`

Authoritative queue and generation record.

- `id uuid primary key`
- `workspace_id uuid not null references workspaces(id)`
- `folder_id uuid null references folders(id) on delete set null`
- `model_id text not null`
- `model_kind text not null`
- `provider text not null`
- `request_mode text not null`
- `status text not null`
- `prompt text not null`
- `summary text not null`
- `provider_request_id text null`
- `provider_status text null`
- `dispatch_attempt_count integer not null default 0`
- `dispatch_lease_expires_at timestamptz null`
- `estimated_cost_usd numeric(12,6) null`
- `actual_cost_usd numeric(12,6) null`
- `estimated_credits numeric(12,1) null`
- `actual_credits numeric(12,1) null`
- `input_settings jsonb not null default '{}'::jsonb`
- `pricing_snapshot jsonb not null default '{}'::jsonb`
- `usage_snapshot jsonb not null default '{}'::jsonb`
- `error_message text null`
- `created_at timestamptz not null default now()`
- `queue_entered_at timestamptz not null default now()`
- `started_at timestamptz null`
- `completed_at timestamptz null`
- `failed_at timestamptz null`
- `cancelled_at timestamptz null`
- `updated_at timestamptz not null default now()`

Notes:

- `generation_runs` is the queue.
- Do not create a separate queue table unless the product actually needs one.
- `dispatch_lease_expires_at` is required for recovery.

### `generation_run_inputs`

Exact input lineage for a run.

- `id uuid primary key`
- `run_id uuid not null references generation_runs(id) on delete cascade`
- `input_role text not null`
- `sort_order integer not null`
- `library_item_id uuid null references library_items(id) on delete set null`
- `run_file_id uuid null references run_files(id) on delete set null`
- `created_at timestamptz not null default now()`

Input roles:

- `reference`
- `start_frame`
- `end_frame`

This table is important. It avoids losing the exact assets used for generation.

### `run_files`

Canonical file metadata. One row per stored object or derivative.

- `id uuid primary key`
- `workspace_id uuid not null references workspaces(id)`
- `run_id uuid null references generation_runs(id) on delete set null`
- `source_type text not null`
- `file_role text not null`
- `derived_from_run_file_id uuid null references run_files(id) on delete set null`
- `storage_bucket text not null`
- `storage_path text not null`
- `mime_type text null`
- `file_name text null`
- `file_size_bytes bigint null`
- `media_width integer null`
- `media_height integer null`
- `media_duration_seconds numeric(10,3) null`
- `aspect_ratio_label text null`
- `has_alpha boolean not null default false`
- `sha256 text null`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

File roles:

- `input`
- `output`
- `thumbnail`

### `library_items`

Rows that appear in the gallery.

- `id uuid primary key`
- `workspace_id uuid not null references workspaces(id)`
- `folder_id uuid null references folders(id) on delete set null`
- `primary_run_file_id uuid null references run_files(id) on delete set null`
- `thumbnail_run_file_id uuid null references run_files(id) on delete set null`
- `source_run_id uuid null references generation_runs(id) on delete set null`
- `title text not null`
- `kind text not null`
- `source text not null`
- `role text not null`
- `status text not null`
- `model_id text null`
- `provider text not null`
- `prompt text not null default ''`
- `meta text not null default ''`
- `content_text text null`
- `file_name text null`
- `mime_type text null`
- `byte_size bigint null`
- `media_width integer null`
- `media_height integer null`
- `media_duration_seconds numeric(10,3) null`
- `aspect_ratio_label text null`
- `has_alpha boolean not null default false`
- `error_message text null`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Notes:

- No `folder_items` join table.
- No `folder_ids[]`.
- Thumbnail and source file references are explicit.
- URLs are derived at read time, not stored in the database.

### `model_price_cards`

Manual hosted pricing source of truth.

- `id uuid primary key`
- `model_id text not null`
- `is_active boolean not null default true`
- `pricing_version integer not null`
- `pricing_rules jsonb not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Notes:

- Keep the pricing logic data-driven so product pricing does not require code deploys.
- `pricing_rules` should encode only the supported inputs in the UI.

## Indexes

These should exist from day one:

- `folders_workspace_sort_idx on folders (workspace_id, sort_order)`
- `library_items_workspace_created_idx on library_items (workspace_id, created_at desc)`
- `library_items_workspace_folder_created_idx on library_items (workspace_id, folder_id, created_at desc)`
- `generation_runs_workspace_created_idx on generation_runs (workspace_id, created_at desc)`
- `generation_runs_workspace_queue_idx on generation_runs (workspace_id, status, queue_entered_at asc)`
- `generation_runs_dispatch_idx on generation_runs (status, dispatch_lease_expires_at, queue_entered_at asc)`
- `generation_run_inputs_run_role_idx on generation_run_inputs (run_id, input_role, sort_order)`
- `run_files_workspace_created_idx on run_files (workspace_id, created_at desc)`
- `credit_ledger_entries_workspace_created_idx on credit_ledger_entries (workspace_id, created_at desc)`

Recommended partial index:

- `generation_runs_active_idx on generation_runs (workspace_id, queue_entered_at asc) where status in ('queued', 'pending', 'processing')`

## Fetching Strategy

### Initial hosted bootstrap

Use one server-owned bootstrap request that returns:

- workspace profile
- credit balance
- active price card metadata
- enabled models
- folders
- first gallery page
- active runs
- revision cursor

Do not include:

- current prompt draft
- current selected model
- gallery zoom level
- local API key state
- selection mode state

### Pagination

Use cursor pagination for gallery/history reads:

- order by `created_at desc, id desc`
- page library items separately from run queue if needed
- only fetch the selected folder slice when the user opens a folder

### Derived URLs

Do not store resolved URLs in Postgres.

Instead:

- store `storage_bucket` + `storage_path` on `run_files`
- derive public or signed URLs on the server
- hydrate the gallery payload with resolved URLs only when responding to the client

## Caching Strategy

### Next.js 16

Use server caching only for mostly-static data:

- curated model catalog
- active price cards
- provider capability metadata

Do not cache user workspace data across requests.

Recommended split:

- user data: dynamic, `no-store`
- model/pricing metadata: cached on the server with tag-based invalidation

### Client caching

Hosted mode should keep:

- last applied revision
- local optimistic state
- minimal in-memory slices for visible lists

Local mode should keep:

- full workspace snapshot in browser storage
- uploaded blobs in IndexedDB

## Realtime Strategy

For the real backend, do not rely on Postgres Changes for the main product feed at scale.

Use:

- Supabase Realtime Broadcast
- private per-workspace topic, for example `workspace:<workspace_id>`

Broadcast compact events such as:

- `run.created`
- `run.started`
- `run.completed`
- `run.failed`
- `run.cancelled`
- `item.created`
- `item.updated`
- `item.deleted`
- `folder.created`
- `folder.updated`
- `folder.deleted`
- `folders.reordered`
- `credits.updated`
- `models.updated`

Client behavior:

1. Receive event
2. If the event contains enough data, patch local state
3. If not, refetch the affected slice only

Do not rebroadcast or refetch the full workspace on every change.

## Queue Strategy

The backend queue should remain simple:

- `generation_runs` is the queue
- queued rows are claimed using transactional leasing
- the dispatcher only moves rows from `queued` to `processing`
- completion webhooks or jobs finalize rows to `completed` or `failed`

Fairness:

- scheduler maintains the 100-job per-user cap
- scheduler enforces global provider slot limits
- available provider slots are distributed fairly across users with active queued work
- queued jobs can be cancelled
- processing jobs cannot be cancelled from the product UI

Implementation guidance:

- claim rows with `for update skip locked`
- keep `dispatch_lease_expires_at`
- recover abandoned leases with a sweeper task

## Thumbnail Strategy

Every non-text asset needs a thumbnail row in `run_files`.

### Images

- source file stays original
- thumbnail is a smaller derived image
- transparent images should get a checkerboard-composited thumbnail

### Videos

- source file stays original
- thumbnail is a still image
- store width, height, duration, and aspect ratio on both source and thumbnail metadata where useful

### Audio

- source file stays original
- thumbnail is a generated image
- store duration on the source file row

### Storage layout

Recommended buckets:

- `library-source`
- `library-thumbnails`
- `run-inputs`

Recommended path shape:

- `workspace/<workspace_id>/items/<library_item_id>/source/<file_id>.<ext>`
- `workspace/<workspace_id>/items/<library_item_id>/thumbnail/<file_id>.webp`
- `workspace/<workspace_id>/runs/<run_id>/inputs/<file_id>.<ext>`

## Security

- Enable RLS on every public table.
- Use the anon key only from the client.
- Keep the service role on the server only.
- Protect storage with RLS on `storage.objects`.
- Prefer user-scoped or workspace-scoped policies.
- Keep all mutation authority server-side for credits, queue dispatch, and pricing.

## What To Avoid

- no `folder_items` join table for single-folder membership
- no duplicated `preview_url` and `thumbnail_url` columns in Postgres
- no client-owned credit calculations as source of truth
- no full workspace snapshot polling as the long-term realtime model
- no Postgres Changes subscriptions for every visible table as the main hosted sync path
- no workflow/actor/project-era schema carryover

## Recommended Build Order

1. Create the Supabase schema above with migrations.
2. Implement a single bootstrap read path.
3. Implement storage upload + thumbnail creation.
4. Implement `generation_runs` dispatch and completion flow.
5. Add Broadcast events on the workspace topic.
6. Replace hosted mock sync polling with Broadcast-driven updates.
