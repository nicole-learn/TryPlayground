import fs from "node:fs";
import { promises as fsPromises } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { createAudioThumbnailUrl } from "@/features/studio/studio-asset-thumbnails";
import {
  canGenerateWithDraft,
  getStudioConcurrencyLimitForMode,
  getStudioRunCompletionDelayMs,
  resolveStudioGenerationRequestMode,
  shouldStudioMockRunFail,
} from "@/features/studio/studio-generation-rules";
import type {
  LocalStudioMutation,
  LocalStudioUploadManifestEntry,
} from "@/features/studio/studio-local-api";
import {
  buildStudioWorkspaceSnapshot,
} from "@/features/studio/studio-runtime-snapshot";
import {
  createDraft,
  createGeneratedLibraryItem,
  createGenerationRunPreviewUrl,
  createGenerationRunSummary,
  createRunFile,
  createStudioId,
  createStudioSeedSnapshot,
  hydrateDraft,
  STUDIO_STATE_SCHEMA_VERSION,
  toPersistedDraft,
} from "@/features/studio/studio-local-runtime-data";
import {
  normalizeStudioEnabledModelIds,
} from "@/features/studio/studio-model-configuration";
import { getStudioModelById } from "@/features/studio/studio-model-catalog";
import { quoteStudioDraftPricing } from "@/features/studio/studio-model-pricing";
import {
  getStudioUploadedMediaKind,
  studioUploadSupportsAlpha,
} from "@/features/studio/studio-upload-files";
import type {
  GenerationRun,
  LibraryItem,
  StudioFolder,
  StudioRunFile,
  StudioWorkspaceSnapshot,
} from "@/features/studio/types";
import {
  ensureLocalDataDirectories,
  getLocalDatabasePath,
  getLocalItemSourceDirectory,
  getLocalItemThumbnailDirectory,
  getLocalStorageRoot,
} from "./local-paths";

type LocalStore = {
  db: Database.Database;
  revision: number;
  snapshot: StudioWorkspaceSnapshot;
  dispatchTimers: Map<string, ReturnType<typeof setTimeout>>;
  completionTimers: Map<string, ReturnType<typeof setTimeout>>;
};

type LocalFileRecord = {
  absolutePath: string;
  fileName: string | null;
  mimeType: string | null;
};

type LocalStoreBootstrap = {
  revision: number;
  snapshot: StudioWorkspaceSnapshot;
};

const STORE_KEY = "__TRYPLAYGROUND_LOCAL_STORE__";
const LOCAL_SYNC_INTERVAL_MS = 1200;

type WorkspaceRow = {
  id: string;
  mode: "local";
  profile_json: string;
  credit_balance_json: string | null;
  active_credit_pack_json: string | null;
  model_configuration_json: string;
  queue_settings_json: string;
  created_at: string;
  updated_at: string;
};

type PreferencesRow = {
  workspace_id: string;
  drafts_by_model_id_json: string;
  selected_model_id: string;
  gallery_size_level: number;
  provider_last_validated_at: string | null;
  updated_at: string;
};

type InstallationRow = {
  installation_id: string;
  workspace_id: string;
  current_revision: number;
  created_at: string;
  updated_at: string;
};

function cloneSnapshot(snapshot: StudioWorkspaceSnapshot) {
  return structuredClone(snapshot);
}

function parseJson<T>(value: string | null, fallback: T) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function serializeJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

function buildLocalFileUrl(fileId: string) {
  return `/api/studio/local/files/${encodeURIComponent(fileId)}`;
}

function getFileExtension(fileName: string) {
  const extension = path.extname(fileName).trim().toLowerCase();
  return extension || "";
}

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)?(;charset=[^;,]+)?(;base64)?,(.*)$/);
  if (!match) {
    throw new Error("Invalid data URL.");
  }

  const content = match[4] ?? "";
  const isBase64 = Boolean(match[3]);
  return isBase64
    ? Buffer.from(content, "base64")
    : Buffer.from(decodeURIComponent(content), "utf8");
}

