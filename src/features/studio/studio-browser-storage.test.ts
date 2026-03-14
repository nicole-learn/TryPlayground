import { beforeEach, describe, expect, it } from "vitest";
import { STUDIO_STATE_SCHEMA_VERSION } from "./studio-local-runtime-data";
import {
  loadStoredGridDensity,
  loadStoredProviderSettings,
  loadStoredWorkspaceSnapshot,
  saveStoredGridDensity,
  saveStoredProviderSettings,
  saveStoredWorkspaceSnapshot,
} from "./studio-browser-storage";
import type { StudioWorkspaceSnapshot } from "./types";

function createSnapshot(): StudioWorkspaceSnapshot {
  return {
    schemaVersion: STUDIO_STATE_SCHEMA_VERSION,
    mode: "local",
    profile: {
      id: "user-1",
      email: "nicole@tryplayground.ai",
      displayName: "Nicole",
      avatarLabel: "N",
      avatarUrl: null,
      preferences: {},
      createdAt: "2026-03-13T10:00:00.000Z",
      updatedAt: "2026-03-13T10:00:00.000Z",
    },
    creditBalance: null,
    activeCreditPack: null,
    modelConfiguration: {
      enabledModelIds: ["nano-banana-2"],
      updatedAt: "2026-03-13T10:00:00.000Z",
    },
    queueSettings: {
      maxActiveJobsPerUser: 100,
      providerSlotLimit: 30,
      localConcurrencyLimit: 3,
      activeHostedUserCount: 1,
    },
    folders: [],
    runFiles: [],
    libraryItems: [],
    generationRuns: [],
    providerSettings: {
      falApiKey: "fal_secret_key",
      lastValidatedAt: "2026-03-13T10:00:00.000Z",
    },
    draftsByModelId: {},
    selectedModelId: "nano-banana-2",
    gallerySizeLevel: 2,
  };
}

describe("studio-browser-storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("stores and restores grid density", () => {
    expect(loadStoredGridDensity()).toBeNull();
    saveStoredGridDensity(4);
    expect(loadStoredGridDensity()).toBe(4);
  });

  it("stores provider settings in session storage only and trims the key", () => {
    saveStoredProviderSettings({
      falApiKey: "  fal_test_key  ",
      lastValidatedAt: "2026-03-13T10:00:00.000Z",
    });

    expect(loadStoredProviderSettings()).toEqual({
      falApiKey: "fal_test_key",
      lastValidatedAt: "2026-03-13T10:00:00.000Z",
    });
  });

  it("sanitizes provider settings before persisting the workspace snapshot", () => {
    const snapshot = createSnapshot();

    saveStoredWorkspaceSnapshot(snapshot);
    const stored = loadStoredWorkspaceSnapshot();

    expect(stored?.providerSettings.falApiKey).toBe("");
    expect(stored?.providerSettings.lastValidatedAt).toBe(
      snapshot.providerSettings.lastValidatedAt
    );
  });

  it("drops snapshots with the wrong schema version", () => {
    window.localStorage.setItem(
      "tryplayground.studio.local.workspaceSnapshot",
      JSON.stringify({
        ...createSnapshot(),
        schemaVersion: STUDIO_STATE_SCHEMA_VERSION - 1,
      })
    );

    expect(loadStoredWorkspaceSnapshot()).toBeNull();
  });
});
