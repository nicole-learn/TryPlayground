"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { StudioAppMode } from "./studio-app-mode";
import { readUploadedAssetMediaMetadata } from "./studio-asset-metadata";
import {
  loadStoredProviderSettings,
  saveStoredProviderSettings,
} from "./studio-browser-storage";
import {
  canGenerateWithDraft,
} from "./studio-generation-rules";
import { reorderStudioFoldersByIds, sortStudioFoldersByOrder } from "./studio-folder-order";
import {
  getConfiguredStudioModels,
  normalizeStudioEnabledModelIds,
  resolveConfiguredStudioModelId,
  toggleStudioModelEnabled,
} from "./studio-model-configuration";
import {
  buildStudioDraftMap,
  createDraft,
  createDraftSnapshot,
  createStudioSeedSnapshot,
  hydrateDraft,
  toPersistedDraft,
} from "./studio-local-runtime-data";
import {
  appendLibraryItemsToPrompt,
  createDraftReferenceFromFile,
  createDraftReferenceFromLibraryItem,
  createFolderItemCounts,
  hasFolderNameConflict,
  isInFlightStudioRunStatus,
  isReferenceEligibleLibraryItem,
  mergeDraftReferences,
  releaseDraftReferencePreview,
  releaseRemovedDraftReferencePreviews,
  resolveLibraryItemToReferenceFile,
  revokePreviewUrl,
} from "./studio-local-runtime-helpers";
import {
  STUDIO_MODEL_CATALOG,
  STUDIO_MODEL_SECTIONS,
  getStudioModelById,
} from "./studio-model-catalog";
import {
  getHostedAccessToken,
  getHostedSessionState,
  signInWithGoogleHostedSession,
  signOutHostedSession,
  subscribeToHostedAuthChanges,
} from "./studio-hosted-session";
import type {
  LocalStudioMutation,
  LocalStudioSnapshotResponse,
  LocalStudioSyncResponse,
  LocalStudioUploadManifestEntry,
} from "./studio-local-api";
import type {
  HostedStudioGenerateInputDescriptor,
  HostedStudioMutation,
  HostedStudioMutationResponse,
  HostedStudioSyncResponse,
  HostedStudioUploadManifestEntry,
} from "./studio-hosted-mock-api";
import { getStudioUploadedMediaKind, studioUploadSupportsAlpha } from "./studio-upload-files";
import type {
  DraftReference,
  GenerationRun,
  LibraryItem,
  PersistedStudioDraft,
  StudioCreditPurchaseAmount,
  StudioDraft,
  StudioFolderEditorMode,
  StudioHostedAccount,
  StudioHostedWorkspaceState,
  StudioModelConfiguration,
  StudioProviderConnectionStatus,
  StudioProviderSaveResult,
  StudioProviderSettings,
  StudioVideoInputMode,
  StudioWorkspaceSnapshot,
} from "./types";

const EMPTY_PROVIDER_SETTINGS: StudioProviderSettings = {
  falApiKey: "",
  lastValidatedAt: null,
};

type HostedAuthStatus = "checking" | "signed_out" | "signed_in";

function createSignedOutHostedSnapshot(seedSnapshot: StudioWorkspaceSnapshot) {
  return {
    ...seedSnapshot,
    profile: {
      ...seedSnapshot.profile,
      id: "hosted-signed-out",
      email: "",
      displayName: "",
      avatarLabel: "G",
      avatarUrl: null,
    },
    creditBalance: null,
    activeCreditPack: null,
    folders: [],
    runFiles: [],
    libraryItems: [],
    generationRuns: [],
  } satisfies StudioWorkspaceSnapshot;
}

function createEmptyDraftReferenceMap() {
  return Object.fromEntries(
    STUDIO_MODEL_CATALOG.map((model) => [model.id, [] as DraftReference[]])
  ) as Record<string, DraftReference[]>;
}

type DraftFrameInputs = {
  startFrame: DraftReference | null;
  endFrame: DraftReference | null;
};

function createEmptyDraftFrameMap() {
  return Object.fromEntries(
    STUDIO_MODEL_CATALOG.map((model) => [
      model.id,
      { startFrame: null, endFrame: null } satisfies DraftFrameInputs,
    ])
  ) as Record<string, DraftFrameInputs>;
}

async function fetchHostedWithSession(
  input: RequestInfo | URL,
  init?: RequestInit
) {
  const accessToken = await getHostedAccessToken();
  if (!accessToken) {
    throw new Error("Sign in with Google to use hosted mode.");
  }

  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);

  const response = await fetch(input, {
    ...init,
    headers,
    cache: "no-store",
    credentials: "same-origin",
  });

  if (response.status !== 401) {
    return response;
  }

  await signOutHostedSession().catch(() => undefined);
  throw new Error("Your hosted session expired. Sign in with Google again.");
}

async function fetchLocalBootstrap(signal?: AbortSignal) {
  const response = await fetch("/api/studio/local/bootstrap", {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
    signal,
  });
  const payload = (await response.json()) as LocalStudioSyncResponse & {
    error?: string;
  };

  if (!response.ok || payload.kind === "noop") {
    throw new Error(payload.error ?? "Could not load local workspace.");
  }

  return payload;
}

async function fetchLocalSync(params: {
  sinceRevision: number | null;
  signal?: AbortSignal;
}) {
  const searchParams = new URLSearchParams();
  if (typeof params.sinceRevision === "number") {
    searchParams.set("sinceRevision", String(params.sinceRevision));
  }

  const response = await fetch(`/api/studio/local/sync?${searchParams.toString()}`, {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
    signal: params.signal,
  });
  const payload = (await response.json()) as LocalStudioSyncResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Could not sync local workspace.");
  }

  return payload;
}

async function mutateLocalSnapshot(
  mutation: LocalStudioMutation,
  signal?: AbortSignal
) {
  const response = await fetch("/api/studio/local/mutate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(mutation),
    cache: "no-store",
    credentials: "same-origin",
    signal,
  });
  const payload = (await response.json()) as LocalStudioSnapshotResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Local workspace mutation failed.");
  }

  return payload;
}

async function uploadLocalFiles(
  files: File[],
  folderId: string | null,
  signal?: AbortSignal
) {
  const manifest = (
    await Promise.all(
      files.map(async (file) => {
        const kind = getStudioUploadedMediaKind({
          fileName: file.name,
          mimeType: file.type,
        });

        if (!kind) {
          return null;
        }

        const previewUrl = URL.createObjectURL(file);
        try {
          const metadata = await readUploadedAssetMediaMetadata({
            kind,
            previewUrl,
            mimeType: file.type,
            hasAlpha: studioUploadSupportsAlpha(file.type),
          });

          return {
            kind,
            mediaWidth: metadata.mediaWidth,
            mediaHeight: metadata.mediaHeight,
            mediaDurationSeconds: metadata.mediaDurationSeconds,
            aspectRatioLabel: metadata.aspectRatioLabel,
            hasAlpha: metadata.hasAlpha,
          } satisfies LocalStudioUploadManifestEntry;
        } finally {
          URL.revokeObjectURL(previewUrl);
        }
      })
    )
  ).filter((entry): entry is LocalStudioUploadManifestEntry => Boolean(entry));

  if (manifest.length !== files.length) {
    throw new Error("Only image, video, and audio uploads are supported.");
  }

  const formData = new FormData();
  if (folderId) {
    formData.set("folderId", folderId);
  }
  formData.set("manifest", JSON.stringify(manifest));
  for (const file of files) {
    formData.append("files", file);
  }

  const response = await fetch("/api/studio/local/uploads", {
    method: "POST",
    body: formData,
    cache: "no-store",
    credentials: "same-origin",
    signal,
  });
  const payload = (await response.json()) as LocalStudioSnapshotResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Local upload failed.");
  }

  return payload;
}

async function fetchHostedSync(params: {
  sinceRevision: number | null;
  signal?: AbortSignal;
}) {
  const searchParams = new URLSearchParams();
  if (typeof params.sinceRevision === "number") {
    searchParams.set("sinceRevision", String(params.sinceRevision));
  }

  const response = await fetchHostedWithSession(`/api/studio/hosted/sync?${searchParams.toString()}`, {
    method: "GET",
    signal: params.signal,
  });
  const payload = (await response.json()) as HostedStudioSyncResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Could not load hosted workspace.");
  }

  return payload;
}

async function mutateHostedSnapshot(
  mutation: HostedStudioMutation,
  signal?: AbortSignal
) {
  const response = await fetchHostedWithSession("/api/studio/hosted/mutate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(mutation),
    signal,
  });
  const payload = (await response.json()) as HostedStudioMutationResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Hosted workspace mutation failed.");
  }

  return payload;
}

async function uploadHostedFiles(
  files: File[],
  folderId: string | null,
  signal?: AbortSignal
) {
  const manifest = (
    await Promise.all(
      files.map(async (file) => {
        const kind = getStudioUploadedMediaKind({
          fileName: file.name,
          mimeType: file.type,
        });

        if (!kind) {
          return null;
        }

        const previewUrl = URL.createObjectURL(file);
        try {
          const metadata = await readUploadedAssetMediaMetadata({
            kind,
            previewUrl,
            mimeType: file.type,
            hasAlpha: studioUploadSupportsAlpha(file.type),
          });

          return {
            kind,
            mediaWidth: metadata.mediaWidth,
            mediaHeight: metadata.mediaHeight,
            mediaDurationSeconds: metadata.mediaDurationSeconds,
            aspectRatioLabel: metadata.aspectRatioLabel,
            hasAlpha: metadata.hasAlpha,
          } satisfies HostedStudioUploadManifestEntry;
        } finally {
          URL.revokeObjectURL(previewUrl);
        }
      })
    )
  ).filter(
    (entry): entry is HostedStudioUploadManifestEntry => Boolean(entry)
  );
  if (manifest.length !== files.length) {
    throw new Error("Only image, video, and audio uploads are supported.");
  }

  const formData = new FormData();
  if (folderId) {
    formData.set("folderId", folderId);
  }
  formData.set("manifest", JSON.stringify(manifest));
  for (const file of files) {
    formData.append("files", file);
  }

  const response = await fetchHostedWithSession("/api/studio/hosted/uploads", {
    method: "POST",
    body: formData,
    signal,
  });
  const payload = (await response.json()) as HostedStudioMutationResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Hosted upload failed.");
  }

  return payload;
}

