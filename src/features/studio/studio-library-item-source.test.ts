import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadUploadedAssetFile } = vi.hoisted(() => ({
  loadUploadedAssetFile: vi.fn(),
}));

vi.mock("./studio-browser-storage", () => ({
  loadUploadedAssetFile,
}));

import {
  getLibraryItemDownloadFileName,
  getLibraryItemFallbackMimeType,
  getLibraryItemFileExtension,
  getLibraryItemSourceUrl,
  readLibraryItemSourceBlob,
} from "./studio-library-item-source";
import type { LibraryItem } from "./types";

function createItem(
  overrides?: Partial<
    Pick<
      LibraryItem,
      | "contentText"
      | "fileName"
      | "kind"
      | "mimeType"
      | "previewUrl"
      | "storageBucket"
      | "storagePath"
      | "title"
    >
  >
) {
  return {
    contentText: null,
    fileName: null,
    kind: "image",
    mimeType: "image/png",
    previewUrl: "https://cdn.test/preview.png",
    storageBucket: "hosted-media",
    storagePath: "users/user-1/asset.png",
    title: "My Asset",
    ...overrides,
  } satisfies Pick<
    LibraryItem,
    | "contentText"
    | "fileName"
    | "kind"
    | "mimeType"
    | "previewUrl"
    | "storageBucket"
    | "storagePath"
    | "title"
  >;
}

describe("studio-library-item-source", () => {
  beforeEach(() => {
    loadUploadedAssetFile.mockReset();
    vi.restoreAllMocks();
  });

  it("derives file extensions and fallback mime types", () => {
    expect(
      getLibraryItemFileExtension(
        createItem({ fileName: "voice-track.m4a", mimeType: null, kind: "audio" })
      )
    ).toBe("m4a");
    expect(
      getLibraryItemFallbackMimeType(
        createItem({ fileName: null, mimeType: null, kind: "audio" })
      )
    ).toBe("audio/mpeg");
  });

  it("builds a download filename from the title when none exists", () => {
    expect(
      getLibraryItemDownloadFileName(
        createItem({ title: "  Fancy Prompt File  ", fileName: null, kind: "text", mimeType: null })
      )
    ).toBe("fancy-prompt-file.txt");
  });

  it("resolves source urls across storage backends", () => {
    expect(
      getLibraryItemSourceUrl(
        createItem({ storageBucket: "browser-upload", previewUrl: "blob:asset" })
      )
    ).toBeNull();

    expect(
      getLibraryItemSourceUrl(
        createItem({ storageBucket: "local-fs", previewUrl: "/api/studio/local/files/file-1" })
      )
    ).toBe("/api/studio/local/files/file-1");

    expect(getLibraryItemSourceUrl(createItem())).toBe(
      "/api/studio/hosted/files/users%2Fuser-1%2Fasset.png"
    );
  });

  it("reads text assets directly into blobs", async () => {
    const blob = await readLibraryItemSourceBlob(
      createItem({
        kind: "text",
        mimeType: null,
        contentText: "Hello world",
      })
    );

    expect(await blob?.text()).toBe("Hello world");
    expect(blob?.type).toBe("text/plain");
  });

  it("loads browser-upload assets from the browser storage helper", async () => {
    const file = new Blob(["audio-bytes"], { type: "audio/mpeg" });
    loadUploadedAssetFile.mockResolvedValue(file);

    const result = await readLibraryItemSourceBlob(
      createItem({
        kind: "audio",
        storageBucket: "browser-upload",
        storagePath: "uploads/audio-1",
      })
    );

    expect(loadUploadedAssetFile).toHaveBeenCalledWith("uploads/audio-1");
    expect(result).toBe(file);
  });

  it("fetches hosted or direct source urls when needed", async () => {
    const blob = new Blob(["image-bytes"], { type: "image/png" });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(blob),
    } as unknown as Response);

    const result = await readLibraryItemSourceBlob(createItem());

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/studio/hosted/files/users%2Fuser-1%2Fasset.png",
      {
        cache: "no-store",
        credentials: "same-origin",
      }
    );
    expect(result).toBe(blob);
  });
});
