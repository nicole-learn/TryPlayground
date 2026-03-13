# TryPlayground Local Backend Architecture

This document defines the zero-config local backend for TryPlayground.

The product goal is:

- a user downloads or opens TryPlayground on their computer
- there is no cloud or deployment setup required
- there is no local database setup required
- they add a Fal API key and can immediately use the app
- all local data persists cleanly across refreshes and restarts

This document replaces the current browser-storage mock approach as the long-term local architecture.

## Core Principles

1. Local mode must work without Supabase, Docker, or any external database.
2. Local mode should mirror the hosted domain model as closely as possible.
3. Local mode must persist on disk, not mainly in `localStorage`.
4. Local mode must keep non-text files on the filesystem, not in the database.
5. Local mode must be single-user and simple.
6. Local mode must be recoverable after crashes and app restarts.

## Chosen Local Stack

### Runtime

- Next.js route handlers on the Node.js runtime
- server-only local backend modules under `src/server/local`

Why:

- it keeps the frontend identical to hosted mode
- it gives access to filesystem APIs
- it lets local mode and hosted mode share the same frontend contracts

Relevant official guidance:

- Next.js route handlers run in the App Router and support the Node runtime for filesystem-backed server logic: [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

### Database

- SQLite file database
- recommended driver: `better-sqlite3`

Why:

- zero external setup
- fast local reads and writes
- simple backup and migration story
- stable and well-understood

We should not standardize on `node:sqlite` yet for this product baseline because the official Node docs still mark it as active development / release-candidate territory rather than fully mature stable infrastructure:

- [Node.js SQLite docs](https://nodejs.org/download/release/v22.17.0/docs/api/sqlite.html)

### File Storage

- local filesystem object store
- source media and thumbnails stored as real files on disk

Why:

- avoids bloating SQLite with blobs
- keeps file serving simple and fast
- matches the hosted `run_files` shape closely

### Secret Storage

- preferred: OS keychain
- fallback for unsupported environments: session-only in-memory secret store

Important:

- Fal API keys should not be stored in SQLite.
- Fal API keys should not be stored in plain JSON on disk.

## What Replaces The Current Browser Storage

The current local mode uses:

- `localStorage` for workspace snapshot
- `sessionStorage` for Fal key
- IndexedDB for uploaded blobs

That is acceptable as a mock. It is not the long-term local backend.

The real local backend should move to:

- SQLite for structured domain data
- filesystem for real files
- OS keychain for secrets
- small local preferences table for device-specific UI state

The browser should become just a client of the local backend, even when the backend runs in the same app process.

## Local Session Persistence

Local mode does not use login sessions in the hosted sense.

Instead, it uses a persistent local installation identity.

### On first launch

The app should automatically create:

- one local installation record
- one local workspace
- one local profile
- one local preferences row
- the local data directory if it does not already exist

### On later launches

The app should reopen the same local installation and workspace automatically.

That means:

- folders remain
- uploads remain
- generated assets remain
- run history remains
- enabled models remain
- local preferences remain

### Fal key behavior

Recommended behavior:

- packaged app or supported desktop environment: persist Fal key in OS keychain
- unsupported environment: session-only fallback, with explicit UI message

This keeps the default user experience simple without lowering the security bar.

## Local Data Directory

The app should create a single app-data root automatically.

### Recommended OS paths

- macOS: `~/Library/Application Support/TryPlayground`
- Windows: `%AppData%/TryPlayground`
- Linux: `${XDG_DATA_HOME:-~/.local/share}/TryPlayground`

### Recommended on-disk layout

```text
TryPlayground/
  db/
    local.sqlite
    local.sqlite-wal
    local.sqlite-shm
  storage/
    items/
      <library_item_id>/
        source/
          <run_file_id>.<ext>
        thumbnail/
          <run_file_id>.webp
    runs/
      <run_id>/
        inputs/
          <run_file_id>.<ext>
    temp/
      uploads/
      thumbnails/
      transcodes/
  logs/
    app.log
  cache/
    previews/
  version.json
```

Rules:

- source files are immutable once written
- thumbnails are immutable once written
- temp files are written first, then atomically renamed into place
- paths should be derived from IDs, not titles

## Recommended Repo Layout

```text
src/
  app/
    api/
      studio/
        local/
          bootstrap/route.ts
          sync/route.ts
          mutate/route.ts
          uploads/route.ts
          files/[fileId]/route.ts
          events/route.ts
  server/
    local/
      config/
        local-config.ts
        local-paths.ts
      db/
        local-db.ts
        local-db-pragmas.ts
        local-db-migrate.ts
        migrations/
      files/
        local-file-store.ts
        local-file-serve.ts
        local-thumbnail-paths.ts
      queue/
        local-queue-dispatcher.ts
        local-queue-recovery.ts
        local-queue-events.ts
      thumbnails/
        image-thumbnail.ts
        video-thumbnail.ts
        audio-thumbnail.ts
        thumbnail-jobs.ts
      secrets/
        local-secret-store.ts
        keychain-secret-store.ts
        memory-secret-store.ts
      repositories/
        workspace-repository.ts
        folder-repository.ts
        library-item-repository.ts
        run-file-repository.ts
        generation-run-repository.ts
      service/
        local-bootstrap-service.ts
        local-sync-service.ts
        local-mutation-service.ts
        local-upload-service.ts
        local-generation-service.ts
```

## Recommended Local Schema

Local mode should reuse the hosted shape wherever possible.

### Shared domain tables

- `workspaces`
- `folders`
- `generation_runs`
- `generation_run_inputs`
- `run_files`
- `library_items`

These should use the same columns and semantics as the hosted schema where practical.

### Local-only tables

#### `installation_state`

Single-row table.

- `installation_id text primary key`
- `workspace_id text not null`
- `current_revision integer not null`
- `created_at text not null`
- `updated_at text not null`

Purpose:

- local identity
- monotonic revision cursor for sync/events

#### `local_preferences`

Single-row or one-row-per-workspace table.

- `workspace_id text primary key`
- `selected_model_id text not null`
- `gallery_size_level integer not null`
- `last_opened_folder_id text null`
- `updated_at text not null`

Purpose:

- device-local UI state that should persist across restarts
- this stays separate from the core domain tables

#### `provider_connections`

No secret material stored here.

- `workspace_id text primary key`
- `provider text not null`
- `connection_status text not null`
- `last_validated_at text null`
- `updated_at text not null`

Purpose:

- non-secret provider metadata only

### Not needed in local mode

- `profiles` tied to auth users
- `credit_accounts`
- `credit_ledger_entries`
- hosted billing tables

## SQLite Configuration

Recommended pragmas on database open:

- `journal_mode = WAL`
- `foreign_keys = ON`
- `synchronous = NORMAL`
- `temp_store = MEMORY`
- `busy_timeout = 5000`

Why:

- WAL gives better read/write behavior
- foreign keys keep the local store trustworthy
- busy timeout avoids flaky lock failures

## Fetching Strategy

Local mode should use the same frontend shape as hosted mode:

1. bootstrap
2. mutations
3. incremental sync
4. file fetches
5. event stream

### Bootstrap

`GET /api/studio/local/bootstrap`

Returns:

- domain state for the workspace
- local UI preference defaults
- current revision

### Incremental sync

`GET /api/studio/local/sync?sinceRevision=<n>`

Returns:

- `noop` if nothing changed
- otherwise the changed state slice or the latest consistent local snapshot

This mirrors the hosted revision-based sync model.

### Mutations

`POST /api/studio/local/mutate`

Used for:

- folder CRUD
- folder reorder
- text note creation and editing
- enabled model updates
- generation enqueue
- queue cancel
- item moves and deletes

### Uploads

`POST /api/studio/local/uploads`

Used for:

- storing source files on disk
- extracting media metadata
- creating `run_files`
- creating `library_items`
- creating or scheduling thumbnails

### Files

`GET /api/studio/local/files/[fileId]`

Used for:

- serving source files
- serving thumbnails

These responses should use immutable cache headers because the files are content-addressed by ID.

## Realtime Rendering In Local Mode

Local mode should not depend on polling once the real local backend exists.

Recommended approach:

- Server-Sent Events from `GET /api/studio/local/events`

Why SSE here:

- simpler than WebSockets
- enough for one local client
- works well for queue state changes

Event types:

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
- `models.updated`

The frontend should still keep the revision cursor and be able to re-sync if the event stream drops.

## Local Queue Design

Local mode is single-user, so the queue can be much simpler than hosted mode.

### Rules

- maximum 100 active queued + processing jobs
- default local concurrency limit: `3`
- queued jobs can be cancelled
- processing jobs cannot be cancelled from the product UI

### Dispatcher behavior

- dispatcher lives in the local Node process
- it reads queued rows from SQLite
- it claims rows by setting `status = processing`
- it sets `dispatch_lease_expires_at`
- it calls Fal
- it finalizes the run on completion or failure

### Recovery behavior

On app startup:

- any `processing` rows with expired lease are reset to `queued`
- any orphaned temp files are cleaned up
- any missing thumbnails are requeued

### Why SQLite-backed queue state matters

It means:

- restarts do not lose queue state
- app crashes do not orphan the whole local workspace
- the UI can always reconstruct the truth from disk

## Thumbnail Pipeline

Every non-text asset must have a thumbnail.

### Images

- keep original source file
- create a smaller derived thumbnail
- if `has_alpha = true`, generate a checkerboard-composited thumbnail

Recommended tooling:

- `sharp`

### Videos

- keep original source file
- extract poster frame
- generate a still thumbnail
- store `media_width`, `media_height`, `media_duration_seconds`, `aspect_ratio_label`

Recommended tooling:

- bundled ffmpeg binary, not a user-installed system ffmpeg

### Audio

- keep original source file
- generate a thumbnail image from metadata and optionally waveform data
- store `media_duration_seconds`

Recommended first implementation:

- generated branded waveform-style thumbnail image

This is simpler and more reliable than requiring a full waveform extractor on day one.

## Local Generation Flow

1. User submits a generation.
2. Local mutation validates:
   - Fal key available
   - model enabled
   - active queue limit not exceeded
3. A `generation_runs` row is created as `queued`.
4. Input references are written into `generation_run_inputs`.
5. The dispatcher claims jobs up to the local concurrency limit.
6. Fal output is downloaded to the local file store.
7. `run_files` rows are created for source and thumbnail.
8. `library_items` row is created or updated.
9. SSE event and revision bump notify the frontend.

## Secrets And API Keys

Recommended abstraction:

- `LocalSecretStore`

Implementations:

- `KeychainSecretStore`
- `MemorySecretStore`

Behavior:

- packaged app and supported desktop environments use keychain storage
- unsupported environments can fall back to in-memory session storage
- the rest of the app never talks to the keychain directly

This keeps the architecture clean and future-proof.

## Why We Should Not Keep The Current Local Mock Storage As The Real Local Backend

Browser storage is weak for this product because:

- large asset libraries are harder to manage
- blob rehydration is fragile
- queue recovery after crashes is weak
- files are not naturally accessible on disk
- importing/exporting projects becomes more awkward

Browser storage should only remain as:

- a temporary mock layer
- or a migration source

## Migration Plan From Current Local Mock Mode

On first launch of the new local backend:

1. Check whether old browser snapshot data exists.
2. If it exists, offer one-time import.
3. Import:
   - folders
   - text items
   - library items
   - run history
   - enabled models
   - local preferences
4. Rehydrate uploaded blobs from IndexedDB into real local files.
5. Generate thumbnails where missing.
6. Mark migration complete.

After that, the browser snapshot is no longer the source of truth.

## Final Recommendation

For zero-config local mode, the product should move to:

- SQLite for metadata
- local filesystem for source files and thumbnails
- OS keychain for Fal API keys
- SSE + revision-based sync for UI updates
- shared domain schema with hosted mode

This is the simplest local architecture that is:

- durable
- performant
- understandable
- easy to scale the codebase around
- easy to keep in parity with the hosted product