function ensureParentDirectory(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function createAudioThumbnailFile(params: {
  itemId: string;
  title: string;
  subtitle: string;
  accentSeed: string;
  thumbnailRunFileId: string;
}) {
  const dataUrl = createAudioThumbnailUrl({
    title: params.title,
    subtitle: params.subtitle,
    accentSeed: params.accentSeed,
  });
  const buffer = decodeDataUrl(dataUrl);
  const relativePath = path
    .join("items", params.itemId, "thumbnail", `${params.thumbnailRunFileId}.svg`)
    .replaceAll(path.sep, "/");
  const absolutePath = path.join(getLocalStorageRoot(), relativePath);

  ensureParentDirectory(absolutePath);
  fs.writeFileSync(absolutePath, buffer);

  return {
    absolutePath,
    relativePath,
  };
}

function getLocalFileAbsolutePath(storagePath: string) {
  return path.join(getLocalStorageRoot(), storagePath);
}

function createTables(db: Database.Database) {
  db.exec(`
    create table if not exists installation_state (
      installation_id text primary key,
      workspace_id text not null,
      current_revision integer not null,
      created_at text not null,
      updated_at text not null
    );

    create table if not exists workspaces (
      id text primary key,
      mode text not null,
      profile_json text not null,
      credit_balance_json text,
      active_credit_pack_json text,
      model_configuration_json text not null,
      queue_settings_json text not null,
      created_at text not null,
      updated_at text not null
    );

    create table if not exists local_preferences (
      workspace_id text primary key,
      drafts_by_model_id_json text not null,
      selected_model_id text not null,
      gallery_size_level integer not null,
      provider_last_validated_at text,
      updated_at text not null
    );

    create table if not exists folders (
      id text primary key,
      user_id text not null,
      workspace_id text not null,
      name text not null,
      created_at text not null,
      updated_at text not null,
      sort_order integer not null
    );

    create table if not exists run_files (
      id text primary key,
      run_id text,
      user_id text not null,
      file_role text not null,
      source_type text not null,
      storage_bucket text not null,
      storage_path text not null,
      mime_type text,
      file_name text,
      file_size_bytes integer,
      media_width integer,
      media_height integer,
      media_duration_seconds real,
      aspect_ratio_label text,
      has_alpha integer not null,
      metadata_json text not null,
      created_at text not null
    );

    create table if not exists library_items (
      id text primary key,
      user_id text not null,
      workspace_id text not null,
      run_file_id text,
      source_run_id text,
      title text not null,
      kind text not null,
      source text not null,
      role text not null,
      content_text text,
      created_at text not null,
      updated_at text not null,
      model_id text,
      run_id text,
      provider text not null,
      status text not null,
      prompt text not null,
      meta text not null,
      media_width integer,
      media_height integer,
      media_duration_seconds real,
      aspect_ratio_label text,
      has_alpha integer not null,
      folder_id text,
      storage_bucket text not null,
      storage_path text,
      thumbnail_path text,
      file_name text,
      mime_type text,
      byte_size integer,
      metadata_json text not null,
      error_message text
    );

    create table if not exists generation_runs (
      id text primary key,
      user_id text not null,
      workspace_id text not null,
      folder_id text,
      model_id text not null,
      model_name text not null,
      kind text not null,
      provider text not null,
      request_mode text not null,
      status text not null,
      prompt text not null,
      created_at text not null,
      queue_entered_at text not null,
      started_at text,
      completed_at text,
      failed_at text,
      cancelled_at text,
      updated_at text not null,
      summary text not null,
      output_asset_id text,
      preview_url text,
      error_message text,
      input_payload_json text not null,
      input_settings_json text not null,
      provider_request_id text,
      provider_status text,
      estimated_cost_usd real,
      actual_cost_usd real,
      estimated_credits real,
      actual_credits real,
      usage_snapshot_json text not null,
      output_text text,
      pricing_snapshot_json text not null,
      dispatch_attempt_count integer not null,
      dispatch_lease_expires_at text,
      can_cancel integer not null,
      draft_snapshot_json text not null
    );

    create index if not exists folders_workspace_sort_idx on folders (workspace_id, sort_order);
    create index if not exists library_items_workspace_folder_created_idx on library_items (workspace_id, folder_id, created_at desc);
    create index if not exists generation_runs_workspace_status_queue_idx on generation_runs (workspace_id, status, queue_entered_at asc);
  `);
}

function persistSnapshot(db: Database.Database, revision: number, snapshot: StudioWorkspaceSnapshot) {
  const tx = db.transaction(() => {
    db.prepare("delete from installation_state").run();
    db.prepare("delete from workspaces").run();
    db.prepare("delete from local_preferences").run();
    db.prepare("delete from folders").run();
    db.prepare("delete from run_files").run();
    db.prepare("delete from library_items").run();
    db.prepare("delete from generation_runs").run();

    db.prepare(
      `
        insert into installation_state (
          installation_id, workspace_id, current_revision, created_at, updated_at
        ) values (?, ?, ?, ?, ?)
      `
    ).run(
      "local-installation",
      snapshot.profile.preferences.workspaceId as string | undefined ?? snapshot.folders[0]?.workspaceId ?? "workspace-local",
      revision,
      snapshot.profile.createdAt,
      new Date().toISOString()
    );

    db.prepare(
      `
        insert into workspaces (
          id, mode, profile_json, credit_balance_json, active_credit_pack_json,
          model_configuration_json, queue_settings_json, created_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    ).run(
      snapshot.folders[0]?.workspaceId ?? "workspace-local",
      "local",
      serializeJson(snapshot.profile),
      serializeJson(snapshot.creditBalance),
      serializeJson(snapshot.activeCreditPack),
      serializeJson(snapshot.modelConfiguration),
      serializeJson(snapshot.queueSettings),
      snapshot.profile.createdAt,
      new Date().toISOString()
    );

    db.prepare(
      `
        insert into local_preferences (
          workspace_id, drafts_by_model_id_json, selected_model_id, gallery_size_level,
          provider_last_validated_at, updated_at
        ) values (?, ?, ?, ?, ?, ?)
      `
    ).run(
      snapshot.folders[0]?.workspaceId ?? "workspace-local",
      serializeJson(snapshot.draftsByModelId),
      snapshot.selectedModelId,
      snapshot.gallerySizeLevel,
      snapshot.providerSettings.lastValidatedAt,
      new Date().toISOString()
    );

    const insertFolder = db.prepare(
      `
        insert into folders (
          id, user_id, workspace_id, name, created_at, updated_at, sort_order
        ) values (?, ?, ?, ?, ?, ?, ?)
      `
    );
    for (const folder of snapshot.folders) {
      insertFolder.run(
        folder.id,
        folder.userId,
        folder.workspaceId,
        folder.name,
        folder.createdAt,
        folder.updatedAt,
        folder.sortOrder
      );
    }

    const insertRunFile = db.prepare(
      `
        insert into run_files (
          id, run_id, user_id, file_role, source_type, storage_bucket, storage_path,
          mime_type, file_name, file_size_bytes, media_width, media_height,
          media_duration_seconds, aspect_ratio_label, has_alpha, metadata_json, created_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    );
    for (const runFile of snapshot.runFiles) {
      insertRunFile.run(
        runFile.id,
        runFile.runId,
        runFile.userId,
        runFile.fileRole,
        runFile.sourceType,
        runFile.storageBucket,
        runFile.storagePath,
        runFile.mimeType,
        runFile.fileName,
        runFile.fileSizeBytes,
        runFile.mediaWidth,
        runFile.mediaHeight,
        runFile.mediaDurationSeconds,
        runFile.aspectRatioLabel,
        runFile.hasAlpha ? 1 : 0,
        serializeJson(runFile.metadata),
        runFile.createdAt
      );
    }

    const insertItem = db.prepare(
      `
        insert into library_items (
          id, user_id, workspace_id, run_file_id, source_run_id, title, kind, source,
          role, content_text, created_at, updated_at, model_id, run_id, provider,
          status, prompt, meta, media_width, media_height, media_duration_seconds,
          aspect_ratio_label, has_alpha, folder_id, storage_bucket, storage_path,
          thumbnail_path, file_name, mime_type, byte_size, metadata_json, error_message
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    );
    for (const item of snapshot.libraryItems) {
      insertItem.run(
        item.id,
        item.userId,
        item.workspaceId,
        item.runFileId,
        item.sourceRunId,
        item.title,
        item.kind,
        item.source,
        item.role,
        item.contentText,
        item.createdAt,
        item.updatedAt,
        item.modelId,
        item.runId,
        item.provider,
        item.status,
        item.prompt,
        item.meta,
        item.mediaWidth,
        item.mediaHeight,
        item.mediaDurationSeconds,
        item.aspectRatioLabel,
        item.hasAlpha ? 1 : 0,
        item.folderId,
        item.storageBucket,
        item.storagePath,
        item.thumbnailPath,
        item.fileName,
        item.mimeType,
        item.byteSize,
        serializeJson(item.metadata),
        item.errorMessage
      );
    }

    const insertRun = db.prepare(
      `
        insert into generation_runs (
          id, user_id, workspace_id, folder_id, model_id, model_name, kind, provider,
          request_mode, status, prompt, created_at, queue_entered_at, started_at,
          completed_at, failed_at, cancelled_at, updated_at, summary, output_asset_id,
          preview_url, error_message, input_payload_json, input_settings_json,
          provider_request_id, provider_status, estimated_cost_usd, actual_cost_usd,
          estimated_credits, actual_credits, usage_snapshot_json, output_text,
          pricing_snapshot_json, dispatch_attempt_count, dispatch_lease_expires_at,
          can_cancel, draft_snapshot_json
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
    );
    for (const run of snapshot.generationRuns) {
      insertRun.run(
        run.id,
        run.userId,
        run.workspaceId,
        run.folderId,
        run.modelId,
        run.modelName,
        run.kind,
        run.provider,
        run.requestMode,
        run.status,
        run.prompt,
        run.createdAt,
        run.queueEnteredAt,
        run.startedAt,
        run.completedAt,
        run.failedAt,
        run.cancelledAt,
        run.updatedAt,
        run.summary,
        run.outputAssetId,
        run.previewUrl,
        run.errorMessage,
        serializeJson(run.inputPayload),
        serializeJson(run.inputSettings),
        run.providerRequestId,
        run.providerStatus,
        run.estimatedCostUsd,
        run.actualCostUsd,
        run.estimatedCredits,
        run.actualCredits,
        serializeJson(run.usageSnapshot),
        run.outputText,
        serializeJson(run.pricingSnapshot),
        run.dispatchAttemptCount,
        run.dispatchLeaseExpiresAt,
        run.canCancel ? 1 : 0,
        serializeJson(run.draftSnapshot)
      );
    }
  });

  tx();
}

function readSnapshotFromDb(db: Database.Database): LocalStoreBootstrap | null {
  const installation = db
    .prepare("select * from installation_state limit 1")
    .get() as InstallationRow | undefined;
  if (!installation) {
    return null;
  }

  const workspace = db
    .prepare("select * from workspaces limit 1")
    .get() as WorkspaceRow | undefined;
  const preferences = db
    .prepare("select * from local_preferences limit 1")
    .get() as PreferencesRow | undefined;

  if (!workspace || !preferences) {
    return null;
  }

  const folders = db
    .prepare("select * from folders order by sort_order asc, created_at asc")
    .all() as Array<{
    id: string;
    user_id: string;
    workspace_id: string;
    name: string;
    created_at: string;
    updated_at: string;
    sort_order: number;
  }>;

  const runFiles = db
    .prepare("select * from run_files order by created_at desc")
    .all() as Array<{
    id: string;
    run_id: string | null;
    user_id: string;
    file_role: StudioRunFile["fileRole"];
    source_type: StudioRunFile["sourceType"];
    storage_bucket: string;
    storage_path: string;
    mime_type: string | null;
    file_name: string | null;
    file_size_bytes: number | null;
    media_width: number | null;
    media_height: number | null;
    media_duration_seconds: number | null;
    aspect_ratio_label: string | null;
    has_alpha: number;
    metadata_json: string;
    created_at: string;
  }>;

  const items = db
    .prepare("select * from library_items order by created_at desc")
    .all() as Array<{
    id: string;
    user_id: string;
    workspace_id: string;
    run_file_id: string | null;
    source_run_id: string | null;
    title: string;
    kind: LibraryItem["kind"];
    source: LibraryItem["source"];
    role: LibraryItem["role"];
    content_text: string | null;
    created_at: string;
    updated_at: string;
    model_id: string | null;
    run_id: string | null;
    provider: LibraryItem["provider"];
    status: LibraryItem["status"];
    prompt: string;
    meta: string;
    media_width: number | null;
    media_height: number | null;
    media_duration_seconds: number | null;
    aspect_ratio_label: string | null;
    has_alpha: number;
    folder_id: string | null;
    storage_bucket: string;
    storage_path: string | null;
    thumbnail_path: string | null;
    file_name: string | null;
    mime_type: string | null;
    byte_size: number | null;
    metadata_json: string;
    error_message: string | null;
  }>;

  const runs = db
    .prepare("select * from generation_runs order by created_at desc")
    .all() as Array<{
    id: string;
    user_id: string;
    workspace_id: string;
    folder_id: string | null;
    model_id: string;
    model_name: string;
    kind: GenerationRun["kind"];
    provider: GenerationRun["provider"];
    request_mode: GenerationRun["requestMode"];
    status: GenerationRun["status"];
    prompt: string;
    created_at: string;
    queue_entered_at: string;
    started_at: string | null;
    completed_at: string | null;
    failed_at: string | null;
    cancelled_at: string | null;
    updated_at: string;
    summary: string;
    output_asset_id: string | null;
    preview_url: string | null;
    error_message: string | null;
    input_payload_json: string;
    input_settings_json: string;
    provider_request_id: string | null;
    provider_status: string | null;
    estimated_cost_usd: number | null;
    actual_cost_usd: number | null;
    estimated_credits: number | null;
    actual_credits: number | null;
    usage_snapshot_json: string;
    output_text: string | null;
    pricing_snapshot_json: string;
    dispatch_attempt_count: number;
    dispatch_lease_expires_at: string | null;
    can_cancel: number;
    draft_snapshot_json: string;
  }>;

  const snapshot = buildStudioWorkspaceSnapshot({
    activeCreditPack: parseJson(workspace.active_credit_pack_json, null),
    appMode: "local",
    creditBalance: parseJson(workspace.credit_balance_json, null),
    draftsByModelId: parseJson(preferences.drafts_by_model_id_json, {}),
    folders: folders.map((folder) => ({
      id: folder.id,
      userId: folder.user_id,
      workspaceId: folder.workspace_id,
      name: folder.name,
      createdAt: folder.created_at,
      updatedAt: folder.updated_at,
      sortOrder: folder.sort_order,
    })),
    gallerySizeLevel: preferences.gallery_size_level,
    items: items.map((item) => {
      const previewUrl =
        item.kind === "text"
          ? null
          : item.run_file_id
            ? buildLocalFileUrl(item.run_file_id)
            : item.storage_bucket === "mock-public" && item.storage_path
              ? item.storage_path.startsWith("/")
                ? item.storage_path
                : `/${item.storage_path}`
              : null;
      const thumbnailUrl =
        item.kind === "audio"
          ? item.thumbnail_path
            ? buildLocalFileUrl(item.thumbnail_path)
            : createAudioThumbnailUrl({
                title: item.title,
                subtitle: item.meta || "Audio asset",
                accentSeed: item.id,
              })
          : item.thumbnail_path
            ? buildLocalFileUrl(item.thumbnail_path)
            : previewUrl;

      return {
        id: item.id,
        userId: item.user_id,
        workspaceId: item.workspace_id,
        runFileId: item.run_file_id,
        sourceRunId: item.source_run_id,
        title: item.title,
        kind: item.kind,
        source: item.source,
        role: item.role,
        previewUrl,
        thumbnailUrl,
        contentText: item.content_text,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        modelId: item.model_id,
        runId: item.run_id,
        provider: item.provider,
        status: item.status,
        prompt: item.prompt,
        meta: item.meta,
        mediaWidth: item.media_width,
        mediaHeight: item.media_height,
        mediaDurationSeconds: item.media_duration_seconds,
        aspectRatioLabel: item.aspect_ratio_label,
        hasAlpha: item.has_alpha === 1,
        folderId: item.folder_id,
        folderIds: item.folder_id ? [item.folder_id] : [],
        storageBucket: item.storage_bucket,
        storagePath: item.storage_path,
        thumbnailPath: item.thumbnail_path,
        fileName: item.file_name,
        mimeType: item.mime_type,
        byteSize: item.byte_size,
        metadata: parseJson(item.metadata_json, {}),
        errorMessage: item.error_message,
      } satisfies LibraryItem;
    }),
    modelConfiguration: parseJson(workspace.model_configuration_json, {
      enabledModelIds: [],
      updatedAt: workspace.updated_at,
    }),
    profile: parseJson(workspace.profile_json, {
      id: "user-local",
      email: "local@tryplayground.ai",
      displayName: "Local Workspace",
      avatarLabel: "T",
      avatarUrl: null,
      preferences: {},
      createdAt: workspace.created_at,
      updatedAt: workspace.updated_at,
    }),
    providerSettings: {
      falApiKey: "",
      lastValidatedAt: preferences.provider_last_validated_at,
    },
    queueSettings: parseJson(workspace.queue_settings_json, {
      maxActiveJobsPerUser: 100,
      providerSlotLimit: 30,
      localConcurrencyLimit: 3,
      activeHostedUserCount: 0,
    }),
    runFiles: runFiles.map((runFile) => ({
      id: runFile.id,
      runId: runFile.run_id,
      userId: runFile.user_id,
      fileRole: runFile.file_role,
      sourceType: runFile.source_type,
      storageBucket: runFile.storage_bucket,
      storagePath: runFile.storage_path,
      mimeType: runFile.mime_type,
      fileName: runFile.file_name,
      fileSizeBytes: runFile.file_size_bytes,
      mediaWidth: runFile.media_width,
      mediaHeight: runFile.media_height,
      mediaDurationSeconds: runFile.media_duration_seconds,
      aspectRatioLabel: runFile.aspect_ratio_label,
      hasAlpha: runFile.has_alpha === 1,
      metadata: parseJson(runFile.metadata_json, {}),
      createdAt: runFile.created_at,
    })),
    runs: runs.map((run) => ({
      id: run.id,
      userId: run.user_id,
      workspaceId: run.workspace_id,
      folderId: run.folder_id,
      modelId: run.model_id,
      modelName: run.model_name,
      kind: run.kind,
      provider: run.provider,
      requestMode: run.request_mode,
      status: run.status,
      prompt: run.prompt,
      createdAt: run.created_at,
      queueEnteredAt: run.queue_entered_at,
      startedAt: run.started_at,
      completedAt: run.completed_at,
      failedAt: run.failed_at,
      cancelledAt: run.cancelled_at,
      updatedAt: run.updated_at,
      summary: run.summary,
      outputAssetId: run.output_asset_id,
      previewUrl: run.preview_url,
      errorMessage: run.error_message,
      inputPayload: parseJson(run.input_payload_json, {}),
      inputSettings: parseJson(run.input_settings_json, {}),
      providerRequestId: run.provider_request_id,
      providerStatus: run.provider_status,
      estimatedCostUsd: run.estimated_cost_usd,
      actualCostUsd: run.actual_cost_usd,
      estimatedCredits: run.estimated_credits,
      actualCredits: run.actual_credits,
      usageSnapshot: parseJson(run.usage_snapshot_json, {}),
      outputText: run.output_text,
      pricingSnapshot: parseJson(run.pricing_snapshot_json, {}),
      dispatchAttemptCount: run.dispatch_attempt_count,
      dispatchLeaseExpiresAt: run.dispatch_lease_expires_at,
      canCancel: run.can_cancel === 1,
      draftSnapshot: parseJson(run.draft_snapshot_json, {
        ...createDraft(getStudioModelById(run.model_id)),
        referenceCount: 0,
        startFrameCount: 0,
        endFrameCount: 0,
      }),
    })),
    selectedModelId: preferences.selected_model_id,
  });

  return {
    revision: installation.current_revision,
    snapshot,
  };
}

function createSeedState() {
  return {
    revision: 1,
    snapshot: createStudioSeedSnapshot("local"),
  };
}

function commitSnapshot(store: LocalStore, snapshot: StudioWorkspaceSnapshot, changedAt = new Date().toISOString()) {
  store.revision += 1;
  store.snapshot = {
    ...snapshot,
    schemaVersion: STUDIO_STATE_SCHEMA_VERSION,
    mode: "local",
    providerSettings: {
      falApiKey: "",
      lastValidatedAt: snapshot.providerSettings.lastValidatedAt,
    },
    profile: {
      ...snapshot.profile,
      updatedAt: changedAt,
    },
  };
  persistSnapshot(store.db, store.revision, store.snapshot);
}

function clearTimer(timer: ReturnType<typeof setTimeout> | undefined) {
  if (timer) {
    clearTimeout(timer);
  }
}

function scheduleDispatch(store: LocalStore, runId: string, delayMs = 280) {
  clearTimer(store.dispatchTimers.get(runId));
  const timer = setTimeout(() => {
    store.dispatchTimers.delete(runId);
    let shouldReschedule = false;
    const concurrencyLimit = getStudioConcurrencyLimitForMode(
      "local",
      store.snapshot.queueSettings
    );
    const processingCount = store.snapshot.generationRuns.filter(
      (run) => run.status === "processing"
    ).length;

    store.snapshot = {
      ...store.snapshot,
      generationRuns: store.snapshot.generationRuns.map((run) => {
        if (run.id !== runId || (run.status !== "queued" && run.status !== "pending")) {
          return run;
        }

        if (processingCount >= concurrencyLimit) {
          shouldReschedule = true;
          return run;
        }

        const startedAt = new Date().toISOString();
        return {
          ...run,
          status: "processing",
          startedAt,
          updatedAt: startedAt,
          providerRequestId: run.providerRequestId ?? `fal_mock_${run.id}`,
          providerStatus: "running",
          dispatchAttemptCount: run.dispatchAttemptCount + 1,
          canCancel: false,
        };
      }),
    };

    if (shouldReschedule) {
      scheduleDispatch(store, runId, 420);
      return;
    }

    commitSnapshot(store, store.snapshot);
    syncLocalQueue(store);
  }, delayMs);

  store.dispatchTimers.set(runId, timer);
}

function scheduleCompletion(store: LocalStore, runId: string) {
  clearTimer(store.completionTimers.get(runId));
  const run = store.snapshot.generationRuns.find((entry) => entry.id === runId);
  if (!run) {
    return;
  }

  const timer = setTimeout(() => {
    store.completionTimers.delete(runId);
    const latestRun = store.snapshot.generationRuns.find((entry) => entry.id === runId);
    if (!latestRun || latestRun.status !== "processing") {
      return;
    }

    const finishedAt = new Date().toISOString();
    if (shouldStudioMockRunFail(latestRun)) {
      store.snapshot = {
        ...store.snapshot,
        generationRuns: store.snapshot.generationRuns.map((entry) =>
          entry.id === runId
            ? {
                ...entry,
                status: "failed",
                providerStatus: "failed",
                completedAt: finishedAt,
                failedAt: finishedAt,
                updatedAt: finishedAt,
                canCancel: false,
                errorMessage:
                  "Mock Fal generation failed before an output asset was returned.",
              }
            : entry
        ),
      };
      commitSnapshot(store, store.snapshot, finishedAt);
      syncLocalQueue(store);
      return;
    }

    const model = getStudioModelById(latestRun.modelId);
    const draft = hydrateDraft(latestRun.draftSnapshot, model);
    const nextRunFileId = latestRun.kind === "text" ? null : createStudioId("run-file");
    const nextItem = createGeneratedLibraryItem({
      runFileId: nextRunFileId,
      sourceRunId: latestRun.id,
      model,
      draft,
      createdAt: finishedAt,
      folderId: latestRun.folderId,
      runId: latestRun.id,
      userId: latestRun.userId,
      workspaceId: latestRun.workspaceId,
    });
    const nextRunFile =
      nextRunFileId && nextItem.previewUrl
        ? createRunFile({
            id: nextRunFileId,
            runId: latestRun.id,
            userId: latestRun.userId,
            sourceType: "generated",
            fileRole: "output",
            previewUrl: nextItem.previewUrl,
            fileName: nextItem.fileName ?? `${latestRun.id}.bin`,
            mimeType: nextItem.mimeType || "application/octet-stream",
            mediaWidth: nextItem.mediaWidth,
            mediaHeight: nextItem.mediaHeight,
            mediaDurationSeconds: nextItem.mediaDurationSeconds,
            hasAlpha: nextItem.hasAlpha,
            createdAt: finishedAt,
          })
        : null;

    store.snapshot = {
      ...store.snapshot,
      libraryItems: [nextItem, ...store.snapshot.libraryItems],
      runFiles: nextRunFile ? [nextRunFile, ...store.snapshot.runFiles] : store.snapshot.runFiles,
      generationRuns: store.snapshot.generationRuns.map((entry) =>
        entry.id === runId
          ? {
              ...entry,
              status: "completed",
              providerStatus: "completed",
              outputAssetId: nextItem.id,
              actualCostUsd: entry.estimatedCostUsd,
              actualCredits: entry.estimatedCredits,
              completedAt: finishedAt,
              updatedAt: finishedAt,
              canCancel: false,
              outputText: nextItem.kind === "text" ? nextItem.contentText : null,
            }
          : entry
      ),
    };

    commitSnapshot(store, store.snapshot, finishedAt);
    syncLocalQueue(store);
  }, getStudioRunCompletionDelayMs(run));

  store.completionTimers.set(runId, timer);
}

function syncLocalQueue(store: LocalStore) {
  const queuedIds = new Set(
    store.snapshot.generationRuns
      .filter((run) => run.status === "queued" || run.status === "pending")
      .map((run) => run.id)
  );
  for (const [runId, timer] of store.dispatchTimers.entries()) {
    if (!queuedIds.has(runId)) {
      clearTimer(timer);
      store.dispatchTimers.delete(runId);
    }
  }

  const processingIds = new Set(
    store.snapshot.generationRuns
      .filter((run) => run.status === "processing")
      .map((run) => run.id)
  );
  for (const [runId, timer] of store.completionTimers.entries()) {
    if (!processingIds.has(runId)) {
      clearTimer(timer);
      store.completionTimers.delete(runId);
    }
  }

  for (const run of store.snapshot.generationRuns) {
    if ((run.status === "queued" || run.status === "pending") && !store.dispatchTimers.has(run.id)) {
      scheduleDispatch(store, run.id);
    }
    if (run.status === "processing" && !store.completionTimers.has(run.id)) {
      scheduleCompletion(store, run.id);
    }
  }
}

function recoverLocalQueue(
  snapshot: StudioWorkspaceSnapshot
): StudioWorkspaceSnapshot {
  return {
    ...snapshot,
    generationRuns: snapshot.generationRuns.map((run) =>
      run.status === "processing"
        ? {
            ...run,
            status: "queued",
            startedAt: null,
            providerStatus: "queued",
            canCancel: true,
          }
        : run
    ),
  };
}

function initializeStore(): LocalStore {
  ensureLocalDataDirectories();
  const db = new Database(getLocalDatabasePath());
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");
  db.pragma("temp_store = MEMORY");
  db.pragma("busy_timeout = 5000");
  createTables(db);

  const fromDisk = readSnapshotFromDb(db);
  const boot = fromDisk ?? createSeedState();
  const recoveredSnapshot = recoverLocalQueue(boot.snapshot);

  persistSnapshot(db, boot.revision, recoveredSnapshot);

  const store: LocalStore = {
    db,
    revision: boot.revision,
    snapshot: recoveredSnapshot,
    dispatchTimers: new Map(),
    completionTimers: new Map(),
  };
  syncLocalQueue(store);
  return store;
}

function getStore() {
  const globalStore = globalThis as typeof globalThis & {
    [STORE_KEY]?: LocalStore;
  };

  if (!globalStore[STORE_KEY]) {
    globalStore[STORE_KEY] = initializeStore();
  }

  return globalStore[STORE_KEY]!;
}

function cloneLocalResponse(store: LocalStore) {
  return {
    revision: store.revision,
    snapshot: cloneSnapshot(store.snapshot),
  };
}

function validateUploadManifest(files: File[], manifest: LocalStudioUploadManifestEntry[]) {
  if (files.length === 0 || files.length !== manifest.length) {
    throw new Error("Upload metadata did not match the provided files.");
  }

  return files.map((file, index) => {
    const metadata = manifest[index];
    const inferredKind = getStudioUploadedMediaKind({
      fileName: file.name,
      mimeType: file.type,
    });

    if (!metadata || !inferredKind || inferredKind !== metadata.kind) {
      throw new Error(`Unsupported upload: ${file.name}`);
    }

    return {
      file,
      metadata: {
        ...metadata,
        hasAlpha:
          metadata.kind === "image"
            ? metadata.hasAlpha || studioUploadSupportsAlpha(file.type)
            : false,
      },
    };
  });
}

export function getLocalBootstrapPayload() {
  const store = getStore();
  return {
    kind: "bootstrap" as const,
    revision: store.revision,
    syncIntervalMs: LOCAL_SYNC_INTERVAL_MS,
    snapshot: cloneSnapshot(store.snapshot),
  };
}

export function getLocalSyncPayload(sinceRevision: number | null) {
  const store = getStore();
  if (sinceRevision !== null && sinceRevision >= store.revision) {
    return {
      kind: "noop" as const,
      revision: store.revision,
      syncIntervalMs: LOCAL_SYNC_INTERVAL_MS,
    };
  }

  return {
    kind: sinceRevision === null ? ("bootstrap" as const) : ("refresh" as const),
    revision: store.revision,
    syncIntervalMs: LOCAL_SYNC_INTERVAL_MS,
    snapshot: cloneSnapshot(store.snapshot),
  };
}

export async function mutateLocalSnapshot(mutation: LocalStudioMutation) {
  const store = getStore();
  const snapshot = cloneSnapshot(store.snapshot);

  switch (mutation.action) {
    case "save_ui_state": {
      snapshot.draftsByModelId = mutation.draftsByModelId;
      snapshot.selectedModelId = mutation.selectedModelId;
      snapshot.gallerySizeLevel = mutation.gallerySizeLevel;
      snapshot.providerSettings = {
        falApiKey: "",
        lastValidatedAt: mutation.lastValidatedAt,
      };
      commitSnapshot(store, snapshot);
      return cloneLocalResponse(store);
    }
    case "set_enabled_models": {
      snapshot.modelConfiguration = {
        enabledModelIds: normalizeStudioEnabledModelIds(mutation.enabledModelIds),
        updatedAt: new Date().toISOString(),
      };
      break;
    }
    case "create_folder": {
      const createdAt = new Date().toISOString();
      const workspaceId = snapshot.folders[0]?.workspaceId ?? "workspace-local";
      const nextFolder: StudioFolder = {
        id: createStudioId("folder"),
        userId: snapshot.profile.id,
        workspaceId,
        name: mutation.name.trim(),
        createdAt,
        updatedAt: createdAt,
        sortOrder: 0,
      };
      snapshot.folders = [
        nextFolder,
        ...snapshot.folders.map((folder, index) => ({
          ...folder,
          sortOrder: index + 1,
        })),
      ];
      break;
    }
    case "rename_folder": {
      const updatedAt = new Date().toISOString();
      snapshot.folders = snapshot.folders.map((folder) =>
        folder.id === mutation.folderId
          ? { ...folder, name: mutation.name.trim(), updatedAt }
          : folder
      );
      break;
    }
    case "delete_folder": {
      const updatedAt = new Date().toISOString();
      snapshot.folders = snapshot.folders
        .filter((folder) => folder.id !== mutation.folderId)
        .map((folder, index) => ({ ...folder, sortOrder: index }));
      snapshot.libraryItems = snapshot.libraryItems.map((item) =>
        item.folderId === mutation.folderId
          ? { ...item, folderId: null, folderIds: [], updatedAt }
          : item
      );
      snapshot.generationRuns = snapshot.generationRuns.map((run) =>
        run.folderId === mutation.folderId ? { ...run, folderId: null } : run
      );
      break;
    }
    case "reorder_folders": {
      const updatedAt = new Date().toISOString();
      const folderMap = new Map(snapshot.folders.map((folder) => [folder.id, folder]));
      const ordered = mutation.orderedFolderIds
        .map((folderId) => folderMap.get(folderId))
        .filter((folder): folder is StudioFolder => Boolean(folder));
      const remaining = snapshot.folders.filter(
        (folder) => !mutation.orderedFolderIds.includes(folder.id)
      );
      snapshot.folders = [...ordered, ...remaining].map((folder, index) => ({
        ...folder,
        sortOrder: index,
        updatedAt,
      }));
      break;
    }
    case "move_items": {
      const updatedAt = new Date().toISOString();
      const itemIdSet = new Set(mutation.itemIds);
      snapshot.libraryItems = snapshot.libraryItems.map((item) =>
        itemIdSet.has(item.id)
          ? {
              ...item,
              folderId: mutation.folderId,
              folderIds: mutation.folderId ? [mutation.folderId] : [],
              updatedAt,
            }
          : item
      );
      break;
    }
    case "delete_items": {
      const itemIdSet = new Set(mutation.itemIds);
      const deletedItems = snapshot.libraryItems.filter((item) => itemIdSet.has(item.id));
      const deletedRunFileIds = new Set(
        deletedItems
          .flatMap((item) => [item.runFileId, item.thumbnailPath])
          .filter((value): value is string => Boolean(value))
      );

      snapshot.libraryItems = snapshot.libraryItems.filter((item) => !itemIdSet.has(item.id));
      snapshot.runFiles = snapshot.runFiles.filter((runFile) => !deletedRunFileIds.has(runFile.id));
      snapshot.generationRuns = snapshot.generationRuns.map((run) =>
        run.outputAssetId && itemIdSet.has(run.outputAssetId)
          ? { ...run, outputAssetId: null }
          : run
      );

      for (const runFileId of deletedRunFileIds) {
        const runFile = store.snapshot.runFiles.find((entry) => entry.id === runFileId);
        if (runFile?.storageBucket === "local-fs") {
          void fsPromises.unlink(getLocalFileAbsolutePath(runFile.storagePath)).catch(() => {});
        }
      }
      break;
    }
    case "update_text_item": {
      const updatedAt = new Date().toISOString();
      snapshot.libraryItems = snapshot.libraryItems.map((item) => {
        if (item.id !== mutation.itemId || item.kind !== "text") {
          return item;
        }
        const nextContentText = mutation.contentText?.trim() ?? item.contentText ?? "";
        return {
          ...item,
          title: mutation.title?.trim() || item.title,
          contentText: nextContentText,
          prompt: nextContentText,
          updatedAt,
        };
      });
      break;
    }
    case "create_text_item": {
      const createdAt = new Date().toISOString();
      const body = mutation.body.trim();
      snapshot.libraryItems = [
        {
          id: createStudioId("asset"),
          userId: snapshot.profile.id,
          workspaceId: snapshot.folders[0]?.workspaceId ?? "workspace-local",
          runFileId: null,
          sourceRunId: null,
          title: mutation.title.trim() || body.slice(0, 36) || "Text note",
          kind: "text",
          source: "uploaded",
          role: "text_note",
          previewUrl: null,
          thumbnailUrl: null,
          contentText: body,
          createdAt,
          updatedAt: createdAt,
          modelId: null,
          runId: null,
          provider: "fal",
          status: "ready",
          prompt: body,
          meta: "Text note",
          mediaWidth: null,
          mediaHeight: null,
          mediaDurationSeconds: null,
          aspectRatioLabel: null,
          hasAlpha: false,
          folderId: mutation.folderId,
          folderIds: mutation.folderId ? [mutation.folderId] : [],
          storageBucket: "inline-text",
          storagePath: null,
          thumbnailPath: null,
          fileName: `${createStudioId("text")}.txt`,
          mimeType: "text/plain",
          byteSize: body.length,
          metadata: {},
          errorMessage: null,
        },
        ...snapshot.libraryItems,
      ];
      break;
    }
    case "generate": {
      const model = getStudioModelById(mutation.modelId);
      const enabledModelIds = normalizeStudioEnabledModelIds(
        snapshot.modelConfiguration.enabledModelIds
      );
      if (!enabledModelIds.includes(model.id)) {
        throw new Error("That model is disabled for this workspace.");
      }

      const activeJobCount = snapshot.generationRuns.filter(
        (run) => run.status === "queued" || run.status === "pending" || run.status === "processing"
      ).length;
      if (activeJobCount >= snapshot.queueSettings.maxActiveJobsPerUser) {
        throw new Error(
          "limit of 100 concurrent queues/ generations reached, please wait for your generations to finish before continuing."
        );
      }

      const persistedDraft = {
        ...toPersistedDraft(createDraft(model)),
        ...mutation.draft,
      };
      const hydratedDraft = hydrateDraft(persistedDraft, model);
      if (!canGenerateWithDraft(model, hydratedDraft)) {
        throw new Error("This draft is missing required inputs.");
      }

      const pricingQuote = quoteStudioDraftPricing(model, persistedDraft);
      const createdAt = new Date().toISOString();
      snapshot.generationRuns = [
        {
          id: createStudioId("run"),
          userId: snapshot.profile.id,
          workspaceId: snapshot.folders[0]?.workspaceId ?? "workspace-local",
          folderId: mutation.folderId,
          modelId: model.id,
          modelName: model.name,
          kind: model.kind,
          provider: "fal",
          requestMode: resolveStudioGenerationRequestMode(model, hydratedDraft),
          status: "queued",
          prompt: persistedDraft.prompt,
          createdAt,
          queueEnteredAt: createdAt,
          startedAt: null,
          completedAt: null,
          failedAt: null,
          cancelledAt: null,
          updatedAt: createdAt,
          summary: createGenerationRunSummary(model, hydratedDraft),
          outputAssetId: null,
          previewUrl: createGenerationRunPreviewUrl(model, hydratedDraft),
          errorMessage: null,
          inputPayload: {
            prompt: persistedDraft.prompt,
            negative_prompt: persistedDraft.negativePrompt,
            reference_count: mutation.referenceCount,
            start_frame_count: mutation.startFrameCount,
            end_frame_count: mutation.endFrameCount,
            video_input_mode: persistedDraft.videoInputMode,
            request_mode: resolveStudioGenerationRequestMode(model, hydratedDraft),
          },
          inputSettings: {
            video_input_mode: persistedDraft.videoInputMode,
            aspect_ratio: persistedDraft.aspectRatio,
            resolution: persistedDraft.resolution,
            output_format: persistedDraft.outputFormat,
            duration_seconds: persistedDraft.durationSeconds,
            include_audio: persistedDraft.includeAudio,
            image_count: persistedDraft.imageCount,
            tone: persistedDraft.tone,
            max_tokens: persistedDraft.maxTokens,
            temperature: persistedDraft.temperature,
            voice: persistedDraft.voice,
            language: persistedDraft.language,
            speaking_rate: persistedDraft.speakingRate,
            start_frame_count: mutation.startFrameCount,
            end_frame_count: mutation.endFrameCount,
          },
          providerRequestId: null,
          providerStatus: "queued",
          estimatedCostUsd: pricingQuote.apiCostUsd,
          actualCostUsd: null,
          estimatedCredits: pricingQuote.billedCredits,
          actualCredits: null,
          usageSnapshot: {},
          outputText: null,
          pricingSnapshot: pricingQuote.pricingSnapshot,
          dispatchAttemptCount: 0,
          dispatchLeaseExpiresAt: null,
          canCancel: true,
          draftSnapshot: {
            ...persistedDraft,
            referenceCount: mutation.referenceCount,
            startFrameCount: mutation.startFrameCount,
            endFrameCount: mutation.endFrameCount,
          },
        },
        ...snapshot.generationRuns,
      ];
      break;
    }
    case "cancel_run": {
      const cancelledAt = new Date().toISOString();
      snapshot.generationRuns = snapshot.generationRuns.map((run) =>
        run.id === mutation.runId &&
        (run.status === "queued" || run.status === "pending")
          ? {
              ...run,
              status: "cancelled",
              cancelledAt,
              completedAt: cancelledAt,
              updatedAt: cancelledAt,
              providerStatus: "cancelled",
              canCancel: false,
            }
          : run
      );
      break;
    }
  }

  commitSnapshot(store, snapshot);
  syncLocalQueue(store);
  return cloneLocalResponse(store);
}

export async function uploadLocalFiles(params: {
  files: File[];
  folderId: string | null;
  manifest: LocalStudioUploadManifestEntry[];
}) {
  const store = getStore();
  const entries = validateUploadManifest(params.files, params.manifest);
  const snapshot = cloneSnapshot(store.snapshot);
  const createdAt = new Date().toISOString();

  for (const entry of entries) {
    const { file, metadata } = entry;
    const itemId = createStudioId("asset");
    const sourceRunFileId = createStudioId("run-file");
    const fileExtension = getFileExtension(file.name) || ".bin";
    const sourceRelativePath = path
      .join("items", itemId, "source", `${sourceRunFileId}${fileExtension}`)
      .replaceAll(path.sep, "/");
    const sourceAbsolutePath = path.join(getLocalStorageRoot(), sourceRelativePath);
    ensureParentDirectory(sourceAbsolutePath);
    await fsPromises.mkdir(getLocalItemSourceDirectory(itemId), { recursive: true });
    await fsPromises.writeFile(sourceAbsolutePath, Buffer.from(await file.arrayBuffer()));

    let thumbnailRunFile: StudioRunFile | null = null;
    let thumbnailPath: string | null = null;
    let thumbnailUrl: string | null = null;

    if (metadata.kind === "audio") {
      const thumbnailRunFileId = createStudioId("run-file");
      await fsPromises.mkdir(getLocalItemThumbnailDirectory(itemId), { recursive: true });
      const thumbnailFile = createAudioThumbnailFile({
        itemId,
        title: file.name,
        subtitle: `${(file.size / 1024 / 1024).toFixed(1)} MB audio upload`,
        accentSeed: file.name,
        thumbnailRunFileId,
      });

      thumbnailRunFile = {
        id: thumbnailRunFileId,
        runId: null,
        userId: snapshot.profile.id,
        fileRole: "thumbnail",
        sourceType: "uploaded",
        storageBucket: "local-fs",
        storagePath: thumbnailFile.relativePath,
        mimeType: "image/svg+xml",
        fileName: `${thumbnailRunFileId}.svg`,
        fileSizeBytes: fs.statSync(thumbnailFile.absolutePath).size,
        mediaWidth: 1200,
        mediaHeight: 900,
        mediaDurationSeconds: null,
        aspectRatioLabel: "4:3",
        hasAlpha: false,
        metadata: {},
        createdAt,
      };
      thumbnailPath = thumbnailRunFile.id;
      thumbnailUrl = buildLocalFileUrl(thumbnailRunFile.id);
    }

    const sourceRunFile: StudioRunFile = {
      id: sourceRunFileId,
      runId: null,
      userId: snapshot.profile.id,
      fileRole: "input",
      sourceType: "uploaded",
      storageBucket: "local-fs",
      storagePath: sourceRelativePath,
      mimeType: file.type || "application/octet-stream",
      fileName: file.name,
      fileSizeBytes: file.size,
      mediaWidth: metadata.mediaWidth,
      mediaHeight: metadata.mediaHeight,
      mediaDurationSeconds: metadata.mediaDurationSeconds,
      aspectRatioLabel: metadata.aspectRatioLabel,
      hasAlpha: metadata.hasAlpha,
      metadata: {},
      createdAt,
    };

    const previewUrl = buildLocalFileUrl(sourceRunFile.id);
    const item: LibraryItem = {
      id: itemId,
      userId: snapshot.profile.id,
      workspaceId: snapshot.folders[0]?.workspaceId ?? "workspace-local",
      runFileId: sourceRunFile.id,
      sourceRunId: null,
      title: file.name,
      kind: metadata.kind,
      source: "uploaded",
      role: "uploaded_source",
      previewUrl,
      thumbnailUrl: thumbnailUrl ?? previewUrl,
      contentText: null,
      createdAt,
      updatedAt: createdAt,
      modelId: null,
      runId: null,
      provider: "fal",
      status: "ready",
      prompt: "",
      meta:
        metadata.kind === "audio"
          ? `${file.type || "Audio"} • ${(file.size / 1024 / 1024).toFixed(1)} MB`
          : `${file.type || "File"} • ${(file.size / 1024 / 1024).toFixed(1)} MB`,
      mediaWidth: metadata.mediaWidth,
      mediaHeight: metadata.mediaHeight,
      mediaDurationSeconds: metadata.mediaDurationSeconds,
      aspectRatioLabel: metadata.aspectRatioLabel,
      hasAlpha: metadata.hasAlpha,
      folderId: params.folderId,
      folderIds: params.folderId ? [params.folderId] : [],
      storageBucket: "local-fs",
      storagePath: sourceRelativePath,
      thumbnailPath,
      fileName: file.name,
      mimeType: file.type || null,
      byteSize: file.size,
      metadata: {},
      errorMessage: null,
    };

    snapshot.runFiles.unshift(sourceRunFile);
    if (thumbnailRunFile) {
      snapshot.runFiles.unshift(thumbnailRunFile);
    }
    snapshot.libraryItems.unshift(item);
  }

  commitSnapshot(store, snapshot, createdAt);
  return cloneLocalResponse(store);
}

export function getLocalFile(fileId: string): LocalFileRecord | null {
  const store = getStore();
  const runFile = store.snapshot.runFiles.find((entry) => entry.id === fileId);
  if (!runFile || runFile.storageBucket !== "local-fs") {
    return null;
  }

  return {
    absolutePath: getLocalFileAbsolutePath(runFile.storagePath),
    fileName: runFile.fileName,
    mimeType: runFile.mimeType,
  };
}
