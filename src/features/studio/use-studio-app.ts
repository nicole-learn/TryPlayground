"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MODEL_SECTIONS, STUDIO_MODELS, getModelById } from "./catalog";
import {
  loadStoredGridDensity,
  loadStoredSettings,
  saveStoredGridDensity,
  saveStoredSettings,
} from "./local-storage";
import {
  buildDraftMap,
  createDraft,
  createDraftSnapshot,
  createGeneratedItem,
  createId,
  createRunSummary,
  createSeedState,
} from "./mock-data";
import type {
  DraftReference,
  GenerationRun,
  LibraryItem,
  LocalProviderSettings,
  StudioDraft,
  StudioFolder,
} from "./types";

function revokePreview(url: string | undefined) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

function cleanupUploadedItemPreview(
  item: LibraryItem | undefined,
  previewUrls: Map<string, string>
) {
  if (!item?.previewUrl || item.source !== "uploaded") {
    return;
  }

  const previewUrl = previewUrls.get(item.id) ?? item.previewUrl;
  revokePreview(previewUrl);
  previewUrls.delete(item.id);
}

function createFolderCounts(folders: StudioFolder[], items: LibraryItem[]) {
  return Object.fromEntries(
    folders.map((folder) => [
      folder.id,
      items.filter((item) => item.folderIds.includes(folder.id)).length,
    ])
  ) as Record<string, number>;
}

function removeTimer(timerIds: number[], timerId: number) {
  return timerIds.filter((entry) => entry !== timerId);
}

