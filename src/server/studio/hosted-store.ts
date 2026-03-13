import { createAudioThumbnailUrl } from "@/features/studio/studio-asset-thumbnails";
import {
  createDraft,
  createGeneratedLibraryItem,
  createGenerationRunPreviewUrl,
  createGenerationRunSummary,
  createRunFile,
  createStudioId,
  HOSTED_STUDIO_WORKSPACE_ID,
  hydrateDraft,
  toPersistedDraft,
} from "@/features/studio/studio-local-runtime-data";
import {
  getHostedStudioFairShare,
  getStudioRunCompletionDelayMs,
  resolveStudioGenerationRequestMode,
  shouldStudioMockRunFail,
} from "@/features/studio/studio-generation-rules";
import { reorderStudioFoldersByIds } from "@/features/studio/studio-folder-order";
import { getStudioModelById } from "@/features/studio/studio-model-catalog";
import { quoteStudioDraftPricing } from "@/features/studio/studio-model-pricing";
import type {
  HostedStudioGenerateInputDescriptor,
  HostedStudioMutation,
  HostedStudioUploadManifestEntry,
} from "@/features/studio/studio-hosted-mock-api";
import { getStudioUploadedMediaKind } from "@/features/studio/studio-upload-files";
import type {
  GenerationRun,
  LibraryItem,
  PersistedStudioDraft,
  StudioCreditBalance,
  StudioCreditPack,
  StudioFolder,
  StudioHostedClientStateDefaults,
  StudioHostedWorkspaceState,
  StudioProfile,
  StudioQueueSettings,
  StudioRunFile,
  StudioWorkspaceDomainState,
} from "@/features/studio/types";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { SupabaseClient, User } from "@supabase/supabase-js";

const HOSTED_SYNC_INTERVAL_MS = 1400;
const HOSTED_MEDIA_BUCKET = "hosted-media";

type HostedSupabaseClient = SupabaseClient<Database>;
type StudioAccountRow = Database["public"]["Tables"]["studio_accounts"]["Row"];
type StudioSystemConfigRow = Database["public"]["Tables"]["studio_system_config"]["Row"];
type FolderRow = Database["public"]["Tables"]["folders"]["Row"];
type RunFileRow = Database["public"]["Tables"]["run_files"]["Row"];
type LibraryItemRow = Database["public"]["Tables"]["library_items"]["Row"];
type GenerationRunRow = Database["public"]["Tables"]["generation_runs"]["Row"];

function sanitizeStorageFileName(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "file.bin";
}

function parseObjectJson(value: Json, fallback: Record<string, unknown> = {}) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fallback;
}

function parseDraftSnapshot(value: Json, modelId: string) {
  const model = getStudioModelById(modelId);
  const fallback = {
    ...toPersistedDraft(createDraft(model)),
    referenceCount: 0,
    startFrameCount: 0,
    endFrameCount: 0,
  } satisfies GenerationRun["draftSnapshot"];

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }

  const draft = value as Partial<GenerationRun["draftSnapshot"]>;
  return {
    ...fallback,
    ...draft,
    referenceCount:
      typeof draft.referenceCount === "number" ? draft.referenceCount : 0,
    startFrameCount:
      typeof draft.startFrameCount === "number" ? draft.startFrameCount : 0,
    endFrameCount:
      typeof draft.endFrameCount === "number" ? draft.endFrameCount : 0,
  };
}

function toHostedFileUrl(storagePath: string) {
  return `/api/studio/hosted/files/${encodeURIComponent(storagePath)}`;
}

function resolveStoredAssetUrl(storageBucket: string, storagePath: string | null) {
  if (!storagePath) {
    return null;
  }

  if (storageBucket === HOSTED_MEDIA_BUCKET) {
    return toHostedFileUrl(storagePath);
  }

  if (
    storagePath.startsWith("data:") ||
    storagePath.startsWith("blob:") ||
    /^https?:\/\//i.test(storagePath)
  ) {
    return storagePath;
  }

  return storagePath.startsWith("/") ? storagePath : `/${storagePath}`;
}

function createActiveCreditPack(credits: number | null, updatedAt: string): StudioCreditPack | null {
  if (credits !== 10 && credits !== 100) {
    return null;
  }

  return {
    id: `credit-pack-${credits}`,
    credits,
    priceCents: credits,
    currency: "usd",
    isActive: true,
    displayOrder: credits === 10 ? 0 : 1,
    createdAt: updatedAt,
    updatedAt,
  };
}

function mapProfile(account: StudioAccountRow, user: User): StudioProfile {
  return {
    id: account.user_id,
    email: user.email ?? `${account.user_id}@tryplayground.ai`,
    displayName: account.display_name,
    avatarLabel: account.avatar_label,
    avatarUrl: account.avatar_url,
    preferences: {},
    createdAt: account.created_at,
    updatedAt: account.updated_at,
  };
}

function mapCreditBalance(account: StudioAccountRow): StudioCreditBalance {
  return {
    userId: account.user_id,
    balanceCredits: account.credit_balance,
    updatedAt: account.updated_at,
  };
}

function mapQueueSettings(config: StudioSystemConfigRow, activeHostedUserCount: number): StudioQueueSettings {
  return {
    maxActiveJobsPerUser: config.max_active_jobs_per_user,
    providerSlotLimit: config.provider_slot_limit,
    localConcurrencyLimit: config.local_concurrency_limit,
    activeHostedUserCount,
  };
}

function mapFolder(row: FolderRow): StudioFolder {
  return {
    id: row.id,
    userId: row.user_id,
    workspaceId: HOSTED_STUDIO_WORKSPACE_ID,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sortOrder: row.sort_order,
  };
}

