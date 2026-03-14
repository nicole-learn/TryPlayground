import { beforeEach, describe, expect, it, vi } from "vitest";

const { readUploadedAssetMediaMetadata, readLibraryItemSourceBlob } = vi.hoisted(() => ({
  readUploadedAssetMediaMetadata: vi.fn(),
  readLibraryItemSourceBlob: vi.fn(),
}));

vi.mock("./studio-asset-metadata", () => ({
  readUploadedAssetMediaMetadata,
}));

vi.mock("./studio-library-item-source", async () => {
  const actual = await vi.importActual<typeof import("./studio-library-item-source")>(
    "./studio-library-item-source"
  );
  return {
    ...actual,
    readLibraryItemSourceBlob,
  };
});

import {
  appendLibraryItemsToPrompt,
  createDraftReferenceFromFile,
  createDraftReferenceFromLibraryItem,
  createFolderItemCounts,
  createTextLibraryItem,
  createUploadedRunFileAndLibraryItem,
  getReferenceInputKindFromFile,
  hasFolderNameConflict,
  isInFlightStudioRunStatus,
  isReferenceEligibleLibraryItem,
  mergeDraftReferences,
} from "./studio-local-runtime-helpers";
import type { DraftReference, LibraryItem, StudioFolder } from "./types";

function createFolder(id: string, name: string): StudioFolder {
  return {
    id,
    userId: "user-1",
    workspaceId: "workspace-1",
    name,
    createdAt: "2026-03-13T10:00:00.000Z",
    updatedAt: "2026-03-13T10:00:00.000Z",
    sortOrder: 0,
  };
}

function createItem(overrides?: Partial<LibraryItem>): LibraryItem {
  return {
    id: "asset-1",
    userId: "user-1",
    workspaceId: "workspace-1",
    runFileId: null,
    sourceRunId: null,
    title: "Prompt",
    kind: "image",
    source: "uploaded",
    role: "uploaded_source",
    previewUrl: "https://cdn.test/preview.png",
    thumbnailUrl: "https://cdn.test/thumb.png",
    contentText: null,
    createdAt: "2026-03-13T10:00:00.000Z",
    updatedAt: "2026-03-13T10:00:00.000Z",
    modelId: null,
    runId: null,
    provider: "fal",
    status: "ready",
    prompt: "",
    meta: "Meta",
    mediaWidth: null,
    mediaHeight: null,
    mediaDurationSeconds: null,
    aspectRatioLabel: null,
    hasAlpha: false,
    folderId: null,
    folderIds: [],
    storageBucket: "hosted-media",
    storagePath: "users/user-1/asset.png",
    thumbnailPath: null,
    fileName: "asset.png",
    mimeType: "image/png",
    byteSize: 1024,
    metadata: {},
    errorMessage: null,
    ...overrides,
  };
}

describe("studio-local-runtime-helpers", () => {
  beforeEach(() => {
    readUploadedAssetMediaMetadata.mockReset();
    readLibraryItemSourceBlob.mockReset();
    vi.restoreAllMocks();
  });

  it("creates folder item counts and detects folder name conflicts", () => {
    const folders = [createFolder("folder-a", "References"), createFolder("folder-b", "Prompts")];
    const counts = createFolderItemCounts(folders, [
      { folderId: "folder-a" },
      { folderId: "folder-a" },
      { folderId: "folder-b" },
    ] as Pick<LibraryItem, "folderId">[]);

    expect(counts).toEqual({ "folder-a": 2, "folder-b": 1 });
    expect(hasFolderNameConflict(folders, " references ", null)).toBe(true);
    expect(hasFolderNameConflict(folders, "references", "folder-a")).toBe(false);
  });

  it("classifies reference-eligible items and file input kinds", () => {
    expect(isReferenceEligibleLibraryItem(createItem({ kind: "audio" }))).toBe(true);
    expect(isReferenceEligibleLibraryItem(createItem({ kind: "text" }))).toBe(false);
    expect(
      getReferenceInputKindFromFile({ name: "frame.png", type: "image/png" } as File)
    ).toBe("image");
    expect(
      getReferenceInputKindFromFile({ name: "notes.pdf", type: "application/pdf" } as File)
    ).toBe("document");
  });

  it("merges prompt text and deduplicates draft references", () => {
    const prompt = appendLibraryItemsToPrompt("Existing", [
      createItem({ kind: "text", contentText: "First note", prompt: "", title: "First" }),
      createItem({ id: "asset-2", kind: "text", contentText: null, prompt: "Second prompt" }),
    ]);

    expect(prompt).toBe("Existing\n\nFirst note\n\nSecond prompt");

    const file = new File(["image"], "frame.png", { type: "image/png" });
    const first = createDraftReferenceFromFile(file);
    const duplicate = {
      ...first,
      id: "duplicate",
    } satisfies DraftReference;
    const second = createDraftReferenceFromLibraryItem({
      file: new File(["image"], "asset.png", { type: "image/png" }),
      item: createItem({ id: "asset-2" }),
    });

    const merged = mergeDraftReferences([first], [duplicate, second], 3);
    expect(merged).toHaveLength(2);
    expect(merged[1]?.originAssetId).toBe("asset-2");
  });

  it("creates upload references with the right preview behavior", () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:image-preview");

    const imageReference = createDraftReferenceFromFile(
      new File(["image"], "frame.png", { type: "image/png" })
    );
    const audioReference = createDraftReferenceFromFile(
      new File(["audio"], "voice.mp3", { type: "audio/mpeg" })
    );

    expect(imageReference.previewUrl).toBe("blob:image-preview");
    expect(imageReference.previewSource).toBe("owned");
    expect(audioReference.kind).toBe("audio");
    expect(audioReference.previewSource).toBe("none");
    expect(audioReference.previewUrl?.startsWith("data:image/svg+xml")).toBe(true);
  });

  it("creates text library items for prompt files", () => {
    const item = createTextLibraryItem({
      userId: "user-1",
      workspaceId: "workspace-1",
      title: "My Prompt",
      body: "Hello world",
      folderId: "folder-a",
    });

    expect(item.kind).toBe("text");
    expect(item.fileName).toBe("my-prompt.txt");
    expect(item.folderIds).toEqual(["folder-a"]);
  });

  it("creates uploaded run files and library items from supported uploads", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:upload-preview");
    readUploadedAssetMediaMetadata.mockResolvedValue({
      mediaWidth: 1600,
      mediaHeight: 900,
      mediaDurationSeconds: null,
      aspectRatioLabel: "16:9",
      hasAlpha: false,
    });

    const result = await createUploadedRunFileAndLibraryItem({
      file: new File(["image"], "render.png", { type: "image/png" }),
      userId: "user-1",
      workspaceId: "workspace-1",
      folderId: "folder-a",
    });

    expect(result?.runFile.storageBucket).toBe("browser-upload");
    expect(result?.item.kind).toBe("image");
    expect(result?.item.folderId).toBe("folder-a");
    expect(result?.item.aspectRatioLabel).toBe("16:9");
  });

  it("returns null for unsupported uploads and tracks in-flight run states", async () => {
    const result = await createUploadedRunFileAndLibraryItem({
      file: new File(["text"], "notes.txt", { type: "text/plain" }),
      userId: "user-1",
      workspaceId: "workspace-1",
      folderId: null,
    });

    expect(result).toBeNull();
    expect(isInFlightStudioRunStatus("queued")).toBe(true);
    expect(isInFlightStudioRunStatus("completed")).toBe(false);
  });
});
