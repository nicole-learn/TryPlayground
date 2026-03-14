import { describe, expect, it } from "vitest";
import {
  getDraftReferencePreviewMediaKind,
  getLibraryItemPreviewMediaKind,
  getPreviewMediaKind,
  isPlayableVideoPreview,
} from "./studio-preview-utils";
import type { DraftReference, LibraryItem } from "./types";

describe("studio-preview-utils", () => {
  it("detects image and video previews from urls and mime types", () => {
    expect(
      getPreviewMediaKind({
        kind: "image",
        previewUrl: "https://cdn.test/example.png",
      })
    ).toBe("image");

    expect(
      getPreviewMediaKind({
        kind: "video",
        previewUrl: "blob:demo",
        mimeType: "video/mp4",
      })
    ).toBe("video");

    expect(
      getPreviewMediaKind({
        kind: "video",
        previewUrl: "https://cdn.test/thumb.jpg",
        mimeType: "video/mp4",
        preferImagePreview: true,
      })
    ).toBe("image");
  });

  it("falls back to file previews for unsupported assets", () => {
    expect(
      getPreviewMediaKind({
        kind: "document",
        previewUrl: "https://cdn.test/example.bin",
      })
    ).toBe("file");
  });

  it("uses thumbnails when deriving library item preview media kinds", () => {
    const item = {
      id: "asset-1",
      kind: "video",
      mimeType: "video/mp4",
      previewUrl: "https://cdn.test/video.mp4",
      thumbnailUrl: "https://cdn.test/video-thumb.jpg",
    } satisfies Pick<LibraryItem, "id" | "kind" | "mimeType" | "previewUrl" | "thumbnailUrl">;

    expect(getLibraryItemPreviewMediaKind(item as LibraryItem)).toBe("image");
  });

  it("derives draft reference preview kinds from their preview metadata", () => {
    const reference = {
      kind: "image",
      mimeType: "image/png",
      previewUrl: "blob:reference-image",
    } satisfies Pick<DraftReference, "kind" | "mimeType" | "previewUrl">;

    expect(getDraftReferencePreviewMediaKind(reference as DraftReference)).toBe(
      "image"
    );
    expect(
      isPlayableVideoPreview({
        mimeType: "video/webm",
        previewUrl: "https://cdn.test/clip.webm",
      })
    ).toBe(true);
  });
});
