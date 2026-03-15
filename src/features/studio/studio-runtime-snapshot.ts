import { STUDIO_STATE_SCHEMA_VERSION } from "./studio-local-runtime-data";
import type {
  GenerationRun,
  LibraryItem,
  PersistedStudioDraft,
  StudioCreditBalance,
  StudioCreditPack,
  StudioFolder,
  StudioHostedClientStateDefaults,
  StudioHostedWorkspaceState,
  StudioModelConfiguration,
  StudioProfile,
  StudioProviderSettings,
  StudioQueueSettings,
  StudioRunFile,
  StudioWorkspaceDomainState,
  StudioWorkspaceSnapshot,
} from "./types";

interface BuildStudioWorkspaceSnapshotParams {
  activeCreditPack: StudioCreditPack | null;
  appMode: "local" | "hosted";
  creditBalance: StudioCreditBalance | null;
  draftsByModelId: Record<string, PersistedStudioDraft>;
  folders: StudioFolder[];
  gallerySizeLevel: number;
  items: LibraryItem[];
  modelConfiguration: StudioModelConfiguration;
  profile: StudioProfile;
  providerSettings: StudioProviderSettings;
  queueSettings: StudioQueueSettings;
  runFiles: StudioRunFile[];
  runs: GenerationRun[];
  selectedModelId: string;
}

export function buildStudioWorkspaceSnapshot(
  params: BuildStudioWorkspaceSnapshotParams
) {
  return {
    schemaVersion: STUDIO_STATE_SCHEMA_VERSION,
    mode: params.appMode,
    profile: params.profile,
    providerSettings: params.providerSettings,
    creditBalance: params.creditBalance,
    activeCreditPack: params.activeCreditPack,
    modelConfiguration: params.modelConfiguration,
    queueSettings: params.queueSettings,
    folders: params.folders,
    runFiles: params.runFiles,
    libraryItems: params.items,
    generationRuns: params.runs,
    draftsByModelId: params.draftsByModelId,
    selectedModelId: params.selectedModelId,
    gallerySizeLevel: params.gallerySizeLevel,
  } satisfies StudioWorkspaceSnapshot;
}

export function extractStudioWorkspaceDomainState(
  snapshot: Pick<
    StudioWorkspaceSnapshot,
    | "profile"
    | "creditBalance"
    | "activeCreditPack"
    | "modelConfiguration"
    | "queueSettings"
    | "folders"
    | "runFiles"
    | "libraryItems"
    | "generationRuns"
  >
) {
  return {
    profile: snapshot.profile,
    creditBalance: snapshot.creditBalance,
    activeCreditPack: snapshot.activeCreditPack,
    modelConfiguration: snapshot.modelConfiguration,
    queueSettings: snapshot.queueSettings,
    folders: snapshot.folders,
    runFiles: snapshot.runFiles,
    libraryItems: snapshot.libraryItems,
    generationRuns: snapshot.generationRuns,
  } satisfies StudioWorkspaceDomainState;
}

export function extractHostedClientStateDefaults(
  snapshot: Pick<StudioWorkspaceSnapshot, "selectedModelId" | "gallerySizeLevel">
) {
  return {
    selectedModelId: snapshot.selectedModelId,
    gallerySizeLevel: snapshot.gallerySizeLevel,
  } satisfies StudioHostedClientStateDefaults;
}

export function buildHostedWorkspaceState(params: {
  domainState: StudioWorkspaceDomainState;
  revision: number;
  syncedAt: string;
}) {
  return {
    schemaVersion: STUDIO_STATE_SCHEMA_VERSION,
    mode: "hosted",
    revision: params.revision,
    syncedAt: params.syncedAt,
    ...params.domainState,
  } satisfies StudioHostedWorkspaceState;
}