function mapRunFile(row: RunFileRow): StudioRunFile {
  return {
    id: row.id,
    runId: row.run_id,
    userId: row.user_id,
    fileRole: row.file_role as StudioRunFile["fileRole"],
    sourceType: row.source_type as StudioRunFile["sourceType"],
    storageBucket: row.storage_bucket,
    storagePath: row.storage_path,
    mimeType: row.mime_type,
    fileName: row.file_name,
    fileSizeBytes: row.file_size_bytes,
    mediaWidth: row.media_width,
    mediaHeight: row.media_height,
    mediaDurationSeconds: row.media_duration_seconds,
    aspectRatioLabel: row.aspect_ratio_label,
    hasAlpha: row.has_alpha,
    metadata: parseObjectJson(row.metadata),
    createdAt: row.created_at,
  };
}

function mapLibraryItem(
  row: LibraryItemRow,
  runFileMap: Map<string, RunFileRow>,
  thumbnailFileMap: Map<string, RunFileRow>
): LibraryItem {
  const runFile = row.run_file_id ? runFileMap.get(row.run_file_id) ?? null : null;
  const thumbnailFile =
    row.thumbnail_file_id ? thumbnailFileMap.get(row.thumbnail_file_id) ?? null : null;
  const previewUrl =
    row.kind === "text"
      ? null
      : resolveStoredAssetUrl(runFile?.storage_bucket ?? "inline-preview", runFile?.storage_path ?? null);
  const thumbnailUrl =
    row.kind === "text"
      ? null
      : thumbnailFile
        ? resolveStoredAssetUrl(thumbnailFile.storage_bucket, thumbnailFile.storage_path)
        : row.kind === "audio"
          ? createAudioThumbnailUrl({
              title: row.title,
              subtitle: row.meta || "Audio asset",
              accentSeed: row.id,
            })
          : previewUrl;

  return {
    id: row.id,
    userId: row.user_id,
    workspaceId: HOSTED_STUDIO_WORKSPACE_ID,
    runFileId: row.run_file_id,
    sourceRunId: row.source_run_id,
    title: row.title,
    kind: row.kind as LibraryItem["kind"],
    source: row.source as LibraryItem["source"],
    role: row.role as LibraryItem["role"],
    previewUrl,
    thumbnailUrl,
    contentText: row.content_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    modelId: row.model_id,
    runId: row.run_id,
    provider: row.provider as LibraryItem["provider"],
    status: row.status as LibraryItem["status"],
    prompt: row.prompt,
    meta: row.meta,
    mediaWidth: row.media_width,
    mediaHeight: row.media_height,
    mediaDurationSeconds: row.media_duration_seconds,
    aspectRatioLabel: row.aspect_ratio_label,
    hasAlpha: row.has_alpha,
    folderId: row.folder_id,
    folderIds: row.folder_id ? [row.folder_id] : [],
    storageBucket: runFile?.storage_bucket ?? (row.kind === "text" ? "inline-text" : "inline-preview"),
    storagePath: runFile?.storage_path ?? null,
    thumbnailPath: thumbnailFile?.storage_path ?? null,
    fileName: row.file_name,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    metadata: parseObjectJson(row.metadata),
    errorMessage: row.error_message,
  };
}

function mapGenerationRun(row: GenerationRunRow): GenerationRun {
  return {
    id: row.id,
    userId: row.user_id,
    workspaceId: HOSTED_STUDIO_WORKSPACE_ID,
    folderId: row.folder_id,
    modelId: row.model_id,
    modelName: row.model_name,
    kind: row.kind as GenerationRun["kind"],
    provider: row.provider as GenerationRun["provider"],
    requestMode: row.request_mode as GenerationRun["requestMode"],
    status: row.status as GenerationRun["status"],
    prompt: row.prompt,
    createdAt: row.created_at,
    queueEnteredAt: row.queue_entered_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    failedAt: row.failed_at,
    cancelledAt: row.cancelled_at,
    updatedAt: row.updated_at,
    summary: row.summary,
    outputAssetId: row.output_asset_id,
    previewUrl: row.preview_url,
    errorMessage: row.error_message,
    inputPayload: parseObjectJson(row.input_payload),
    inputSettings: parseObjectJson(row.input_settings),
    providerRequestId: row.provider_request_id,
    providerStatus: row.provider_status,
    estimatedCostUsd: row.estimated_cost_usd,
    actualCostUsd: row.actual_cost_usd,
    estimatedCredits: row.estimated_credits,
    actualCredits: row.actual_credits,
    usageSnapshot: parseObjectJson(row.usage_snapshot),
    outputText: row.output_text,
    pricingSnapshot: parseObjectJson(row.pricing_snapshot),
    dispatchAttemptCount: row.dispatch_attempt_count,
    dispatchLeaseExpiresAt: row.dispatch_lease_expires_at,
    canCancel: row.can_cancel,
    draftSnapshot: parseDraftSnapshot(row.draft_snapshot, row.model_id),
  };
}

async function ensureHostedAccount(supabase: HostedSupabaseClient, user: User) {
  const { data: existingAccount, error: selectError } = await supabase
    .from("studio_accounts")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (selectError) {
    throw new Error(selectError.message);
  }

  if (existingAccount) {
    return existingAccount;
  }

  const displayName =
    String(user.user_metadata.display_name ?? "").trim() ||
    (user.email?.split("@")[0] ?? "").trim() ||
    "TryPlayground User";

  const { data: insertedAccount, error: insertError } = await supabase
    .from("studio_accounts")
    .insert({
      user_id: user.id,
      display_name: displayName,
      avatar_label: displayName.slice(0, 1).toUpperCase() || "T",
    })
    .select("*")
    .single();

  if (insertError || !insertedAccount) {
    throw new Error(insertError?.message ?? "Could not create hosted account.");
  }

  return insertedAccount;
}

async function getHostedSystemConfig(supabase: HostedSupabaseClient) {
  const { data, error } = await supabase
    .from("studio_system_config")
    .select("*")
    .eq("id", true)
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not load hosted queue settings.");
  }

  return data;
}