async function queueHostedGeneration(params: {
  modelId: string;
  folderId: string | null;
  draft: GenerationRun["draftSnapshot"] | PersistedStudioDraft;
  inputs: HostedStudioGenerateInputDescriptor[];
  filesByField: Map<string, File>;
  signal?: AbortSignal;
}) {
  const formData = new FormData();
  formData.set("modelId", params.modelId);
  if (params.folderId) {
    formData.set("folderId", params.folderId);
  }
  formData.set("draft", JSON.stringify(params.draft));
  formData.set("inputs", JSON.stringify(params.inputs));

  for (const [field, file] of params.filesByField.entries()) {
    formData.append(`input-file:${field}`, file);
  }

  const response = await fetchHostedWithSession("/api/studio/hosted/generate", {
    method: "POST",
    body: formData,
    signal: params.signal,
  });
  const payload = (await response.json()) as HostedStudioMutationResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? "Hosted generation could not be queued.");
  }

  return payload;
}

async function deleteHostedAccountRequest(signal?: AbortSignal) {
  const response = await fetchHostedWithSession("/api/studio/hosted/account", {
    method: "DELETE",
    signal,
  });
  const payload = (await response.json()) as { error?: string; ok?: boolean };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error ?? "Could not delete your hosted account.");
  }
}

async function validateFalApiKey(falApiKey: string) {
  const response = await fetch("/api/providers/fal/validate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ falApiKey }),
    cache: "no-store",
    credentials: "same-origin",
  });
  const payload = (await response.json()) as {
    error?: string;
    ok?: boolean;
    validatedAt?: string;
  };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error ?? "Could not validate your Fal API key.");
  }

  return payload.validatedAt ?? new Date().toISOString();
}