export function useStudioApp() {
  const seed = useMemo(() => createSeedState(), []);
  const [models] = useState(STUDIO_MODELS);
  const [selectedModelId, setSelectedModelId] = useState(STUDIO_MODELS[0].id);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState(seed.folders);
  const [items, setItems] = useState(seed.items);
  const [runs, setRuns] = useState(seed.runs);
  const [draftsByModelId, setDraftsByModelId] = useState(buildDraftMap);
  const [gridDensity, setGridDensity] = useState(() => loadStoredGridDensity() ?? 3);
  const [settings, setSettings] = useState<LocalProviderSettings>(
    () => loadStoredSettings() ?? { falApiKey: "" }
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [folderEditorOpen, setFolderEditorOpen] = useState(false);
  const [folderEditorMode, setFolderEditorMode] = useState<"create" | "rename">("create");
  const [folderEditorValue, setFolderEditorValue] = useState("");
  const [folderEditorTargetId, setFolderEditorTargetId] = useState<string | null>(null);
  const uploadUrlsRef = useRef(new Map<string, string>());
  const pendingTimersRef = useRef<number[]>([]);

  useEffect(() => {
    saveStoredGridDensity(gridDensity);
  }, [gridDensity]);

  useEffect(() => {
    saveStoredSettings(settings);
  }, [settings]);

  useEffect(() => {
    const previewUrls = uploadUrlsRef.current;
    const pendingTimers = pendingTimersRef.current;

    return () => {
      for (const previewUrl of previewUrls.values()) {
        revokePreview(previewUrl);
      }

      for (const timerId of pendingTimers) {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  const selectedModel = useMemo(
    () => models.find((model) => model.id === selectedModelId) ?? models[0],
    [models, selectedModelId]
  );
  const currentDraft = draftsByModelId[selectedModel.id] ?? createDraft(selectedModel);
  const selectedFolder = useMemo(
    () => folders.find((folder) => folder.id === selectedFolderId) ?? null,
    [folders, selectedFolderId]
  );
  const filteredItems = useMemo(() => {
    if (!selectedFolderId) {
      return items;
    }

    return items.filter((item) => item.folderIds.includes(selectedFolderId));
  }, [items, selectedFolderId]);
  const folderCounts = useMemo(
    () => createFolderCounts(folders, items),
    [folders, items]
  );
  const allCount = items.length;
  const hasFalKey = settings.falApiKey.trim().length > 0;

  const updateDraft = useCallback(
    (patch: Partial<StudioDraft>) => {
      setDraftsByModelId((current) => ({
        ...current,
        [selectedModel.id]: {
          ...(current[selectedModel.id] ?? createDraft(selectedModel)),
          ...patch,
        },
      }));
    },
    [selectedModel]
  );

  const addReferences = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;

      const nextReferences: DraftReference[] = files.map((file) => ({
        id: createId("ref"),
        file,
      }));

      updateDraft({
        references: [...currentDraft.references, ...nextReferences].slice(0, 6),
      });
    },
    [currentDraft.references, updateDraft]
  );

  const removeReference = useCallback(
    (referenceId: string) => {
      updateDraft({
        references: currentDraft.references.filter(
          (reference) => reference.id !== referenceId
        ),
      });
    },
    [currentDraft.references, updateDraft]
  );

  const resetFolderEditor = useCallback(() => {
    setFolderEditorOpen(false);
    setFolderEditorValue("");
    setFolderEditorTargetId(null);
  }, []);

  const openCreateFolder = useCallback(() => {
    setFolderEditorMode("create");
    setFolderEditorTargetId(null);
    setFolderEditorValue("");
    setFolderEditorOpen(true);
  }, []);

  const openRenameFolder = useCallback(
    (folderId: string) => {
      const folder = folders.find((entry) => entry.id === folderId);
      if (!folder) return;

      setFolderEditorMode("rename");
      setFolderEditorTargetId(folder.id);
      setFolderEditorValue(folder.name);
      setFolderEditorOpen(true);
    },
    [folders]
  );

  const saveFolder = useCallback(() => {
    const value = folderEditorValue.trim();
    if (!value) return;

    if (folderEditorMode === "create") {
      const nextFolder: StudioFolder = {
        id: createId("folder"),
        name: value,
        createdAt: new Date().toISOString(),
      };

      setFolders((current) => [nextFolder, ...current]);
      setSelectedFolderId(nextFolder.id);
      resetFolderEditor();
      return;
    }

    if (!folderEditorTargetId) return;

    setFolders((current) =>
      current.map((folder) =>
        folder.id === folderEditorTargetId ? { ...folder, name: value } : folder
      )
    );
    resetFolderEditor();
  }, [
    folderEditorMode,
    folderEditorTargetId,
    folderEditorValue,
    resetFolderEditor,
  ]);

  const deleteFolder = useCallback((folderId: string) => {
    setFolders((current) => current.filter((folder) => folder.id !== folderId));
    setItems((current) =>
      current.map((item) => ({
        ...item,
        folderIds: item.folderIds.filter((entry) => entry !== folderId),
      }))
    );
    setSelectedFolderId((current) => (current === folderId ? null : current));
  }, []);

  const reuseRun = useCallback(
    (runId: string) => {
      const run = runs.find((entry) => entry.id === runId);
      if (!run) return;

      const nextModel = getModelById(run.modelId);
      setSelectedModelId(nextModel.id);
      setDraftsByModelId((current) => ({
        ...current,
        [nextModel.id]: {
          ...(current[nextModel.id] ?? createDraft(nextModel)),
          ...run.draftSnapshot,
          references: [],
        },
      }));
    },
    [runs]
  );

  const reuseItem = useCallback(
    (itemId: string) => {
      const item = items.find((entry) => entry.id === itemId);
      if (!item?.modelId) return;

      const matchingRun = runs.find((run) => run.outputItemId === item.id);
      if (matchingRun) {
        reuseRun(matchingRun.id);
        return;
      }

      const nextModel = getModelById(item.modelId);
      setSelectedModelId(nextModel.id);
      setDraftsByModelId((current) => ({
        ...current,
        [nextModel.id]: {
          ...(current[nextModel.id] ?? createDraft(nextModel)),
          prompt: item.prompt,
          references: [],
        },
      }));
    },
    [items, reuseRun, runs]
  );

  const deleteItem = useCallback((itemId: string) => {
    setItems((current) => {
      const target = current.find((item) => item.id === itemId);
      cleanupUploadedItemPreview(target, uploadUrlsRef.current);
      return current.filter((item) => item.id !== itemId);
    });

    setRuns((current) =>
      current.map((run) =>
        run.outputItemId === itemId ? { ...run, outputItemId: null } : run
      )
    );
  }, []);

  const setItemFolderIds = useCallback((itemId: string, nextFolderIds: string[]) => {
    setItems((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, folderIds: nextFolderIds } : item
      )
    );
  }, []);

  const uploadFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;

      const nextItems = files.map((file) => {
        const fileType = file.type.toLowerCase();
        const itemId = createId("asset");
        const itemKind =
          fileType.startsWith("image/")
            ? "image"
            : fileType.startsWith("video/")
              ? "video"
              : "file";
        const previewUrl =
          itemKind === "image" || itemKind === "video"
            ? URL.createObjectURL(file)
            : null;

        if (previewUrl) {
          uploadUrlsRef.current.set(itemId, previewUrl);
        }

        return {
          id: itemId,
          title: file.name,
          kind: itemKind,
          source: "uploaded" as const,
          previewUrl,
          contentText: null,
          createdAt: new Date().toISOString(),
          modelId: null,
          prompt: "",
          meta: `${file.type || "File"} • ${(file.size / 1024 / 1024).toFixed(1)} MB`,
          folderIds: selectedFolderId ? [selectedFolderId] : [],
        } satisfies LibraryItem;
      });

      setItems((current) => [...nextItems, ...current]);
    },
    [selectedFolderId]
  );

  const saveSettings = useCallback((nextSettings: LocalProviderSettings) => {
    setSettings(nextSettings);
    setSettingsOpen(false);
  }, []);

  const generate = useCallback(() => {
    if (!currentDraft.prompt.trim() || !hasFalKey) return;

    const createdAt = new Date().toISOString();
    const runId = createId("run");
    const folderIds = selectedFolderId ? [selectedFolderId] : [];
    const run: GenerationRun = {
      id: runId,
      modelId: selectedModel.id,
      modelName: selectedModel.name,
      kind: selectedModel.kind,
      status: "running",
      prompt: currentDraft.prompt,
      createdAt,
      summary: createRunSummary(selectedModel, currentDraft),
      outputItemId: null,
      draftSnapshot: createDraftSnapshot(currentDraft),
    };

    setRuns((current) => [run, ...current]);

    const timeoutId = window.setTimeout(() => {
      const nextItem = createGeneratedItem({
        model: selectedModel,
        draft: currentDraft,
        createdAt,
        folderIds,
      });

      pendingTimersRef.current = removeTimer(pendingTimersRef.current, timeoutId);
      setItems((current) => [nextItem, ...current]);
      setRuns((current) =>
        current.map((entry) =>
          entry.id === runId
            ? { ...entry, status: "completed", outputItemId: nextItem.id }
            : entry
        )
      );
    }, 900);

    pendingTimersRef.current = [...pendingTimersRef.current, timeoutId];
  }, [currentDraft, hasFalKey, selectedFolderId, selectedModel]);

  return {
    allCount,
    currentDraft,
    deleteFolder,
    deleteItem,
    filteredItems,
    folderCounts,
    folderEditorMode,
    folderEditorOpen,
    folderEditorTargetId,
    folderEditorValue,
    folders,
    generate,
    gridDensity,
    hasFalKey,
    items,
    modelSections: MODEL_SECTIONS,
    models,
    openCreateFolder,
    openRenameFolder,
    removeReference,
    reuseItem,
    reuseRun,
    runs,
    saveFolder,
    saveSettings,
    selectedFolder,
    selectedFolderId,
    selectedModel,
    selectedModelId,
    setFolderEditorOpen,
    setFolderEditorValue,
    setGridDensity,
    setItemFolderIds,
    setSelectedFolderId,
    setSelectedModelId,
    setSettingsOpen,
    settings,
    settingsOpen,
    updateDraft,
    uploadFiles,
    addReferences,
  };
}