async function getActiveHostedUserCount(supabase: HostedSupabaseClient) {
  const { data, error } = await supabase.rpc("get_tryplayground_active_hosted_user_count");
  if (error) {
    throw new Error(error.message);
  }

  return typeof data === "number" ? data : 1;
}

async function listHostedUserFolders(supabase: HostedSupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("folders")
    .select("*")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function listHostedUserRunFiles(supabase: HostedSupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("run_files")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function listHostedUserItems(supabase: HostedSupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("library_items")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function listHostedUserRuns(supabase: HostedSupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("generation_runs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function buildHostedDomainState(params: {
  supabase: HostedSupabaseClient;
  user: User;
  account: StudioAccountRow;
  systemConfig: StudioSystemConfigRow;
  activeHostedUserCount: number;
}): Promise<StudioWorkspaceDomainState> {
  const [folderRows, runFileRows, itemRows, runRows] = await Promise.all([
    listHostedUserFolders(params.supabase, params.user.id),
    listHostedUserRunFiles(params.supabase, params.user.id),
    listHostedUserItems(params.supabase, params.user.id),
    listHostedUserRuns(params.supabase, params.user.id),
  ]);

  const runFileMap = new Map(runFileRows.map((row) => [row.id, row]));
  const folders = folderRows.map(mapFolder);
  const runFiles = runFileRows.map(mapRunFile);
  const libraryItems = itemRows.map((row) =>
    mapLibraryItem(row, runFileMap, runFileMap)
  );
  const generationRuns = runRows.map(mapGenerationRun);

  return {
    profile: mapProfile(params.account, params.user),
    creditBalance: mapCreditBalance(params.account),
    activeCreditPack: createActiveCreditPack(
      params.account.active_credit_pack,
      params.account.updated_at
    ),
    modelConfiguration: {
      enabledModelIds: params.account.enabled_model_ids,
      updatedAt: params.account.updated_at,
    },
    queueSettings: mapQueueSettings(
      params.systemConfig,
      params.activeHostedUserCount
    ),
    folders,
    runFiles,
    libraryItems,
    generationRuns,
  };
}

async function buildHostedState(params: {
  supabase: HostedSupabaseClient;
  user: User;
  account?: StudioAccountRow;
  systemConfig?: StudioSystemConfigRow;
  activeHostedUserCount?: number;
}) {
  const account =
    params.account ?? (await ensureHostedAccount(params.supabase, params.user));
  const systemConfig =
    params.systemConfig ?? (await getHostedSystemConfig(params.supabase));
  const activeHostedUserCount =
    params.activeHostedUserCount ?? (await getActiveHostedUserCount(params.supabase));
  const domainState = await buildHostedDomainState({
    supabase: params.supabase,
    user: params.user,
    account,
    systemConfig,
    activeHostedUserCount,
  });

  return {
    account,
    systemConfig,
    activeHostedUserCount,
    state: {
      schemaVersion: 6,
      mode: "hosted",
      revision: account.revision,
      syncedAt: new Date().toISOString(),
      ...domainState,
    } satisfies StudioHostedWorkspaceState,
    uiStateDefaults: {
      selectedModelId: account.selected_model_id,
      gallerySizeLevel: account.gallery_size_level,
    } satisfies StudioHostedClientStateDefaults,
  };
}

async function updateHostedAccountCredits(params: {
  supabase: HostedSupabaseClient;
  userId: string;
  nextBalance: number;
  activeCreditPack?: number | null;
}) {
  const payload: {
    credit_balance: number;
    active_credit_pack?: number | null;
  } = {
    credit_balance: params.nextBalance,
  };

  if (typeof params.activeCreditPack !== "undefined") {
    payload.active_credit_pack = params.activeCreditPack;
  }

  const { error } = await params.supabase
    .from("studio_accounts")
    .update(payload)
    .eq("user_id", params.userId);

  if (error) {
    throw new Error(error.message);
  }
}

async function insertCreditLedgerEntry(params: {
  supabase: HostedSupabaseClient;
  userId: string;
  deltaCredits: number;
  reason: "purchase" | "generation_hold" | "generation_settlement" | "generation_refund" | "admin_adjustment";
  relatedRunId?: string | null;
  metadata?: Json;
}) {
  const { error } = await params.supabase.from("credit_ledger").insert({
    user_id: params.userId,
    delta_credits: params.deltaCredits,
    reason: params.reason,
    related_run_id: params.relatedRunId ?? null,
    metadata: (params.metadata ?? {}) as Json,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function createHostedGeneratedOutput(params: {
  supabase: HostedSupabaseClient;
  run: GenerationRunRow;
}) {
  const model = getStudioModelById(params.run.model_id);
  const draft = hydrateDraft(parseDraftSnapshot(params.run.draft_snapshot, params.run.model_id), model);
  const finishedAt = new Date().toISOString();
  const nextRunFileId = params.run.kind === "text" ? null : createStudioId("run-file");
  const nextItem = createGeneratedLibraryItem({
    runFileId: nextRunFileId,
    sourceRunId: params.run.id,
    model,
    draft,
    createdAt: finishedAt,
    folderId: params.run.folder_id,
    runId: params.run.id,
    userId: params.run.user_id,
    workspaceId: HOSTED_STUDIO_WORKSPACE_ID,
  });

  if (nextRunFileId && nextItem.previewUrl) {
    const runFile = createRunFile({
      id: nextRunFileId,
      runId: params.run.id,
      userId: params.run.user_id,
      sourceType: "generated",
      fileRole: "output",
      previewUrl: nextItem.previewUrl,
      fileName: nextItem.fileName ?? `${params.run.id}.bin`,
      mimeType: nextItem.mimeType ?? "application/octet-stream",
      mediaWidth: nextItem.mediaWidth,
      mediaHeight: nextItem.mediaHeight,
      mediaDurationSeconds: nextItem.mediaDurationSeconds,
      hasAlpha: nextItem.hasAlpha,
      createdAt: finishedAt,
    });

    const { error: runFileError } = await params.supabase.from("run_files").insert({
      id: runFile.id,
      run_id: runFile.runId,
      user_id: runFile.userId,
      file_role: runFile.fileRole,
      source_type: runFile.sourceType,
      storage_bucket: runFile.storageBucket,
      storage_path: runFile.storagePath,
      mime_type: runFile.mimeType,
      file_name: runFile.fileName,
      file_size_bytes: runFile.fileSizeBytes,
      media_width: runFile.mediaWidth,
      media_height: runFile.mediaHeight,
      media_duration_seconds: runFile.mediaDurationSeconds,
      aspect_ratio_label: runFile.aspectRatioLabel,
      has_alpha: runFile.hasAlpha,
      metadata: runFile.metadata as Json,
      created_at: runFile.createdAt,
    });

    if (runFileError) {
      throw new Error(runFileError.message);
    }
  }

  const { error: itemError } = await params.supabase.from("library_items").insert({
    id: nextItem.id,
    user_id: nextItem.userId,
    run_file_id: nextItem.runFileId,
    thumbnail_file_id: null,
    source_run_id: nextItem.sourceRunId,
    title: nextItem.title,
    kind: nextItem.kind,
    source: nextItem.source,
    role: nextItem.role,
    content_text: nextItem.contentText,
    created_at: nextItem.createdAt,
    updated_at: nextItem.updatedAt,
    model_id: nextItem.modelId,
    run_id: nextItem.runId,
    provider: nextItem.provider,
    status: nextItem.status,
    prompt: nextItem.prompt,
    meta: nextItem.meta,
    media_width: nextItem.mediaWidth,
    media_height: nextItem.mediaHeight,
    media_duration_seconds: nextItem.mediaDurationSeconds,
    aspect_ratio_label: nextItem.aspectRatioLabel,
    has_alpha: nextItem.hasAlpha,
    folder_id: nextItem.folderId,
    file_name: nextItem.fileName,
    mime_type: nextItem.mimeType,
    byte_size: nextItem.byteSize,
    metadata: nextItem.metadata as Json,
    error_message: nextItem.errorMessage,
  });

  if (itemError) {
    throw new Error(itemError.message);
  }

  const { error: runError } = await params.supabase
    .from("generation_runs")
    .update({
      status: "completed",
      provider_status: "completed",
      output_asset_id: nextItem.id,
      actual_cost_usd: params.run.estimated_cost_usd,
      actual_credits: params.run.estimated_credits,
      completed_at: finishedAt,
      updated_at: finishedAt,
      can_cancel: false,
      output_text: nextItem.kind === "text" ? nextItem.contentText : null,
    })
    .eq("id", params.run.id)
    .eq("user_id", params.run.user_id);

  if (runError) {
    throw new Error(runError.message);
  }
}

async function failHostedRun(params: {
  supabase: HostedSupabaseClient;
  run: GenerationRunRow;
  refundCredits: boolean;
}) {
  const finishedAt = new Date().toISOString();

  const { error } = await params.supabase
    .from("generation_runs")
    .update({
      status: "failed",
      provider_status: "failed",
      completed_at: finishedAt,
      failed_at: finishedAt,
      updated_at: finishedAt,
      can_cancel: false,
      error_message: "Mock Fal generation failed before an output asset was returned.",
    })
    .eq("id", params.run.id)
    .eq("user_id", params.run.user_id);

  if (error) {
    throw new Error(error.message);
  }

  if (params.refundCredits && params.run.estimated_credits) {
    const { data: account, error: accountError } = await params.supabase
      .from("studio_accounts")
      .select("credit_balance")
      .eq("user_id", params.run.user_id)
      .single();

    if (accountError || !account) {
      throw new Error(accountError?.message ?? "Could not refund hosted credits.");
    }

    await updateHostedAccountCredits({
      supabase: params.supabase,
      userId: params.run.user_id,
      nextBalance: account.credit_balance + params.run.estimated_credits,
    });
    await insertCreditLedgerEntry({
      supabase: params.supabase,
      userId: params.run.user_id,
      deltaCredits: params.run.estimated_credits,
      reason: "generation_refund",
      relatedRunId: params.run.id,
      metadata: {
        status: "failed",
      } as Json,
    });
  }
}

async function dispatchHostedRun(params: {
  supabase: HostedSupabaseClient;
  run: GenerationRunRow;
}) {
  const startedAt = new Date().toISOString();
  const { error } = await params.supabase
    .from("generation_runs")
    .update({
      status: "processing",
      started_at: startedAt,
      updated_at: startedAt,
      provider_request_id: params.run.provider_request_id ?? `fal_${params.run.id}`,
      provider_status: "running",
      dispatch_attempt_count: params.run.dispatch_attempt_count + 1,
      can_cancel: false,
    })
    .eq("id", params.run.id)
    .eq("user_id", params.run.user_id)
    .in("status", ["queued", "pending"]);

  if (error) {
    throw new Error(error.message);
  }
}

async function syncHostedUserQueue(params: {
  supabase: HostedSupabaseClient;
  user: User;
}) {
  await ensureHostedAccount(params.supabase, params.user);
  const [systemConfig, activeHostedUserCount, account, runRows] = await Promise.all([
    getHostedSystemConfig(params.supabase),
    getActiveHostedUserCount(params.supabase),
    params.supabase
      .from("studio_accounts")
      .select("*")
      .eq("user_id", params.user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          throw new Error(error?.message ?? "Could not load hosted account.");
        }
        return data;
      }),
    listHostedUserRuns(params.supabase, params.user.id),
  ]);

  const processingRuns = runRows.filter((run) => run.status === "processing");
  for (const run of processingRuns) {
    const startedAt = run.started_at ? Date.parse(run.started_at) : Date.now();
    if (Date.now() - startedAt < getStudioRunCompletionDelayMs({ kind: run.kind as GenerationRun["kind"] })) {
      continue;
    }

    if (shouldStudioMockRunFail({ prompt: run.prompt })) {
      await failHostedRun({
        supabase: params.supabase,
        run,
        refundCredits: true,
      });
      continue;
    }

    await createHostedGeneratedOutput({
      supabase: params.supabase,
      run,
    });
  }

  const refreshedRuns = await listHostedUserRuns(params.supabase, params.user.id);
  const processingCount = refreshedRuns.filter((run) => run.status === "processing").length;
  const fairShare = getHostedStudioFairShare({
    queueSettings: {
      activeHostedUserCount,
      providerSlotLimit: systemConfig.provider_slot_limit,
    },
    userId: params.user.id,
  });
  const availableDispatchSlots = Math.max(0, fairShare.maxProcessing - processingCount);

  if (availableDispatchSlots <= 0) {
    return;
  }

  const queuedRuns = refreshedRuns
    .filter((run) => run.status === "queued" || run.status === "pending")
    .sort(
      (left, right) =>
        Date.parse(left.queue_entered_at) - Date.parse(right.queue_entered_at)
    );

  for (const run of queuedRuns.slice(0, availableDispatchSlots)) {
    await dispatchHostedRun({
      supabase: params.supabase,
      run,
    });
  }

  void account;
}

export async function getHostedSyncPayload(params: {
  supabase: HostedSupabaseClient;
  user: User;
  sinceRevision: number | null;
}) {
  await syncHostedUserQueue({
    supabase: params.supabase,
    user: params.user,
  });

  const nextState = await buildHostedState({
    supabase: params.supabase,
    user: params.user,
  });

  if (
    params.sinceRevision !== null &&
    params.sinceRevision >= nextState.state.revision
  ) {
    return {
      kind: "noop" as const,
      revision: nextState.state.revision,
      syncIntervalMs: HOSTED_SYNC_INTERVAL_MS,
    };
  }

  return {
    kind: params.sinceRevision === null ? ("bootstrap" as const) : ("refresh" as const),
    revision: nextState.state.revision,
    syncIntervalMs: HOSTED_SYNC_INTERVAL_MS,
    uiStateDefaults:
      params.sinceRevision === null ? nextState.uiStateDefaults : undefined,
    state: nextState.state,
  };
}

export async function mutateHostedState(params: {
  supabase: HostedSupabaseClient;
  user: User;
  mutation: HostedStudioMutation;
}) {
  const account = await ensureHostedAccount(params.supabase, params.user);
  const mutation = params.mutation;

  switch (mutation.action) {
    case "purchase_credits": {
      const nextBalance = account.credit_balance + mutation.credits;
      await updateHostedAccountCredits({
        supabase: params.supabase,
        userId: params.user.id,
        nextBalance,
        activeCreditPack: mutation.credits,
      });
      await insertCreditLedgerEntry({
        supabase: params.supabase,
        userId: params.user.id,
        deltaCredits: mutation.credits,
        reason: "purchase",
        metadata: {
          pack_credits: mutation.credits,
        } as Json,
      });
      break;
    }
    case "set_enabled_models": {
      const { error } = await params.supabase
        .from("studio_accounts")
        .update({
          enabled_model_ids: mutation.enabledModelIds,
        })
        .eq("user_id", params.user.id);

      if (error) {
        throw new Error(error.message);
      }
      break;
    }
    case "save_ui_state": {
      const { error } = await params.supabase
        .from("studio_accounts")
        .update({
          selected_model_id: mutation.selectedModelId,
          gallery_size_level: mutation.gallerySizeLevel,
        })
        .eq("user_id", params.user.id);

      if (error) {
        throw new Error(error.message);
      }
      break;
    }
    case "create_folder": {
      const folders = await listHostedUserFolders(params.supabase, params.user.id);
      const { error } = await params.supabase.from("folders").insert({
        user_id: params.user.id,
        name: mutation.name.trim(),
        sort_order: folders.length,
      });

      if (error) {
        throw new Error(error.message);
      }
      break;
    }
    case "rename_folder": {
      const { error } = await params.supabase
        .from("folders")
        .update({
          name: mutation.name.trim(),
        })
        .eq("id", mutation.folderId)
        .eq("user_id", params.user.id);

      if (error) {
        throw new Error(error.message);
      }
      break;
    }
    case "delete_folder": {
      const { error: clearItemsError } = await params.supabase
        .from("library_items")
        .update({
          folder_id: null,
        })
        .eq("user_id", params.user.id)
        .eq("folder_id", mutation.folderId);

      if (clearItemsError) {
        throw new Error(clearItemsError.message);
      }

      const { error: clearRunsError } = await params.supabase
        .from("generation_runs")
        .update({
          folder_id: null,
        })
        .eq("user_id", params.user.id)
        .eq("folder_id", mutation.folderId);

      if (clearRunsError) {
        throw new Error(clearRunsError.message);
      }

      const { error } = await params.supabase
        .from("folders")
        .delete()
        .eq("id", mutation.folderId)
        .eq("user_id", params.user.id);

      if (error) {
        throw new Error(error.message);
      }

      const reorderedFolders = reorderStudioFoldersByIds(
        (await listHostedUserFolders(params.supabase, params.user.id)).map(mapFolder),
        (await listHostedUserFolders(params.supabase, params.user.id)).map((folder) => folder.id),
        new Date().toISOString()
      );

      for (const folder of reorderedFolders) {
        const { error: reorderError } = await params.supabase
          .from("folders")
          .update({
            sort_order: folder.sortOrder,
          })
          .eq("id", folder.id)
          .eq("user_id", params.user.id);

        if (reorderError) {
          throw new Error(reorderError.message);
        }
      }
      break;
    }
    case "reorder_folders": {
      const folderRows = await listHostedUserFolders(params.supabase, params.user.id);
      const reorderedFolders = reorderStudioFoldersByIds(
        folderRows.map(mapFolder),
        mutation.orderedFolderIds,
        new Date().toISOString()
      );

      for (const folder of reorderedFolders) {
        const { error } = await params.supabase
          .from("folders")
          .update({
            sort_order: folder.sortOrder,
          })
          .eq("id", folder.id)
          .eq("user_id", params.user.id);

        if (error) {
          throw new Error(error.message);
        }
      }
      break;
    }
    case "move_items": {
      const { error } = await params.supabase
        .from("library_items")
        .update({
          folder_id: mutation.folderId,
        })
        .eq("user_id", params.user.id)
        .in("id", mutation.itemIds);

      if (error) {
        throw new Error(error.message);
      }
      break;
    }
    case "delete_items": {
      const itemRows = await listHostedUserItems(params.supabase, params.user.id);
      const targetItems = itemRows.filter((item) => mutation.itemIds.includes(item.id));
      const hostedMediaPaths = targetItems
        .map((item) => item.run_file_id)
        .filter((value): value is string => Boolean(value));

      if (hostedMediaPaths.length > 0) {
        const runFileRows = await listHostedUserRunFiles(params.supabase, params.user.id);
        const filePaths = runFileRows
          .filter((runFile) => hostedMediaPaths.includes(runFile.id) && runFile.storage_bucket === HOSTED_MEDIA_BUCKET)
          .map((runFile) => runFile.storage_path);

        if (filePaths.length > 0) {
          const { error: storageError } = await params.supabase
            .storage
            .from(HOSTED_MEDIA_BUCKET)
            .remove(filePaths);

          if (storageError) {
            throw new Error(storageError.message);
          }
        }
      }

      const { error: deleteItemsError } = await params.supabase
        .from("library_items")
        .delete()
        .eq("user_id", params.user.id)
        .in("id", mutation.itemIds);

      if (deleteItemsError) {
        throw new Error(deleteItemsError.message);
      }

      break;
    }
    case "update_text_item": {
      const payload: { title?: string; content_text?: string; prompt?: string } = {};
      if (typeof mutation.title === "string") {
        payload.title = mutation.title.trim();
      }
      if (typeof mutation.contentText === "string") {
        payload.content_text = mutation.contentText.trim();
        payload.prompt = mutation.contentText.trim();
      }

      const { error } = await params.supabase
        .from("library_items")
        .update(payload)
        .eq("id", mutation.itemId)
        .eq("user_id", params.user.id)
        .eq("kind", "text");

      if (error) {
        throw new Error(error.message);
      }
      break;
    }
    case "create_text_item": {
      const body = mutation.body.trim();
      const title = mutation.title.trim() || body.slice(0, 36) || "Text note";
      const now = new Date().toISOString();
      const { error } = await params.supabase.from("library_items").insert({
        id: createStudioId("asset"),
        user_id: params.user.id,
        title,
        kind: "text",
        source: "uploaded",
        role: "text_note",
        content_text: body,
        created_at: now,
        updated_at: now,
        model_id: null,
        run_id: null,
        provider: "fal",
        status: "ready",
        prompt: body,
        meta: "Text note",
        media_width: null,
        media_height: null,
        media_duration_seconds: null,
        aspect_ratio_label: null,
        has_alpha: false,
        folder_id: mutation.folderId,
        file_name: `${createStudioId("text")}.txt`,
        mime_type: "text/plain",
        byte_size: body.length,
        metadata: {} as Json,
        error_message: null,
      });

      if (error) {
        throw new Error(error.message);
      }
      break;
    }
    case "cancel_run": {
      const { data: run, error: runError } = await params.supabase
        .from("generation_runs")
        .select("*")
        .eq("id", mutation.runId)
        .eq("user_id", params.user.id)
        .maybeSingle();

      if (runError) {
        throw new Error(runError.message);
      }

      if (run && (run.status === "queued" || run.status === "pending")) {
        const cancelledAt = new Date().toISOString();
        const { error } = await params.supabase
          .from("generation_runs")
          .update({
            status: "cancelled",
            cancelled_at: cancelledAt,
            completed_at: cancelledAt,
            updated_at: cancelledAt,
            provider_status: "cancelled",
            can_cancel: false,
          })
          .eq("id", run.id)
          .eq("user_id", params.user.id);

        if (error) {
          throw new Error(error.message);
        }

        if (run.estimated_credits) {
          await updateHostedAccountCredits({
            supabase: params.supabase,
            userId: params.user.id,
            nextBalance: account.credit_balance + run.estimated_credits,
          });
          await insertCreditLedgerEntry({
            supabase: params.supabase,
            userId: params.user.id,
            deltaCredits: run.estimated_credits,
            reason: "generation_refund",
            relatedRunId: run.id,
            metadata: {
              status: "cancelled",
            } as Json,
          });
        }
      }
      break;
    }
    case "generate":
    case "sign_out":
    case "delete_account": {
      break;
    }
  }

  const nextState = await buildHostedState({
    supabase: params.supabase,
    user: params.user,
  });

  return {
    revision: nextState.state.revision,
    state: nextState.state,
  };
}

async function uploadHostedStorageFile(params: {
  supabase: HostedSupabaseClient;
  userId: string;
  runFileId: string;
  file: File;
}) {
  const storagePath = `${params.userId}/${params.runFileId}-${sanitizeStorageFileName(params.file.name)}`;
  const { error } = await params.supabase.storage
    .from(HOSTED_MEDIA_BUCKET)
    .upload(storagePath, params.file, {
      contentType: params.file.type || "application/octet-stream",
      upsert: true,
    });

  if (error) {
    throw new Error(error.message);
  }

  return storagePath;
}

export async function uploadHostedFiles(params: {
  supabase: HostedSupabaseClient;
  user: User;
  files: File[];
  folderId: string | null;
  manifest: HostedStudioUploadManifestEntry[];
}) {
  if (params.files.length === 0) {
    throw new Error("No files were provided.");
  }

  if (params.files.length !== params.manifest.length) {
    throw new Error("Upload metadata did not match the provided files.");
  }

  await ensureHostedAccount(params.supabase, params.user);
  const createdAt = new Date().toISOString();

  for (const [index, file] of params.files.entries()) {
    const metadata = params.manifest[index];
    const kind = getStudioUploadedMediaKind({
      fileName: file.name,
      mimeType: file.type,
    });

    if (!metadata || !kind || kind !== metadata.kind) {
      throw new Error(`Unsupported upload: ${file.name}`);
    }

    const runFileId = createStudioId("run-file");
    const storagePath = await uploadHostedStorageFile({
      supabase: params.supabase,
      userId: params.user.id,
      runFileId,
      file,
    });

    const { error: runFileError } = await params.supabase.from("run_files").insert({
      id: runFileId,
      run_id: null,
      user_id: params.user.id,
      file_role: "input",
      source_type: "uploaded",
      storage_bucket: HOSTED_MEDIA_BUCKET,
      storage_path: storagePath,
      mime_type: file.type || "application/octet-stream",
      file_name: file.name,
      file_size_bytes: file.size,
      media_width: metadata.mediaWidth,
      media_height: metadata.mediaHeight,
      media_duration_seconds: metadata.mediaDurationSeconds,
      aspect_ratio_label: metadata.aspectRatioLabel,
      has_alpha: metadata.hasAlpha,
      metadata: {} as Json,
      created_at: createdAt,
    });

    if (runFileError) {
      throw new Error(runFileError.message);
    }

    const metaLabel =
      kind === "audio"
        ? `${file.type || "Audio"} • ${(file.size / 1024 / 1024).toFixed(1)} MB`
        : `${file.type || "File"} • ${(file.size / 1024 / 1024).toFixed(1)} MB`;

    const { error: itemError } = await params.supabase.from("library_items").insert({
      id: createStudioId("asset"),
      user_id: params.user.id,
      run_file_id: runFileId,
      thumbnail_file_id: null,
      source_run_id: null,
      title: file.name,
      kind,
      source: "uploaded",
      role: "uploaded_source",
      content_text: null,
      created_at: createdAt,
      updated_at: createdAt,
      model_id: null,
      run_id: null,
      provider: "fal",
      status: "ready",
      prompt: "",
      meta: metaLabel,
      media_width: metadata.mediaWidth,
      media_height: metadata.mediaHeight,
      media_duration_seconds: metadata.mediaDurationSeconds,
      aspect_ratio_label: metadata.aspectRatioLabel,
      has_alpha: metadata.hasAlpha,
      folder_id: params.folderId,
      file_name: file.name,
      mime_type: file.type || null,
      byte_size: file.size,
      metadata: {} as Json,
      error_message: null,
    });

    if (itemError) {
      throw new Error(itemError.message);
    }
  }

  const nextState = await buildHostedState({
    supabase: params.supabase,
    user: params.user,
  });

  return {
    revision: nextState.state.revision,
    state: nextState.state,
  };
}

export async function queueHostedGeneration(params: {
  supabase: HostedSupabaseClient;
  user: User;
  modelId: string;
  folderId: string | null;
  draft: GenerationRun["draftSnapshot"] | PersistedStudioDraft;
  inputs: HostedStudioGenerateInputDescriptor[];
  uploadedFiles: Map<string, File>;
}) {
  const [account, systemConfig] = await Promise.all([
    ensureHostedAccount(params.supabase, params.user),
    getHostedSystemConfig(params.supabase),
  ]);
  const enabledModelIds = account.enabled_model_ids;

  if (!enabledModelIds.includes(params.modelId)) {
    throw new Error("That model is disabled for this workspace.");
  }

  const { data: activeRuns, error: activeRunsError } = await params.supabase
    .from("generation_runs")
    .select("id")
    .eq("user_id", params.user.id)
    .in("status", ["queued", "pending", "processing"]);

  if (activeRunsError) {
    throw new Error(activeRunsError.message);
  }

  if ((activeRuns ?? []).length >= systemConfig.max_active_jobs_per_user) {
    throw new Error(
      "limit of 100 concurrent queues/ generations reached, please wait for your generations to finish before continuing."
    );
  }

  const model = getStudioModelById(params.modelId);
  const persistedDraft: PersistedStudioDraft = {
    ...toPersistedDraft(createDraft(model)),
    ...params.draft,
  };
  const hydratedDraft = hydrateDraft(persistedDraft, model);
  const requestMode = resolveStudioGenerationRequestMode(model, hydratedDraft);
  const referenceCount = params.inputs.filter((entry) => entry.slot === "reference").length;
  const startFrameCount = params.inputs.filter((entry) => entry.slot === "start_frame").length;
  const endFrameCount = params.inputs.filter((entry) => entry.slot === "end_frame").length;
  const pricingQuote = quoteStudioDraftPricing(model, persistedDraft);

  if (account.credit_balance < pricingQuote.billedCredits) {
    throw new Error("Not enough credits to queue this generation.");
  }

  const createdAt = new Date().toISOString();
  const runId = createStudioId("run");
  const previewUrl = createGenerationRunPreviewUrl(model, hydratedDraft);

  const runInsert: Database["public"]["Tables"]["generation_runs"]["Row"] = {
    id: runId,
    user_id: params.user.id,
    folder_id: params.folderId,
    model_id: model.id,
    model_name: model.name,
    kind: model.kind,
    provider: "fal",
    request_mode: requestMode,
    status: "queued",
    prompt: persistedDraft.prompt,
    created_at: createdAt,
    queue_entered_at: createdAt,
    started_at: null,
    completed_at: null,
    failed_at: null,
    cancelled_at: null,
    updated_at: createdAt,
    summary: createGenerationRunSummary(model, hydratedDraft),
    output_asset_id: null,
    preview_url: previewUrl,
    error_message: null,
    input_payload: {
      prompt: persistedDraft.prompt,
      request_mode: requestMode,
      reference_count: referenceCount,
      start_frame_count: startFrameCount,
      end_frame_count: endFrameCount,
      video_input_mode: persistedDraft.videoInputMode,
      reference_asset_ids: params.inputs
        .filter((entry) => entry.slot === "reference" && entry.originAssetId)
        .map((entry) => entry.originAssetId),
      model_id: model.id,
    },
    input_settings: {
      ...persistedDraft,
      start_frame_count: startFrameCount,
      end_frame_count: endFrameCount,
      video_input_mode: persistedDraft.videoInputMode,
    },
    provider_request_id: null,
    provider_status: "queued",
    estimated_cost_usd: pricingQuote.apiCostUsd,
    actual_cost_usd: null,
    estimated_credits: pricingQuote.billedCredits,
    actual_credits: null,
    usage_snapshot: {},
    output_text: null,
    pricing_snapshot: pricingQuote.pricingSnapshot,
    dispatch_attempt_count: 0,
    dispatch_lease_expires_at: null,
    can_cancel: true,
    draft_snapshot: {
      ...persistedDraft,
      referenceCount,
      startFrameCount,
      endFrameCount,
    },
  };

  const { error: runInsertError } = await params.supabase
    .from("generation_runs")
    .insert(runInsert);

  if (runInsertError) {
    throw new Error(runInsertError.message);
  }

  let inputPosition = 0;
  for (const input of params.inputs) {
    let runFileId: string | null = null;
    const libraryItemId: string | null = input.originAssetId;

    if (!libraryItemId && input.uploadField) {
      const uploadedFile = params.uploadedFiles.get(input.uploadField);
      if (!uploadedFile) {
        throw new Error("A generation input file was missing.");
      }

      runFileId = createStudioId("run-file");
      const storagePath = await uploadHostedStorageFile({
        supabase: params.supabase,
        userId: params.user.id,
        runFileId,
        file: uploadedFile,
      });

      const { error: runFileError } = await params.supabase.from("run_files").insert({
        id: runFileId,
        run_id: runId,
        user_id: params.user.id,
        file_role: "input",
        source_type: "uploaded",
        storage_bucket: HOSTED_MEDIA_BUCKET,
        storage_path: storagePath,
        mime_type: uploadedFile.type || input.mimeType || "application/octet-stream",
        file_name: uploadedFile.name,
        file_size_bytes: uploadedFile.size,
        media_width: null,
        media_height: null,
        media_duration_seconds: null,
        aspect_ratio_label: null,
        has_alpha: false,
        metadata: {
          input_slot: input.slot,
          source: input.source,
        } as Json,
        created_at: createdAt,
      });

      if (runFileError) {
        throw new Error(runFileError.message);
      }
    }

    const { error: inputError } = await params.supabase
      .from("generation_run_inputs")
      .insert({
        user_id: params.user.id,
        run_id: runId,
        input_role:
          input.slot === "start_frame"
            ? "start_frame"
            : input.slot === "end_frame"
              ? "end_frame"
              : "reference",
        position: inputPosition,
        library_item_id: libraryItemId,
        run_file_id: runFileId,
      });

    if (inputError) {
      throw new Error(inputError.message);
    }
    inputPosition += 1;
  }

  await updateHostedAccountCredits({
    supabase: params.supabase,
    userId: params.user.id,
    nextBalance: account.credit_balance - pricingQuote.billedCredits,
  });
  await insertCreditLedgerEntry({
    supabase: params.supabase,
    userId: params.user.id,
    deltaCredits: -pricingQuote.billedCredits,
    reason: "generation_hold",
    relatedRunId: runId,
    metadata: {
      model_id: model.id,
      request_mode: requestMode,
    } as Json,
  });

  await syncHostedUserQueue({
    supabase: params.supabase,
    user: params.user,
  });

  const nextState = await buildHostedState({
    supabase: params.supabase,
    user: params.user,
  });

  return {
    revision: nextState.state.revision,
    state: nextState.state,
  };
}

export async function deleteHostedAccount(params: {
  supabase: HostedSupabaseClient;
  user: User;
}) {
  const { data: storageEntries, error: storageListError } = await params.supabase
    .storage
    .from(HOSTED_MEDIA_BUCKET)
    .list(params.user.id, {
      limit: 1000,
    });

  if (storageListError) {
    throw new Error(storageListError.message);
  }

  const filePaths = (storageEntries ?? [])
    .map((entry) => (entry.name ? `${params.user.id}/${entry.name}` : null))
    .filter((value): value is string => Boolean(value));

  if (filePaths.length > 0) {
    const { error: storageDeleteError } = await params.supabase
      .storage
      .from(HOSTED_MEDIA_BUCKET)
      .remove(filePaths);

    if (storageDeleteError) {
      throw new Error(storageDeleteError.message);
    }
  }

  const { error } = await params.supabase
    .from("studio_accounts")
    .delete()
    .eq("user_id", params.user.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function downloadHostedFile(params: {
  supabase: HostedSupabaseClient;
  storagePath: string;
}) {
  const { data, error } = await params.supabase
    .storage
    .from(HOSTED_MEDIA_BUCKET)
    .download(params.storagePath);

  if (error || !data) {
    throw new Error(error?.message ?? "Could not load hosted file.");
  }

  return data;
}