export function useStudioMockRuntime(appMode: StudioAppMode) {
  const seedSnapshot = useMemo(() => createStudioSeedSnapshot(appMode), [appMode]);
  const signedOutHostedSnapshot = useMemo(
    () => createSignedOutHostedSnapshot(seedSnapshot),
    [seedSnapshot]
  );
  const previewUrlsRef = useRef(new Map<string, string>());
  const storageHydratedRef = useRef(false);
  const dispatchTimersRef = useRef(new Map<string, number>());
  const completionTimersRef = useRef(new Map<string, number>());
  const draftReferencesRef = useRef(createEmptyDraftReferenceMap());
  const draftFramesRef = useRef(createEmptyDraftFrameMap());
  const runsRef = useRef(seedSnapshot.generationRuns);
  const localModeSessionRef = useRef(0);
  const localLatestStartedRequestRef = useRef(0);
  const localLatestAppliedRequestRef = useRef(0);
  const localRevisionRef = useRef(0);
  const localSyncIntervalRef = useRef(1200);
  const localRequestControllersRef = useRef(new Set<AbortController>());
  const hostedModeSessionRef = useRef(0);
  const hostedLatestStartedRequestRef = useRef(0);
  const hostedLatestAppliedRequestRef = useRef(0);
  const hostedRevisionRef = useRef(0);
  const hostedSyncIntervalRef = useRef(1400);
  const hostedRequestControllersRef = useRef(new Set<AbortController>());
  const zeroCreditsDialogOpenedRef = useRef(false);

  const [profile, setProfile] = useState(seedSnapshot.profile);
  const [creditBalance, setCreditBalance] = useState(seedSnapshot.creditBalance);
  const [activeCreditPack, setActiveCreditPack] = useState(seedSnapshot.activeCreditPack);
  const [modelConfiguration, setModelConfiguration] = useState<StudioModelConfiguration>(
    seedSnapshot.modelConfiguration
  );
  const [, setQueueSettings] = useState(seedSnapshot.queueSettings);
  const [selectedModelId, setSelectedModelIdState] = useState(seedSnapshot.selectedModelId);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState(seedSnapshot.folders);
  const [items, setItems] = useState(seedSnapshot.libraryItems);
  const [, setRunFiles] = useState(seedSnapshot.runFiles);
  const [runs, setRuns] = useState(seedSnapshot.generationRuns);
  const [draftsByModelId, setDraftsByModelId] = useState(seedSnapshot.draftsByModelId);
  const [draftReferencesByModelId, setDraftReferencesByModelId] = useState(
    createEmptyDraftReferenceMap
  );
  const [draftFramesByModelId, setDraftFramesByModelId] = useState(
    createEmptyDraftFrameMap
  );
  const [gallerySizeLevel, setGallerySizeLevelState] = useState(
    seedSnapshot.gallerySizeLevel
  );
  const [providerSettings, setProviderSettings] = useState<StudioProviderSettings>(
    EMPTY_PROVIDER_SETTINGS
  );
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [providerConnectionStatus, setProviderConnectionStatus] =
    useState<StudioProviderConnectionStatus>("idle");
  const [folderEditorOpen, setFolderEditorOpen] = useState(false);
  const [folderEditorMode, setFolderEditorMode] =
    useState<StudioFolderEditorMode>("create");
  const [folderEditorValue, setFolderEditorValue] = useState("");
  const [folderEditorTargetId, setFolderEditorTargetId] = useState<string | null>(
    null
  );
  const [folderEditorError, setFolderEditorError] = useState<string | null>(null);
  const [folderEditorSaving, setFolderEditorSaving] = useState(false);
  const [selectionModeEnabled, setSelectionModeEnabled] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [createTextDialogOpen, setCreateTextDialogOpen] = useState(false);
  const [createTextTitle, setCreateTextTitle] = useState("");
  const [createTextBody, setCreateTextBody] = useState("");
  const [createTextSaving, setCreateTextSaving] = useState(false);
  const [createTextErrorMessage, setCreateTextErrorMessage] = useState<string | null>(
    null
  );
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadDialogFolderId, setUploadDialogFolderId] = useState<string | null>(
    null
  );
  const [uploadAssetsLoading, setUploadAssetsLoading] = useState(false);
  const [queueLimitDialogOpen, setQueueLimitDialogOpen] = useState(false);
  const [purchaseCreditsPending, setPurchaseCreditsPending] = useState(false);
  const [hostedSetupMessage, setHostedSetupMessage] = useState<string | null>(null);
  const [hostedAuthStatus, setHostedAuthStatus] = useState<HostedAuthStatus>(
    appMode === "hosted" ? "checking" : "signed_out"
  );
  const [hostedAuthDialogOpen, setHostedAuthDialogOpen] = useState(false);
  const [hostedAuthPending, setHostedAuthPending] = useState(false);
  const [hostedAuthErrorMessage, setHostedAuthErrorMessage] = useState<string | null>(
    null
  );
  const [hostedSessionUser, setHostedSessionUser] = useState<User | null>(null);
  const normalizedEnabledModelIds = useMemo(
    () => normalizeStudioEnabledModelIds(modelConfiguration.enabledModelIds),
    [modelConfiguration.enabledModelIds]
  );
  const models = useMemo(
    () => getConfiguredStudioModels(normalizedEnabledModelIds),
    [normalizedEnabledModelIds]
  );
  const hostedUserSignedIn = hostedAuthStatus === "signed_in";

  const applySnapshot = useCallback(
    (nextSnapshot: StudioWorkspaceSnapshot, options?: { preserveDrafts?: boolean }) => {
      setProfile(nextSnapshot.profile);
      setCreditBalance(nextSnapshot.creditBalance);
      setActiveCreditPack(nextSnapshot.activeCreditPack);
      setModelConfiguration({
        ...nextSnapshot.modelConfiguration,
        enabledModelIds: normalizeStudioEnabledModelIds(
          nextSnapshot.modelConfiguration.enabledModelIds
        ),
      });
      setQueueSettings(nextSnapshot.queueSettings);
      setFolders(sortStudioFoldersByOrder(nextSnapshot.folders));
      setRunFiles(nextSnapshot.runFiles);
      setRuns(nextSnapshot.generationRuns);
      setItems(nextSnapshot.libraryItems);

      if (!options?.preserveDrafts) {
        setDraftsByModelId(nextSnapshot.draftsByModelId);
        setSelectedModelIdState(nextSnapshot.selectedModelId);
        setGallerySizeLevelState(nextSnapshot.gallerySizeLevel);
      }
    },
    []
  );

  const applyHostedState = useCallback((nextState: StudioHostedWorkspaceState) => {
    hostedRevisionRef.current = nextState.revision;
    setProfile(nextState.profile);
    setCreditBalance(nextState.creditBalance);
    setActiveCreditPack(nextState.activeCreditPack);
    setModelConfiguration({
      ...nextState.modelConfiguration,
      enabledModelIds: normalizeStudioEnabledModelIds(
        nextState.modelConfiguration.enabledModelIds
      ),
    });
    setQueueSettings(nextState.queueSettings);
    setFolders(sortStudioFoldersByOrder(nextState.folders));
    setRunFiles(nextState.runFiles);
    setRuns(nextState.generationRuns);
    setItems(nextState.libraryItems);
  }, []);

  useEffect(() => {
    runsRef.current = runs;
  }, [runs]);

  const getVisibleModelId = useCallback(
    (modelId: string) => {
      return resolveConfiguredStudioModelId({
        currentModelId: modelId,
        enabledModelIds: normalizedEnabledModelIds,
      });
    },
    [normalizedEnabledModelIds]
  );

  const visibleSelectedModelId = getVisibleModelId(selectedModelId);

  useEffect(() => {
    if (selectedModelId !== visibleSelectedModelId) {
      setSelectedModelIdState(visibleSelectedModelId);
    }
  }, [selectedModelId, visibleSelectedModelId]);

  useEffect(() => {
    draftReferencesRef.current = draftReferencesByModelId;
  }, [draftReferencesByModelId]);

  useEffect(() => {
    draftFramesRef.current = draftFramesByModelId;
  }, [draftFramesByModelId]);

  const clearAllTimers = useCallback(() => {
    for (const timerId of dispatchTimersRef.current.values()) {
      window.clearTimeout(timerId);
    }
    for (const timerId of completionTimersRef.current.values()) {
      window.clearTimeout(timerId);
    }
    dispatchTimersRef.current.clear();
    completionTimersRef.current.clear();
  }, []);

  const abortLocalRequests = useCallback(() => {
    for (const controller of localRequestControllersRef.current) {
      controller.abort();
    }
    localRequestControllersRef.current.clear();
  }, []);

  const beginLocalRequest = useCallback(() => {
    const controller = new AbortController();
    const sessionId = localModeSessionRef.current;
    const requestId = localLatestStartedRequestRef.current + 1;
    localLatestStartedRequestRef.current = requestId;
    localRequestControllersRef.current.add(controller);

    return {
      controller,
      requestId,
      sessionId,
    };
  }, []);

  const finishLocalRequest = useCallback((controller: AbortController) => {
    localRequestControllersRef.current.delete(controller);
  }, []);

  const applyLocalResponse = useCallback(
    (
      nextSnapshot: StudioWorkspaceSnapshot,
      params: { preserveDrafts?: boolean; requestId: number; sessionId: number; revision: number }
    ) => {
      if (localModeSessionRef.current !== params.sessionId) {
        return false;
      }

      if (params.requestId < localLatestAppliedRequestRef.current) {
        return false;
      }

      localLatestAppliedRequestRef.current = params.requestId;
      localRevisionRef.current = params.revision;
      applySnapshot(nextSnapshot, { preserveDrafts: params.preserveDrafts });
      return true;
    },
    [applySnapshot]
  );

  const abortHostedRequests = useCallback(() => {
    for (const controller of hostedRequestControllersRef.current) {
      controller.abort();
    }
    hostedRequestControllersRef.current.clear();
  }, []);

  const beginHostedRequest = useCallback(() => {
    const controller = new AbortController();
    const sessionId = hostedModeSessionRef.current;
    const requestId = hostedLatestStartedRequestRef.current + 1;
    hostedLatestStartedRequestRef.current = requestId;
    hostedRequestControllersRef.current.add(controller);

    return {
      controller,
      requestId,
      sessionId,
    };
  }, []);

  const finishHostedRequest = useCallback((controller: AbortController) => {
    hostedRequestControllersRef.current.delete(controller);
  }, []);

  const applyHostedResponse = useCallback(
    (
      nextState: StudioHostedWorkspaceState,
      params: { requestId: number; sessionId: number }
    ) => {
      if (hostedModeSessionRef.current !== params.sessionId) {
        return false;
      }

      if (params.requestId < hostedLatestAppliedRequestRef.current) {
        return false;
      }

      hostedLatestAppliedRequestRef.current = params.requestId;
      applyHostedState(nextState);
      return true;
    },
    [applyHostedState]
  );

  const cleanupPreviewUrls = useCallback(() => {
    for (const previewUrl of previewUrlsRef.current.values()) {
      revokePreviewUrl(previewUrl);
    }
    previewUrlsRef.current.clear();
  }, []);

  const cleanupDraftReferences = useCallback(() => {
    for (const references of Object.values(draftReferencesRef.current)) {
      for (const reference of references) {
        releaseDraftReferencePreview(reference);
      }
    }

    for (const frameInputs of Object.values(draftFramesRef.current)) {
      if (frameInputs.startFrame) {
        releaseDraftReferencePreview(frameInputs.startFrame);
      }
      if (frameInputs.endFrame) {
        releaseDraftReferencePreview(frameInputs.endFrame);
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      abortLocalRequests();
      abortHostedRequests();
      clearAllTimers();
      cleanupPreviewUrls();
      cleanupDraftReferences();
    };
  }, [
    abortLocalRequests,
    abortHostedRequests,
    cleanupDraftReferences,
    cleanupPreviewUrls,
    clearAllTimers,
  ]);

  useEffect(() => {
    if (appMode !== "hosted") {
      setHostedAuthStatus("signed_out");
      setHostedSessionUser(null);
      setHostedAuthDialogOpen(false);
      setHostedAuthPending(false);
      setHostedAuthErrorMessage(null);
      return;
    }

    let cancelled = false;
    setHostedAuthStatus("checking");

    const clearHostedAuthErrorFromUrl = () => {
      if (typeof window === "undefined") {
        return;
      }

      const url = new URL(window.location.href);
      if (!url.searchParams.has("hostedAuthError")) {
        return;
      }

      url.searchParams.delete("hostedAuthError");
      window.history.replaceState({}, "", url.toString());
    };

    void getHostedSessionState()
      .then((sessionState) => {
        if (cancelled) {
          return;
        }

        clearHostedAuthErrorFromUrl();
        setHostedSessionUser(sessionState.user);
        setHostedAuthStatus(
          sessionState.accessToken ? "signed_in" : "signed_out"
        );
        setHostedAuthDialogOpen(!sessionState.accessToken);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setHostedSessionUser(null);
        setHostedAuthStatus("signed_out");
        setHostedAuthDialogOpen(true);
        setHostedAuthErrorMessage(
          error instanceof Error
            ? error.message
            : "Could not check your hosted session."
        );
      })
      .finally(() => {
        if (!cancelled) {
          setHostedAuthPending(false);
        }
      });

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (url.searchParams.get("hostedAuthError") === "google-sign-in") {
        setHostedAuthErrorMessage(
          "Google sign-in could not be completed. Try again."
        );
      } else {
        setHostedAuthErrorMessage(null);
      }
    }

    const unsubscribe = subscribeToHostedAuthChanges((sessionState) => {
      if (cancelled) {
        return;
      }

      setHostedSessionUser(sessionState.user);
      setHostedAuthStatus(sessionState.accessToken ? "signed_in" : "signed_out");
      setHostedAuthDialogOpen(!sessionState.accessToken);
      setHostedAuthPending(false);
      if (sessionState.accessToken) {
        setHostedAuthErrorMessage(null);
      }

      if (!sessionState.accessToken) {
        setSettingsDialogOpen(false);
        zeroCreditsDialogOpenedRef.current = false;
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [appMode]);

  useEffect(() => {
    let cancelled = false;

    storageHydratedRef.current = false;
    localModeSessionRef.current += 1;
    localLatestStartedRequestRef.current = 0;
    localLatestAppliedRequestRef.current = 0;
    localRevisionRef.current = 0;
    abortLocalRequests();
    hostedModeSessionRef.current += 1;
    hostedLatestStartedRequestRef.current = 0;
    hostedLatestAppliedRequestRef.current = 0;
    hostedRevisionRef.current = 0;
    abortHostedRequests();
    clearAllTimers();
    cleanupPreviewUrls();
    cleanupDraftReferences();

    const resetUiState = () => {
      setProviderSettings(EMPTY_PROVIDER_SETTINGS);
      setProviderConnectionStatus("idle");
      setSettingsDialogOpen(false);
      setSelectedFolderId(null);
      setSelectionModeEnabled(false);
      setSelectedItemIds([]);
      setFolderEditorOpen(false);
      setFolderEditorError(null);
      setFolderEditorTargetId(null);
      setFolderEditorValue("");
      setCreateTextDialogOpen(false);
      setCreateTextTitle("");
      setCreateTextBody("");
      setCreateTextErrorMessage(null);
      setUploadDialogOpen(false);
      setUploadDialogFolderId(null);
      setQueueLimitDialogOpen(false);
      setHostedSetupMessage(null);
      setDraftReferencesByModelId(createEmptyDraftReferenceMap());
      setDraftFramesByModelId(createEmptyDraftFrameMap());
    };

    resetUiState();

    if (appMode === "hosted") {
      if (hostedAuthStatus !== "signed_in") {
        applySnapshot(signedOutHostedSnapshot);
        storageHydratedRef.current = true;
        return () => {
          cancelled = true;
        };
      }

      const request = beginHostedRequest();

      void fetchHostedSync({
        sinceRevision: null,
        signal: request.controller.signal,
      })
        .then((response) => {
          finishHostedRequest(request.controller);

          if (cancelled) {
            return;
          }

          setHostedSetupMessage(null);
          if (response.kind === "noop") {
            applySnapshot(seedSnapshot);
            storageHydratedRef.current = true;
            return;
          }

          hostedSyncIntervalRef.current = response.syncIntervalMs;
          applyHostedResponse(response.state, {
            requestId: request.requestId,
            sessionId: request.sessionId,
          });
          if (response.kind === "bootstrap") {
            setSelectedModelIdState(response.uiStateDefaults.selectedModelId);
            setGallerySizeLevelState(response.uiStateDefaults.gallerySizeLevel);
          }
          storageHydratedRef.current = true;
        })
        .catch((error) => {
          finishHostedRequest(request.controller);

          if (cancelled) {
            return;
          }

          setHostedSetupMessage(
            error instanceof Error
              ? error.message
              : "Hosted setup is incomplete."
          );
          applySnapshot(signedOutHostedSnapshot);
          storageHydratedRef.current = true;
        });

      return () => {
        cancelled = true;
      };
    }

    const nextProviderSettings =
      loadStoredProviderSettings() ?? EMPTY_PROVIDER_SETTINGS;
    setProviderSettings(nextProviderSettings);
    setProviderConnectionStatus(nextProviderSettings.falApiKey ? "connected" : "idle");
    const request = beginLocalRequest();

    void fetchLocalBootstrap(request.controller.signal)
      .then((response) => {
        finishLocalRequest(request.controller);

        if (cancelled) {
          return;
        }

        localSyncIntervalRef.current = response.syncIntervalMs;
        applyLocalResponse(response.snapshot, {
          requestId: request.requestId,
          revision: response.revision,
          sessionId: request.sessionId,
        });
        storageHydratedRef.current = true;
      })
      .catch(() => {
        finishLocalRequest(request.controller);

        if (cancelled) {
          return;
        }

        applySnapshot(seedSnapshot);
        storageHydratedRef.current = true;
      });

    return () => {
      cancelled = true;
    };
  }, [
    appMode,
    abortLocalRequests,
    applySnapshot,
    applyLocalResponse,
    cleanupDraftReferences,
    cleanupPreviewUrls,
    clearAllTimers,
    seedSnapshot,
    signedOutHostedSnapshot,
    abortHostedRequests,
    applyHostedResponse,
    hostedAuthStatus,
    beginLocalRequest,
    beginHostedRequest,
    finishLocalRequest,
    finishHostedRequest,
  ]);

  useEffect(() => {
    if (!storageHydratedRef.current || appMode !== "local") {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      const request = beginLocalRequest();

      void mutateLocalSnapshot(
        {
          action: "save_ui_state",
          draftsByModelId,
          selectedModelId: visibleSelectedModelId,
          gallerySizeLevel,
          lastValidatedAt: providerSettings.lastValidatedAt,
        },
        request.controller.signal
      )
        .then((response) => {
          finishLocalRequest(request.controller);

          if (cancelled) {
            return;
          }

          applyLocalResponse(response.snapshot, {
            preserveDrafts: true,
            requestId: request.requestId,
            revision: response.revision,
            sessionId: request.sessionId,
          });
        })
        .catch((error) => {
          finishLocalRequest(request.controller);
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    appMode,
    draftsByModelId,
    gallerySizeLevel,
    providerSettings,
    visibleSelectedModelId,
    applyLocalResponse,
    beginLocalRequest,
    finishLocalRequest,
  ]);

  useEffect(() => {
    if (
      !storageHydratedRef.current ||
      appMode !== "hosted" ||
      !hostedUserSignedIn
    ) {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      const request = beginHostedRequest();

      void mutateHostedSnapshot(
        {
          action: "save_ui_state",
          selectedModelId: visibleSelectedModelId,
          gallerySizeLevel,
        },
        request.controller.signal
      )
        .then((response) => {
          finishHostedRequest(request.controller);

          if (cancelled) {
            return;
          }

          applyHostedResponse(response.state, {
            requestId: request.requestId,
            sessionId: request.sessionId,
          });
        })
        .catch((error) => {
          finishHostedRequest(request.controller);
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    appMode,
    gallerySizeLevel,
    hostedUserSignedIn,
    visibleSelectedModelId,
    applyHostedResponse,
    beginHostedRequest,
    finishHostedRequest,
  ]);

  useEffect(() => {
    if (appMode !== "local" || !storageHydratedRef.current) {
      return;
    }

    saveStoredProviderSettings(providerSettings);
  }, [appMode, providerSettings]);

  useEffect(() => {
    if (
      appMode !== "hosted" ||
      !storageHydratedRef.current ||
      !hostedUserSignedIn
    ) {
      return;
    }

    let timeoutId = 0;
    let cancelled = false;

    const scheduleNextSync = () => {
      if (cancelled) {
        return;
      }

      timeoutId = window.setTimeout(() => {
        const request = beginHostedRequest();

        void fetchHostedSync({
          sinceRevision: hostedRevisionRef.current,
          signal: request.controller.signal,
        })
          .then((response) => {
            finishHostedRequest(request.controller);
            hostedSyncIntervalRef.current = response.syncIntervalMs;

            if (response.kind !== "noop") {
              applyHostedResponse(response.state, {
                requestId: request.requestId,
                sessionId: request.sessionId,
              });
            }

            scheduleNextSync();
          })
          .catch((error) => {
            finishHostedRequest(request.controller);
            if (error instanceof DOMException && error.name === "AbortError") {
              return;
            }
            // Keep the last known hosted mock state if polling fails.
            scheduleNextSync();
          });
      }, hostedSyncIntervalRef.current);
    };

    scheduleNextSync();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [
    appMode,
    hostedUserSignedIn,
    applyHostedResponse,
    beginHostedRequest,
    finishHostedRequest,
  ]);

  useEffect(() => {
    if (appMode !== "local" || !storageHydratedRef.current) {
      return;
    }

    let timeoutId = 0;
    let cancelled = false;

    const scheduleNextSync = () => {
      if (cancelled) {
        return;
      }

      timeoutId = window.setTimeout(() => {
        const request = beginLocalRequest();

        void fetchLocalSync({
          sinceRevision: localRevisionRef.current,
          signal: request.controller.signal,
        })
          .then((response) => {
            finishLocalRequest(request.controller);
            localSyncIntervalRef.current = response.syncIntervalMs;

            if (response.kind !== "noop") {
              applyLocalResponse(response.snapshot, {
                preserveDrafts: true,
                requestId: request.requestId,
                revision: response.revision,
                sessionId: request.sessionId,
              });
            }

            scheduleNextSync();
          })
          .catch((error) => {
            finishLocalRequest(request.controller);
            if (error instanceof DOMException && error.name === "AbortError") {
              return;
            }
            scheduleNextSync();
          });
      }, localSyncIntervalRef.current);
    };

    scheduleNextSync();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [appMode, applyLocalResponse, beginLocalRequest, finishLocalRequest]);

  const selectedModel = useMemo(
    () => models.find((model) => model.id === visibleSelectedModelId) ?? models[0],
    [models, visibleSelectedModelId]
  );

  const currentDraft = useMemo(() => {
    const persistedDraft =
      draftsByModelId[selectedModel.id] ?? buildStudioDraftMap()[selectedModel.id];
    const references = draftReferencesByModelId[selectedModel.id] ?? [];
    const frameInputs =
      draftFramesByModelId[selectedModel.id] ??
      ({ startFrame: null, endFrame: null } satisfies DraftFrameInputs);

    return {
      ...hydrateDraft(persistedDraft, selectedModel),
      references,
      startFrame: frameInputs.startFrame,
      endFrame: frameInputs.endFrame,
    } satisfies StudioDraft;
  }, [draftFramesByModelId, draftReferencesByModelId, draftsByModelId, selectedModel]);

  const selectedFolder = useMemo(
    () => folders.find((folder) => folder.id === selectedFolderId) ?? null,
    [folders, selectedFolderId]
  );

  const ungroupedItems = useMemo(
    () => items.filter((item) => item.folderId === null),
    [items]
  );

  const selectedFolderItems = useMemo(() => {
    if (!selectedFolderId) {
      return [];
    }

    return items.filter((item) => item.folderId === selectedFolderId);
  }, [items, selectedFolderId]);

  const ungroupedRunCards = useMemo(
    () =>
      runs.filter(
        (run) =>
          run.folderId === null &&
          run.outputAssetId === null &&
          (isInFlightStudioRunStatus(run.status) ||
            run.status === "failed" ||
            run.status === "cancelled")
      ),
    [runs]
  );

  const selectedFolderRunCards = useMemo(() => {
    if (!selectedFolderId) {
      return [];
    }

    return runs.filter(
      (run) =>
        run.folderId === selectedFolderId &&
        run.outputAssetId === null &&
        (isInFlightStudioRunStatus(run.status) ||
          run.status === "failed" ||
          run.status === "cancelled")
    );
  }, [runs, selectedFolderId]);

  const folderCounts = useMemo(
    () => createFolderItemCounts(folders, items),
    [folders, items]
  );

  const selectedItemIdSet = useMemo(
    () => new Set(selectedItemIds),
    [selectedItemIds]
  );

  const selectedItemCount = selectedItemIds.length;
  const hasFalKey = providerSettings.falApiKey.trim().length > 0;
  const maxReferenceFiles = selectedModel.maxReferenceFiles ?? 6;

  const applyLocalMutation = useCallback(
    async (
      mutation: LocalStudioMutation,
      options?: { preserveDrafts?: boolean }
    ) => {
      const request = beginLocalRequest();

      try {
        const response = await mutateLocalSnapshot(
          mutation,
          request.controller.signal
        );
        applyLocalResponse(response.snapshot, {
          preserveDrafts: options?.preserveDrafts ?? true,
          requestId: request.requestId,
          revision: response.revision,
          sessionId: request.sessionId,
        });
        return response.snapshot;
      } finally {
        finishLocalRequest(request.controller);
      }
    },
    [applyLocalResponse, beginLocalRequest, finishLocalRequest]
  );

  const applyLocalUpload = useCallback(
    async (files: File[], folderId: string | null) => {
      const request = beginLocalRequest();

      try {
        const response = await uploadLocalFiles(
          files,
          folderId,
          request.controller.signal
        );
        applyLocalResponse(response.snapshot, {
          preserveDrafts: true,
          requestId: request.requestId,
          revision: response.revision,
          sessionId: request.sessionId,
        });
        return response.snapshot;
      } finally {
        finishLocalRequest(request.controller);
      }
    },
    [applyLocalResponse, beginLocalRequest, finishLocalRequest]
  );

  const refreshLocalState = useCallback(() => {
    const request = beginLocalRequest();

    void fetchLocalSync({
      sinceRevision: null,
      signal: request.controller.signal,
    })
      .then((response) => {
        finishLocalRequest(request.controller);
        if (response.kind === "noop") {
          return;
        }

        localSyncIntervalRef.current = response.syncIntervalMs;
        applyLocalResponse(response.snapshot, {
          preserveDrafts: true,
          requestId: request.requestId,
          revision: response.revision,
          sessionId: request.sessionId,
        });
      })
      .catch(() => {
        finishLocalRequest(request.controller);
      });
  }, [applyLocalResponse, beginLocalRequest, finishLocalRequest]);

  const applyHostedMutation = useCallback(
    async (mutation: HostedStudioMutation) => {
      const request = beginHostedRequest();

      try {
        const response = await mutateHostedSnapshot(
          mutation,
          request.controller.signal
        );
        applyHostedResponse(response.state, {
          requestId: request.requestId,
          sessionId: request.sessionId,
        });
        return response.state;
      } finally {
        finishHostedRequest(request.controller);
      }
    },
    [applyHostedResponse, beginHostedRequest, finishHostedRequest]
  );

  const applyHostedUpload = useCallback(
    async (files: File[], folderId: string | null) => {
      const request = beginHostedRequest();

      try {
        const response = await uploadHostedFiles(
          files,
          folderId,
          request.controller.signal
        );
        applyHostedResponse(response.state, {
          requestId: request.requestId,
          sessionId: request.sessionId,
        });
        return response.state;
      } finally {
        finishHostedRequest(request.controller);
      }
    },
    [applyHostedResponse, beginHostedRequest, finishHostedRequest]
  );

  const refreshHostedState = useCallback(() => {
    const request = beginHostedRequest();

    void fetchHostedSync({
      sinceRevision: null,
      signal: request.controller.signal,
    })
      .then((response) => {
        finishHostedRequest(request.controller);
        if (response.kind === "noop") {
          return;
        }

        hostedSyncIntervalRef.current = response.syncIntervalMs;
        applyHostedResponse(response.state, {
          requestId: request.requestId,
          sessionId: request.sessionId,
        });
      })
      .catch(() => {
        finishHostedRequest(request.controller);
      });
  }, [applyHostedResponse, beginHostedRequest, finishHostedRequest]);

  const hostedAccount = useMemo(() => {
    if (appMode !== "hosted" || !creditBalance) {
      return null;
    }

    return {
      profile,
      creditBalance,
      activeCreditPack,
      queuedCount: runs.filter((run) => run.status === "queued").length,
      generatingCount: runs.filter((run) => run.status === "processing").length,
      completedCount: runs.filter((run) => run.status === "completed").length,
      pricingSummary: "Fal market rate + 15%",
      environmentLabel: hostedSetupMessage ?? "Hosted preview",
    } satisfies StudioHostedAccount;
  }, [activeCreditPack, appMode, creditBalance, hostedSetupMessage, profile, runs]);

  useEffect(() => {
    if (
      appMode !== "hosted" ||
      !hostedUserSignedIn ||
      !creditBalance
    ) {
      zeroCreditsDialogOpenedRef.current = false;
      return;
    }

    if (creditBalance.balanceCredits <= 0) {
      if (!zeroCreditsDialogOpenedRef.current) {
        setSettingsDialogOpen(true);
        zeroCreditsDialogOpenedRef.current = true;
      }
      return;
    }

    zeroCreditsDialogOpenedRef.current = false;
  }, [appMode, creditBalance, hostedUserSignedIn]);

  const hostedSessionAvatarLabel =
    String(
      hostedSessionUser?.user_metadata.full_name ??
        hostedSessionUser?.user_metadata.name ??
        hostedSessionUser?.email ??
        ""
    )
      .trim()
      .slice(0, 1)
      .toUpperCase() || "U";

  const accountButtonLabel =
    appMode === "hosted"
      ? hostedUserSignedIn
        ? profile.avatarLabel || hostedSessionAvatarLabel
        : "G"
      : "T";

  const updateModelConfiguration = useCallback(
    (enabledModelIds: string[]) => {
      const nextEnabledModelIds = normalizeStudioEnabledModelIds(enabledModelIds);
      const updatedAt = new Date().toISOString();

      if (appMode === "hosted") {
        setModelConfiguration({
          enabledModelIds: nextEnabledModelIds,
          updatedAt,
        });
        void applyHostedMutation({
          action: "set_enabled_models",
          enabledModelIds: nextEnabledModelIds,
        }).catch(refreshHostedState);
        return;
      }

      setModelConfiguration({
        enabledModelIds: nextEnabledModelIds,
        updatedAt,
      });
      void applyLocalMutation({
        action: "set_enabled_models",
        enabledModelIds: nextEnabledModelIds,
      }).catch(refreshLocalState);
    },
    [
      appMode,
      applyLocalMutation,
      applyHostedMutation,
      refreshLocalState,
      refreshHostedState,
    ]
  );

  const toggleModelEnabled = useCallback(
    (modelId: string) => {
      updateModelConfiguration(
        toggleStudioModelEnabled({
          enabledModelIds: normalizedEnabledModelIds,
          modelId,
        })
      );
    },
    [normalizedEnabledModelIds, updateModelConfiguration]
  );

  const clearSelection = useCallback(() => {
    setSelectedItemIds([]);
  }, []);

  const toggleSelectionMode = useCallback(() => {
    setSelectionModeEnabled((current) => {
      if (current) {
        setSelectedItemIds([]);
      }

      return !current;
    });
  }, []);

  const toggleItemSelection = useCallback((itemId: string) => {
    setSelectedItemIds((current) =>
      current.includes(itemId)
        ? current.filter((entry) => entry !== itemId)
        : [...current, itemId]
    );
  }, []);

  const updatePersistedDraft = useCallback(
    (patch: Partial<PersistedStudioDraft>) => {
      setDraftsByModelId((current) => ({
        ...current,
        [selectedModel.id]: {
          ...(current[selectedModel.id] ?? toPersistedDraft(createDraft(selectedModel))),
          ...patch,
        },
      }));
    },
    [selectedModel]
  );

  const updateDraft = useCallback(
    (patch: Partial<StudioDraft>) => {
      const nextPatch = { ...patch };
      delete nextPatch.references;
      updatePersistedDraft(nextPatch);
    },
    [updatePersistedDraft]
  );

  const replaceDraftReferences = useCallback(
    (
      nextReferencesOrUpdater:
        | DraftReference[]
        | ((currentReferences: DraftReference[]) => DraftReference[])
    ) => {
      setDraftReferencesByModelId((current) => {
        const existingReferences = current[selectedModel.id] ?? [];
        const nextReferences =
          typeof nextReferencesOrUpdater === "function"
            ? nextReferencesOrUpdater(existingReferences)
            : nextReferencesOrUpdater;

        releaseRemovedDraftReferencePreviews(existingReferences, nextReferences);

        return {
          ...current,
          [selectedModel.id]: nextReferences,
        };
      });
    },
    [selectedModel.id]
  );

  const replaceDraftFrameInputs = useCallback(
    (
      nextFramesOrUpdater:
        | DraftFrameInputs
        | ((currentFrames: DraftFrameInputs) => DraftFrameInputs)
    ) => {
      setDraftFramesByModelId((current) => {
        const existingFrames =
          current[selectedModel.id] ??
          ({ startFrame: null, endFrame: null } satisfies DraftFrameInputs);
        const nextFrames =
          typeof nextFramesOrUpdater === "function"
            ? nextFramesOrUpdater(existingFrames)
            : nextFramesOrUpdater;

        if (
          existingFrames.startFrame &&
          existingFrames.startFrame.id !== nextFrames.startFrame?.id
        ) {
          releaseDraftReferencePreview(existingFrames.startFrame);
        }

        if (
          existingFrames.endFrame &&
          existingFrames.endFrame.id !== nextFrames.endFrame?.id
        ) {
          releaseDraftReferencePreview(existingFrames.endFrame);
        }

        return {
          ...current,
          [selectedModel.id]: nextFrames,
        };
      });
    },
    [selectedModel.id]
  );

  const clearDraftFrameInputs = useCallback(() => {
    replaceDraftFrameInputs({
      startFrame: null,
      endFrame: null,
    });
  }, [replaceDraftFrameInputs]);

  const setVideoInputMode = useCallback(
    (mode: StudioVideoInputMode) => {
      updatePersistedDraft({ videoInputMode: mode });
      replaceDraftReferences([]);
      clearDraftFrameInputs();
    },
    [clearDraftFrameInputs, replaceDraftReferences, updatePersistedDraft]
  );

  const setFrameInput = useCallback(
    (slot: "start" | "end", file: File) => {
      const nextReference = createDraftReferenceFromFile(file);

      updatePersistedDraft({ videoInputMode: "frames" });
      replaceDraftReferences([]);
      replaceDraftFrameInputs((currentFrames) => ({
        startFrame:
          slot === "start" ? nextReference : currentFrames.startFrame,
        endFrame: slot === "end" ? nextReference : currentFrames.endFrame,
      }));
    },
    [replaceDraftFrameInputs, replaceDraftReferences, updatePersistedDraft]
  );

  const clearFrameInput = useCallback(
    (slot: "start" | "end") => {
      replaceDraftFrameInputs((currentFrames) => ({
        startFrame: slot === "start" ? null : currentFrames.startFrame,
        endFrame: slot === "end" ? null : currentFrames.endFrame,
      }));
    },
    [replaceDraftFrameInputs]
  );

  const addDraftReferences = useCallback(
    (nextReferences: DraftReference[]) => {
      const mergedReferences = mergeDraftReferences(
        currentDraft.references,
        nextReferences,
        maxReferenceFiles
      );

      const keptReferenceIds = new Set(
        mergedReferences.map((reference) => reference.id)
      );
      for (const reference of nextReferences) {
        if (!keptReferenceIds.has(reference.id)) {
          releaseDraftReferencePreview(reference);
        }
      }

      replaceDraftReferences(mergedReferences);

      return {
        addedCount: Math.max(0, mergedReferences.length - currentDraft.references.length),
        maxReached: mergedReferences.length >= maxReferenceFiles,
      };
    },
    [currentDraft.references, maxReferenceFiles, replaceDraftReferences]
  );

  const addReferences = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      if (selectedModel.kind === "video" && selectedModel.supportsFrameInputs) {
        updatePersistedDraft({ videoInputMode: "references" });
        clearDraftFrameInputs();
      }
      addDraftReferences(files.map(createDraftReferenceFromFile));
    },
    [addDraftReferences, clearDraftFrameInputs, selectedModel.kind, selectedModel.supportsFrameInputs, updatePersistedDraft]
  );

  const removeReference = useCallback(
    (referenceId: string) => {
      replaceDraftReferences((currentReferences) =>
        currentReferences.filter((reference) => reference.id !== referenceId)
      );
    },
    [replaceDraftReferences]
  );

  const getItemsById = useCallback(
    (itemIds: string[]) => {
      const uniqueIds = Array.from(new Set(itemIds));
      const itemMap = new Map(items.map((item) => [item.id, item]));
      return uniqueIds
        .map((itemId) => itemMap.get(itemId))
        .filter((item): item is LibraryItem => Boolean(item));
    },
    [items]
  );

  const setFrameFromLibraryItems = useCallback(
    async (itemIds: string[], slot: "start" | "end") => {
      const droppedItems = getItemsById(itemIds);
      const imageItem = droppedItems.find((item) => item.kind === "image");

      if (!imageItem) {
        return `Only image assets can be used as a ${slot} frame.`;
      }

      const file = await resolveLibraryItemToReferenceFile(imageItem);
      if (!file) {
        return `Could not load that asset as a ${slot} frame.`;
      }

      setFrameInput(slot, file);
      return null;
    },
    [getItemsById, setFrameInput]
  );

  const getPromptBarDropHint = useCallback(
    (itemIds: string[]) => {
      const droppedItems = getItemsById(itemIds);
      if (droppedItems.length === 0) {
        return "Drop into prompt bar";
      }

      const hasTextItems = droppedItems.some((item) => item.kind === "text");
      const hasReferenceItems = droppedItems.some(isReferenceEligibleLibraryItem);

      if (hasTextItems && hasReferenceItems) {
        if (
          selectedModel.kind === "video" &&
          selectedModel.supportsFrameInputs &&
          currentDraft.videoInputMode === "frames"
        ) {
          return "Drop text here, and drop images onto Start or End frame";
        }

        return selectedModel.supportsReferences
          ? "Drop to add references and prompt text"
          : "Drop to merge text into the prompt";
      }

      if (hasTextItems) {
        return droppedItems.length > 1
          ? "Drop to merge into the prompt"
          : "Drop to merge into the prompt";
      }

      if (hasReferenceItems) {
        if (
          selectedModel.kind === "video" &&
          selectedModel.supportsFrameInputs &&
          currentDraft.videoInputMode === "frames"
        ) {
          return "Drop image assets onto Start or End frame";
        }

        return selectedModel.supportsReferences
          ? droppedItems.length > 1
            ? "Drop to add as references"
            : "Drop to add as reference"
          : "This model doesn't support references yet";
      }

      return "Drop into prompt bar";
    },
    [
      currentDraft.videoInputMode,
      getItemsById,
      selectedModel.kind,
      selectedModel.supportsFrameInputs,
      selectedModel.supportsReferences,
    ]
  );

  const dropLibraryItemsIntoPromptBar = useCallback(
    async (itemIds: string[]) => {
      const droppedItems = getItemsById(itemIds);
      if (droppedItems.length === 0) {
        return "That asset is no longer available.";
      }

      const textItems = droppedItems.filter((item) => item.kind === "text");
      const referenceItems = droppedItems.filter(isReferenceEligibleLibraryItem);
      const messages: string[] = [];

      if (textItems.length > 0) {
        updateDraft({
          prompt: appendLibraryItemsToPrompt(currentDraft.prompt, textItems),
        });
      }

      if (referenceItems.length > 0) {
        const wantsFrameInputs =
          selectedModel.kind === "video" &&
          selectedModel.supportsFrameInputs &&
          currentDraft.videoInputMode === "frames";

        if (wantsFrameInputs) {
          messages.push("Drop image assets onto Start or End frame.");
        } else if (!selectedModel.supportsReferences) {
          messages.push("This model doesn't support references yet.");
        } else {
          const resolvedReferenceEntries = await Promise.all(
            referenceItems.map(async (item) => {
              const file = await resolveLibraryItemToReferenceFile(item);
              if (!file) return null;

              return createDraftReferenceFromLibraryItem({
                file,
                item,
              });
            })
          );

          const validReferences = resolvedReferenceEntries.filter(
            (reference): reference is NonNullable<(typeof resolvedReferenceEntries)[number]> =>
              Boolean(reference)
          );

          if (validReferences.length === 0) {
            messages.push("Could not load the dropped asset as a reference.");
          } else {
            const { addedCount, maxReached } = addDraftReferences(validReferences);
            if (addedCount === 0) {
              messages.push(
                `Those references are already attached or the ${maxReferenceFiles}-reference limit is full.`
              );
            } else if (addedCount < validReferences.length || maxReached) {
              messages.push(
                `Some references were skipped because they were duplicates or the limit is ${maxReferenceFiles}.`
              );
            }
          }
        }
      }

      if (textItems.length === 0 && referenceItems.length === 0) {
        return "Only text, image, video, and audio assets can be dropped here.";
      }

      return messages[0] ?? null;
    },
    [
      addDraftReferences,
      currentDraft.prompt,
      getItemsById,
      maxReferenceFiles,
      currentDraft.videoInputMode,
      selectedModel.supportsReferences,
      selectedModel.kind,
      selectedModel.supportsFrameInputs,
      updateDraft,
    ]
  );

  const moveItemsToFolder = useCallback((itemIds: string[], folderId: string | null) => {
    if (itemIds.length === 0) {
      return;
    }

    if (appMode === "hosted") {
      void applyHostedMutation({
        action: "move_items",
        itemIds,
        folderId,
      });
      return;
    }

    void applyLocalMutation({
      action: "move_items",
      itemIds,
      folderId,
    }).catch(refreshLocalState);
  }, [appMode, applyHostedMutation, applyLocalMutation, refreshLocalState]);

  const deleteItems = useCallback((itemIds: string[]) => {
    if (itemIds.length === 0) return;

    if (appMode === "hosted") {
      void applyHostedMutation({
        action: "delete_items",
        itemIds,
      });
      setSelectedItemIds((current) =>
        current.filter((itemId) => !itemIds.includes(itemId))
      );
      return;
    }

    setSelectedItemIds((current) =>
      current.filter((itemId) => !itemIds.includes(itemId))
    );
    void applyLocalMutation({
      action: "delete_items",
      itemIds,
    }).catch(refreshLocalState);
  }, [appMode, applyHostedMutation, applyLocalMutation, refreshLocalState]);

  const deleteItem = useCallback(
    (itemId: string) => {
      deleteItems([itemId]);
    },
    [deleteItems]
  );

  const deleteSelectedItems = useCallback(() => {
    deleteItems(selectedItemIds);
  }, [deleteItems, selectedItemIds]);

  const resetFolderEditor = useCallback(() => {
    setFolderEditorOpen(false);
    setFolderEditorValue("");
    setFolderEditorTargetId(null);
    setFolderEditorError(null);
  }, []);

  const closeFolderEditor = useCallback(() => {
    if (folderEditorSaving) {
      return;
    }

    resetFolderEditor();
  }, [folderEditorSaving, resetFolderEditor]);

  const updateFolderEditorValue = useCallback((value: string) => {
    setFolderEditorValue(value);
    setFolderEditorError(null);
  }, []);

  const openCreateFolder = useCallback(() => {
    setFolderEditorMode("create");
    setFolderEditorTargetId(null);
    setFolderEditorValue("");
    setFolderEditorError(null);
    setFolderEditorOpen(true);
  }, []);

  const openRenameFolder = useCallback(
    (folderId: string) => {
      const folder = folders.find((entry) => entry.id === folderId);
      if (!folder) return;

      setFolderEditorMode("rename");
      setFolderEditorTargetId(folder.id);
      setFolderEditorValue(folder.name);
      setFolderEditorError(null);
      setFolderEditorOpen(true);
    },
    [folders]
  );

  const saveFolder = useCallback(async () => {
    if (folderEditorSaving) {
      return;
    }

    setFolderEditorSaving(true);

    try {
      const nextName = folderEditorValue.trim();
      if (!nextName) {
        setFolderEditorError("Folder name is required.");
        return;
      }

      if (hasFolderNameConflict(folders, nextName, folderEditorTargetId)) {
        setFolderEditorError("A folder with that name already exists.");
        return;
      }

      if (appMode === "hosted") {
        if (folderEditorMode === "create") {
          await applyHostedMutation({
            action: "create_folder",
            name: nextName,
          });
        } else if (folderEditorTargetId) {
          await applyHostedMutation({
            action: "rename_folder",
            folderId: folderEditorTargetId,
            name: nextName,
          });
        }

        resetFolderEditor();
        return;
      }

      if (folderEditorMode === "create") {
        const nextSnapshot = await applyLocalMutation({
          action: "create_folder",
          name: nextName,
        });
        setSelectedFolderId(nextSnapshot.folders[0]?.id ?? null);
        resetFolderEditor();
        return;
      }

      if (!folderEditorTargetId) {
        return;
      }

      await applyLocalMutation({
        action: "rename_folder",
        folderId: folderEditorTargetId,
        name: nextName,
      });
      resetFolderEditor();
    } catch (error) {
      setFolderEditorError(
        error instanceof Error ? error.message : "Could not save folder."
      );
    } finally {
      setFolderEditorSaving(false);
    }
  }, [
    appMode,
    applyLocalMutation,
    folderEditorMode,
    folderEditorSaving,
    folderEditorTargetId,
    folderEditorValue,
    folders,
    applyHostedMutation,
    resetFolderEditor,
  ]);

  const deleteFolder = useCallback((folderId: string) => {
    if (appMode === "hosted") {
      void applyHostedMutation({
        action: "delete_folder",
        folderId,
      });
      setSelectedFolderId((current) => (current === folderId ? null : current));
      return;
    }

    setSelectedFolderId((current) => (current === folderId ? null : current));
    void applyLocalMutation({
      action: "delete_folder",
      folderId,
    }).catch(refreshLocalState);
  }, [appMode, applyHostedMutation, applyLocalMutation, refreshLocalState]);

  const reorderFolders = useCallback(
    (orderedFolderIds: string[]) => {
      if (orderedFolderIds.length === 0) {
        return;
      }

      const updatedAt = new Date().toISOString();
      setFolders((current) =>
        reorderStudioFoldersByIds(current, orderedFolderIds, updatedAt)
      );

      if (appMode === "hosted") {
        void applyHostedMutation({
          action: "reorder_folders",
          orderedFolderIds,
        }).catch(refreshHostedState);
        return;
      }

      void applyLocalMutation({
        action: "reorder_folders",
        orderedFolderIds,
      }).catch(refreshLocalState);
    },
    [
      appMode,
      applyLocalMutation,
      applyHostedMutation,
      refreshLocalState,
      refreshHostedState,
    ]
  );

  const reuseRun = useCallback(
    (runId: string) => {
      const run = runs.find((entry) => entry.id === runId);
      if (!run) return;

      const nextModel = getStudioModelById(run.modelId);
      const nextVisibleModelId = getVisibleModelId(nextModel.id);
      const nextVisibleModel = getStudioModelById(nextVisibleModelId);
      const {
        referenceCount,
        startFrameCount,
        endFrameCount,
        ...persistedRunDraft
      } = run.draftSnapshot;
      void referenceCount;
      void startFrameCount;
      void endFrameCount;
      const nextDraft = {
        ...(buildStudioDraftMap()[nextVisibleModel.id] ??
          toPersistedDraft(createDraft(nextVisibleModel))),
        ...persistedRunDraft,
      };

      if (nextVisibleModel.id !== nextModel.id) {
        nextDraft.outputFormat = nextVisibleModel.defaultDraft.outputFormat;
        nextDraft.voice = nextVisibleModel.defaultDraft.voice;
        nextDraft.language = nextVisibleModel.defaultDraft.language;
        nextDraft.speakingRate = nextVisibleModel.defaultDraft.speakingRate;
      }

      setSelectedModelIdState(nextVisibleModel.id);
      setDraftsByModelId((current) => ({
        ...current,
        [nextVisibleModel.id]: nextDraft,
      }));
      setDraftReferencesByModelId((current) => {
        releaseRemovedDraftReferencePreviews(current[nextVisibleModel.id] ?? [], []);
        return {
          ...current,
          [nextVisibleModel.id]: [],
        };
      });
      setDraftFramesByModelId((current) => {
        const existingFrames =
          current[nextVisibleModel.id] ??
          ({ startFrame: null, endFrame: null } satisfies DraftFrameInputs);
        if (existingFrames.startFrame) {
          releaseDraftReferencePreview(existingFrames.startFrame);
        }
        if (existingFrames.endFrame) {
          releaseDraftReferencePreview(existingFrames.endFrame);
        }
        return {
          ...current,
          [nextVisibleModel.id]: {
            startFrame: null,
            endFrame: null,
          },
        };
      });
    },
    [getVisibleModelId, runs]
  );

  const reuseItem = useCallback(
    (itemId: string) => {
      const item = items.find((entry) => entry.id === itemId);
      if (!item?.modelId) return;

      const matchingRun = runs.find((run) => run.outputAssetId === item.id);
      if (matchingRun) {
        reuseRun(matchingRun.id);
        return;
      }

      const nextModel = getStudioModelById(item.modelId);
      const nextVisibleModelId = getVisibleModelId(nextModel.id);
      setSelectedModelIdState(nextVisibleModelId);
      setDraftsByModelId((current) => ({
        ...current,
        [nextVisibleModelId]: {
          ...(current[nextVisibleModelId] ??
            toPersistedDraft(createDraft(getStudioModelById(nextVisibleModelId)))),
          prompt: item.prompt,
        },
      }));
      setDraftReferencesByModelId((current) => {
        releaseRemovedDraftReferencePreviews(current[nextVisibleModelId] ?? [], []);
        return {
          ...current,
          [nextVisibleModelId]: [],
        };
      });
      setDraftFramesByModelId((current) => {
        const existingFrames =
          current[nextVisibleModelId] ??
          ({ startFrame: null, endFrame: null } satisfies DraftFrameInputs);
        if (existingFrames.startFrame) {
          releaseDraftReferencePreview(existingFrames.startFrame);
        }
        if (existingFrames.endFrame) {
          releaseDraftReferencePreview(existingFrames.endFrame);
        }
        return {
          ...current,
          [nextVisibleModelId]: {
            startFrame: null,
            endFrame: null,
          },
        };
      });
    },
    [getVisibleModelId, items, reuseRun, runs]
  );

  const updateTextItem = useCallback(
    (itemId: string, patch: { title?: string; contentText?: string }) => {
      if (appMode === "hosted") {
        void applyHostedMutation({
          action: "update_text_item",
          itemId,
          title: patch.title,
          contentText: patch.contentText,
        });
        return;
      }

      void applyLocalMutation({
        action: "update_text_item",
        itemId,
        title: patch.title,
        contentText: patch.contentText,
      }).catch(refreshLocalState);
    },
    [appMode, applyHostedMutation, applyLocalMutation, refreshLocalState]
  );

  const openCreateTextComposer = useCallback(() => {
    setCreateTextTitle("");
    setCreateTextBody("");
    setCreateTextErrorMessage(null);
    setCreateTextDialogOpen(true);
  }, []);

  const closeCreateTextComposer = useCallback(() => {
    if (createTextSaving) {
      return;
    }

    setCreateTextDialogOpen(false);
    setCreateTextTitle("");
    setCreateTextBody("");
    setCreateTextErrorMessage(null);
  }, [createTextSaving]);

  const updateCreateTextTitle = useCallback((value: string) => {
    setCreateTextTitle(value);
    setCreateTextErrorMessage(null);
  }, []);

  const updateCreateTextBody = useCallback((value: string) => {
    setCreateTextBody(value);
    setCreateTextErrorMessage(null);
  }, []);

  const createTextAsset = useCallback(async () => {
    if (createTextSaving) {
      return;
    }

    const nextBody = createTextBody.trim();
    if (!nextBody) {
      setCreateTextErrorMessage("Prompt body is required.");
      return;
    }

    setCreateTextSaving(true);
    setCreateTextErrorMessage(null);

    try {
      if (appMode === "hosted") {
        await applyHostedMutation({
          action: "create_text_item",
          title: createTextTitle,
          body: createTextBody,
          folderId: selectedFolderId,
        });
        setCreateTextSaving(false);
        setCreateTextDialogOpen(false);
        setCreateTextTitle("");
        setCreateTextBody("");
        setCreateTextErrorMessage(null);
        return;
      }

      await applyLocalMutation({
        action: "create_text_item",
        title: createTextTitle,
        body: createTextBody,
        folderId: selectedFolderId,
      });
      setCreateTextSaving(false);
      setCreateTextDialogOpen(false);
      setCreateTextTitle("");
      setCreateTextBody("");
      setCreateTextErrorMessage(null);
    } catch (error) {
      setCreateTextErrorMessage(
        error instanceof Error ? error.message : "Failed to create prompt file."
      );
      setCreateTextSaving(false);
    }
  }, [
    appMode,
    applyLocalMutation,
    applyHostedMutation,
    createTextBody,
    createTextSaving,
    createTextTitle,
    selectedFolderId,
  ]);

  const openUploadDialog = useCallback(() => {
    if (uploadAssetsLoading) {
      return;
    }

    setUploadDialogFolderId(selectedFolderId);
    setUploadDialogOpen(true);
  }, [selectedFolderId, uploadAssetsLoading]);

  const closeUploadDialog = useCallback(() => {
    if (uploadAssetsLoading) {
      return;
    }

    setUploadDialogOpen(false);
  }, [uploadAssetsLoading]);

  const setUploadDialogFolder = useCallback((folderId: string | null) => {
    setUploadDialogFolderId(folderId);
  }, []);

  const uploadFiles = useCallback(
    async (files: File[], folderIdOverride?: string | null) => {
      if (files.length === 0 || uploadAssetsLoading) {
        return;
      }

      setUploadAssetsLoading(true);
      try {
        if (appMode === "hosted") {
          await applyHostedUpload(files, folderIdOverride ?? selectedFolderId);
          setUploadDialogOpen(false);
          return;
        }

        await applyLocalUpload(files, folderIdOverride ?? selectedFolderId);
        setUploadDialogOpen(false);
      } finally {
        setUploadAssetsLoading(false);
      }
    },
    [appMode, applyHostedUpload, applyLocalUpload, selectedFolderId, uploadAssetsLoading]
  );

  const saveProviderSettings = useCallback(
    async (nextSettings: StudioProviderSettings): Promise<StudioProviderSaveResult> => {
      const falApiKey = nextSettings.falApiKey.trim();

      if (!falApiKey) {
        setProviderConnectionStatus("invalid");
        return {
          ok: false,
          errorMessage: "Enter your Fal API key.",
        };
      }

      if (falApiKey.length < 16 || /\s/.test(falApiKey)) {
        setProviderConnectionStatus("invalid");
        return {
          ok: false,
          errorMessage: "Enter a valid Fal API key.",
        };
      }

      let validatedAt = nextSettings.lastValidatedAt;

      try {
        validatedAt = await validateFalApiKey(falApiKey);
      } catch (error) {
        setProviderConnectionStatus("invalid");
        return {
          ok: false,
          errorMessage:
            error instanceof Error
              ? error.message
              : "Could not validate your Fal API key.",
        };
      }

      setProviderSettings({
        falApiKey,
        lastValidatedAt: validatedAt ?? new Date().toISOString(),
      });
      setProviderConnectionStatus("connected");

      return {
        ok: true,
        successMessage: "Fal API key connected for this browser session.",
      };
    },
    []
  );

  const openHostedAuthDialog = useCallback(() => {
    setHostedAuthErrorMessage(null);
    setHostedAuthDialogOpen(true);
  }, []);

  const signInWithGoogleHostedAccount = useCallback(async () => {
    if (appMode !== "hosted" || hostedAuthPending) {
      return;
    }

    setHostedAuthPending(true);
    setHostedAuthErrorMessage(null);

    try {
      await signInWithGoogleHostedSession();
    } catch (error) {
      setHostedAuthPending(false);
      setHostedAuthErrorMessage(
        error instanceof Error
          ? error.message
          : "Google sign-in could not be started."
      );
    }
  }, [appMode, hostedAuthPending]);

  const cancelRun = useCallback(
    (runId: string) => {
      const targetRun = runsRef.current.find((run) => run.id === runId);
      if (!targetRun || (targetRun.status !== "queued" && targetRun.status !== "pending")) {
        return;
      }

      if (appMode === "hosted") {
        void applyHostedMutation({
          action: "cancel_run",
          runId,
        });
        return;
      }

      void applyLocalMutation({
        action: "cancel_run",
        runId,
      }).catch(refreshLocalState);
    },
    [appMode, applyHostedMutation, applyLocalMutation, refreshLocalState]
  );

  const purchaseHostedCredits = useCallback(async (credits: StudioCreditPurchaseAmount) => {
    if (appMode !== "hosted") {
      return;
    }

    setPurchaseCreditsPending(true);
    try {
      await applyHostedMutation({
        action: "purchase_credits",
        credits,
      });
    } finally {
      setPurchaseCreditsPending(false);
    }
  }, [appMode, applyHostedMutation]);

  const buildHostedGenerationPayload = useCallback(() => {
    const inputs: HostedStudioGenerateInputDescriptor[] = [];
    const filesByField = new Map<string, File>();
    let nextUploadIndex = 0;

    const appendInput = (
      slot: HostedStudioGenerateInputDescriptor["slot"],
      reference: DraftReference | null
    ) => {
      if (!reference) {
        return;
      }

      const uploadField =
        reference.originAssetId === null ? `upload-${nextUploadIndex++}` : null;

      if (uploadField) {
        filesByField.set(uploadField, reference.file);
      }

      inputs.push({
        slot,
        uploadField,
        originAssetId: reference.originAssetId,
        title: reference.title,
        kind: reference.kind,
        mimeType: reference.mimeType,
        source: reference.source,
      });
    };

    for (const reference of currentDraft.references) {
      appendInput("reference", reference);
    }

    appendInput("start_frame", currentDraft.startFrame);
    appendInput("end_frame", currentDraft.endFrame);

    return {
      inputs,
      filesByField,
    };
  }, [currentDraft.endFrame, currentDraft.references, currentDraft.startFrame]);

  const signOutHostedAccount = useCallback(async () => {
    if (appMode !== "hosted") {
      return;
    }

    await signOutHostedSession();
    setSettingsDialogOpen(false);
  }, [appMode]);

  const deleteHostedAccount = useCallback(async () => {
    if (appMode !== "hosted") {
      return;
    }

    const request = beginHostedRequest();

    try {
      await deleteHostedAccountRequest(request.controller.signal);
      await signOutHostedSession().catch(() => undefined);
    } finally {
      finishHostedRequest(request.controller);
    }

    setSettingsDialogOpen(false);
  }, [appMode, beginHostedRequest, finishHostedRequest]);

  const setGallerySizeLevel = useCallback((value: number) => {
    const nextValue = Math.min(Math.max(Math.round(value), 0), 6);
    setGallerySizeLevelState(nextValue);
  }, []);

  const setSelectedModelId = useCallback((modelId: string) => {
    setSelectedModelIdState(getVisibleModelId(modelId));
  }, [getVisibleModelId]);

  const generate = useCallback(() => {
    if (!canGenerateWithDraft(selectedModel, currentDraft)) {
      return;
    }

    if (appMode === "local" && !hasFalKey) {
      setSettingsDialogOpen(true);
      return;
    }

    if (appMode === "hosted" && !hostedUserSignedIn) {
      setHostedAuthDialogOpen(true);
      return;
    }

    if (appMode === "hosted") {
      const hostedGenerationPayload = buildHostedGenerationPayload();
      const request = beginHostedRequest();

      void queueHostedGeneration({
        modelId: selectedModel.id,
        folderId: selectedFolderId,
        draft: createDraftSnapshot(currentDraft),
        inputs: hostedGenerationPayload.inputs,
        filesByField: hostedGenerationPayload.filesByField,
        signal: request.controller.signal,
      })
        .then((response) => {
          finishHostedRequest(request.controller);
          applyHostedResponse(response.state, {
            requestId: request.requestId,
            sessionId: request.sessionId,
          });
        })
        .catch((error) => {
          finishHostedRequest(request.controller);
          if (
            error instanceof Error &&
            error.message ===
              "limit of 100 concurrent queues/ generations reached, please wait for your generations to finish before continuing."
          ) {
            setQueueLimitDialogOpen(true);
          }
        });
      return;
    }

    void applyLocalMutation({
      action: "generate",
      modelId: selectedModel.id,
      folderId: selectedFolderId,
      draft: createDraftSnapshot(currentDraft),
      referenceCount: currentDraft.references.length,
      startFrameCount: currentDraft.startFrame ? 1 : 0,
      endFrameCount: currentDraft.endFrame ? 1 : 0,
    }).catch((error) => {
      if (
        error instanceof Error &&
        error.message ===
          "limit of 100 concurrent queues/ generations reached, please wait for your generations to finish before continuing."
      ) {
        setQueueLimitDialogOpen(true);
        return;
      }

      refreshLocalState();
    });
  }, [
    appMode,
    applyLocalMutation,
    applyHostedResponse,
    beginHostedRequest,
    buildHostedGenerationPayload,
    currentDraft,
    finishHostedRequest,
    hasFalKey,
    hostedUserSignedIn,
    refreshLocalState,
    selectedFolderId,
    selectedModel,
  ]);

  return {
    accountButtonLabel,
    addReferences,
    cancelRun,
    clearSelection,
    closeCreateTextComposer,
    closeFolderEditor,
    closeQueueLimitDialog: () => setQueueLimitDialogOpen(false),
    closeUploadDialog,
    createTextAsset,
    createTextBody,
    createTextDialogOpen,
    createTextErrorMessage,
    createTextSaving,
    createTextTitle,
    currentDraft,
    deleteFolder,
    deleteItem,
    deleteSelectedItems,
    dropLibraryItemsIntoPromptBar,
    folderCounts,
    folderEditorError,
    folderEditorMode,
    folderEditorOpen,
    folderEditorSaving,
    folderEditorValue,
    folders,
    gallerySizeLevel,
    generate,
    getItemsForFolder: (folderId: string) =>
      items.filter((item) => item.folderId === folderId),
    getPromptBarDropHint,
    hasFalKey,
    hostedAccount,
    hostedAuthDialogOpen,
    hostedAuthErrorMessage,
    hostedAuthPending,
    hostedUserSignedIn,
    items,
    modelConfiguration,
    modelSections: STUDIO_MODEL_SECTIONS,
    models,
    moveItemsToFolder,
    openCreateFolder,
    openCreateTextComposer,
    openRenameFolder,
    openUploadDialog,
    providerConnectionStatus,
    providerSettings,
    purchaseCreditsPending,
    purchaseHostedCredits,
    queueLimitDialogOpen,
    removeReference,
    reorderFolders,
    reuseItem,
    reuseRun,
    saveFolder,
    saveProviderSettings,
    selectedFolder,
    selectedFolderId,
    selectedFolderItems,
    selectedFolderRunCards,
    selectedItemCount,
    selectedItemIdSet,
    selectedModel,
    selectedModelId: visibleSelectedModelId,
    selectionModeEnabled,
    settingsDialogOpen,
    setEndFrame: (file: File) => setFrameInput("end", file),
    setGallerySizeLevel,
    setSettingsDialogOpen,
    setSelectedFolderId,
    setSelectedModelId,
    setStartFrame: (file: File) => setFrameInput("start", file),
    setUploadDialogFolder,
    setVideoInputMode,
    clearEndFrame: () => clearFrameInput("end"),
    clearStartFrame: () => clearFrameInput("start"),
    dropLibraryItemsIntoEndFrame: (itemIds: string[]) =>
      setFrameFromLibraryItems(itemIds, "end"),
    dropLibraryItemsIntoStartFrame: (itemIds: string[]) =>
      setFrameFromLibraryItems(itemIds, "start"),
    toggleItemSelection,
    toggleModelEnabled,
    toggleSelectionMode,
    ungroupedItems,
    ungroupedRunCards,
    updateCreateTextBody,
    updateCreateTextTitle,
    updateDraft,
    updateFolderEditorValue,
    updateModelConfiguration,
    updateTextItem,
    uploadAssetsLoading,
    uploadDialogFolderId,
    uploadDialogOpen,
    uploadFiles,
    deleteHostedAccount,
    signOutHostedAccount,
    openHostedAuthDialog,
    signInWithGoogleHostedAccount,
  };
}
